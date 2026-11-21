// Eurailo API: prices the trip, takes payment with Stripe, and tracks each rail ticket.
// Run with `npm run dev` (starts this and Vite together). Needs STRIPE_SECRET_KEY and
// STRIPE_PUBLISHABLE_KEY in .env; see .env.example.

import express from 'express'
import Stripe from 'stripe'
import { randomBytes } from 'node:crypto'
import { buildQuote, MAX_TRAVELLERS } from '../src/tickets.js'
import { STATIONS } from '../src/data.js'
import { OPTIONS, DEPARTURE_TIMES, NIGHT_TRAIN } from '../src/trip.js'
import { cleanPasses } from '../src/passes.js'
import { getBooking, saveBooking, findByPaymentIntent } from './store.js'
import { googleSaveUrl, applePass, WalletError } from './wallet.js'

const PORT = Number(process.env.API_PORT ?? 8787)
const { STRIPE_SECRET_KEY, STRIPE_PUBLISHABLE_KEY, STRIPE_WEBHOOK_SECRET } = process.env
const stripe = STRIPE_SECRET_KEY ? new Stripe(STRIPE_SECRET_KEY) : null

const app = express()

// ---------- Stripe webhook (needs the raw body, so it goes before express.json) ----------
app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  if (!stripe || !STRIPE_WEBHOOK_SECRET) return res.status(503).send('Webhook not configured')
  let event
  try {
    event = stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    return res.status(400).send(`Webhook signature check failed: ${err.message}`)
  }
  if (event.type.startsWith('payment_intent.')) {
    const booking = await findByPaymentIntent(event.data.object.id)
    if (booking) await applyPaymentIntent(booking, event.data.object)
  }
  res.json({ received: true })
})

app.use(express.json({ limit: '50kb' }))

app.get('/api/config', (_req, res) => {
  res.json({ configured: Boolean(stripe && STRIPE_PUBLISHABLE_KEY), publishableKey: STRIPE_PUBLISHABLE_KEY ?? null })
})

// Create (or update) a booking and its PaymentIntent. The browser sends the trip; we price it here.
app.post('/api/checkout', async (req, res) => {
  const input = validate(req.body)
  if (input.error) return res.status(400).json({ error: input.error })

  const quote = buildQuote({ ...input.trip, travellers: input.travellers.length })
  const existing = req.body.bookingId ? await getBooking(String(req.body.bookingId)) : null
  const booking = existing && existing.status === 'awaiting_payment' ? existing : newBooking()

  Object.assign(booking, {
    email: input.email,
    travellers: input.travellers,
    trip: input.trip,
    quote,
    tickets: quote.tickets.map((t) => ({ ...t, status: 'not_booked', reference: null })),
    updatedAt: new Date().toISOString(),
  })

  // The travellers' passes cover everything: nothing to charge, just book the tickets.
  if (quote.totalCents === 0) {
    if (booking.paymentIntentId && stripe) await stripe.paymentIntents.cancel(booking.paymentIntentId).catch(() => {})
    booking.paymentIntentId = null
    booking.status = 'paid'
    booking.paidAt = new Date().toISOString()
    requestTickets(booking)
    await saveBooking(booking)
    return res.json({ bookingId: booking.id, free: true, quote })
  }
  if (!stripe) return res.status(503).json({ error: 'Payments are not set up yet (missing STRIPE_SECRET_KEY).' })

  const params = {
    amount: quote.totalCents,
    currency: quote.currency,
    receipt_email: input.email,
    description: `Eurailo trip ${input.trip.start} → ${input.trip.stops.at(-1).name} · ${quote.tickets.length} tickets`,
    metadata: {
      booking_id: booking.id,
      tickets: quote.tickets.map((t) => `${t.id}:${t.operator}:${t.totalCents}`).join(',').slice(0, 500),
    },
  }

  try {
    let intent
    if (booking.paymentIntentId) {
      intent = await stripe.paymentIntents.update(booking.paymentIntentId, params)
    } else {
      intent = await stripe.paymentIntents.create(
        { ...params, automatic_payment_methods: { enabled: true } },
        { idempotencyKey: `booking-${booking.id}` },
      )
      booking.paymentIntentId = intent.id
    }
    await saveBooking(booking)
    res.json({ bookingId: booking.id, clientSecret: intent.client_secret, quote })
  } catch (err) {
    console.error('Stripe error', err)
    res.status(502).json({ error: err.message ?? 'Could not start the payment.' })
  }
})

// The confirmation page polls this. We re-check Stripe so it works without the webhook too.
app.get('/api/bookings/:id', async (req, res) => {
  const booking = await getBooking(req.params.id)
  if (!booking) return res.status(404).json({ error: 'Booking not found' })
  if (stripe && booking.paymentIntentId && booking.status !== 'paid') {
    try {
      const intent = await stripe.paymentIntents.retrieve(booking.paymentIntentId, { expand: ['latest_charge'] })
      await applyPaymentIntent(booking, intent)
    } catch (err) {
      console.error('Could not refresh payment', err.message)
    }
  }
  res.json(publicBooking(booking))
})

// Add one train ride to Apple Wallet (.pkpass file) or Google Wallet (a save link).
app.get('/api/bookings/:id/legs/:leg/wallet/:kind', async (req, res) => {
  const booking = await getBooking(req.params.id)
  if (!booking) return res.status(404).json({ error: 'Booking not found' })
  if (booking.status !== 'paid') return res.status(409).json({ error: 'Wallet passes are ready once the payment is through.' })
  const leg = Number(req.params.leg)
  try {
    if (req.params.kind === 'google') return res.json({ url: googleSaveUrl(booking, leg) })
    if (req.params.kind === 'apple') {
      const file = await applePass(booking, leg)
      res.set({ 'Content-Type': 'application/vnd.apple.pkpass', 'Content-Disposition': `attachment; filename="${booking.id}-${leg + 1}.pkpass"` })
      return res.send(file)
    }
    res.status(404).json({ error: 'Unknown wallet.' })
  } catch (err) {
    if (err instanceof WalletError) return res.status(err.status).json({ error: err.message })
    console.error('Wallet pass error', err)
    res.status(500).json({ error: 'Could not create the wallet pass.' })
  }
})

// ---------- helpers ----------

function newBooking() {
  return {
    id: `EU-${randomBytes(4).toString('hex').toUpperCase()}`,
    status: 'awaiting_payment',
    createdAt: new Date().toISOString(),
    paymentIntentId: null,
  }
}

const STATUS = { succeeded: 'paid', processing: 'processing', requires_payment_method: 'awaiting_payment', requires_action: 'awaiting_payment', canceled: 'canceled' }

async function applyPaymentIntent(booking, intent) {
  const status = STATUS[intent.status] ?? 'awaiting_payment'
  if (booking.status === 'paid') return
  booking.status = status
  if (typeof intent.latest_charge === 'object' && intent.latest_charge?.receipt_url) {
    booking.receiptUrl = intent.latest_charge.receipt_url
  }
  if (status === 'paid') {
    booking.paidAt = new Date().toISOString()
    requestTickets(booking)
  }
  await saveBooking(booking)
}

// Payment is in: now each ticket has to be bought from its rail company.
// We don't have operator booking APIs connected yet, so tickets are queued as "requested"
// and stay that way until an operator integration (or a person) issues them and fills in
// `reference`. This is the one place to plug those integrations in.
function requestTickets(booking) {
  for (const t of booking.tickets) if (t.status === 'not_booked') t.status = 'requested'
}

function publicBooking(b) {
  return {
    id: b.id,
    status: b.status,
    email: b.email,
    travellers: b.travellers,
    trip: b.trip,
    quote: b.quote,
    tickets: b.tickets,
    receiptUrl: b.receiptUrl ?? null,
    paidAt: b.paidAt ?? null,
  }
}

const STATION_NAMES = new Set(STATIONS.map((s) => s.name))
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

function validate(body) {
  const { trip, travellers, email } = body ?? {}
  if (!trip || !STATION_NAMES.has(trip.start)) return { error: 'Unknown departure station.' }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trip.startDate ?? '')) return { error: 'Invalid departure date.' }
  if (trip.startDate < new Date().toISOString().slice(0, 10)) return { error: 'That departure date is in the past.' }
  if (!OPTIONS.some((o) => o.id === trip.optionId)) return { error: 'Unknown package.' }
  if (!Array.isArray(trip.stops) || trip.stops.length < 1 || trip.stops.length > 15) return { error: 'Pick between 1 and 15 stops.' }
  const stops = []
  for (const s of trip.stops) {
    const days = Number(s?.days)
    if (!STATION_NAMES.has(s?.name) || !Number.isInteger(days) || days < 1 || days > 60) return { error: 'Invalid stop in the route.' }
    stops.push({ name: s.name, days })
  }
  // Optional chosen train times per leg; anything unexpected is simply dropped.
  const departures = {}
  for (const [key, time] of Object.entries(trip.departures ?? {}).slice(0, 20)) {
    const [from, to] = String(key).split('>')
    if (STATION_NAMES.has(from) && STATION_NAMES.has(to) && (DEPARTURE_TIMES.includes(time) || time === NIGHT_TRAIN.departs)) departures[key] = time
  }
  // Optional kind of train per leg (one of the trip options); anything unexpected is dropped.
  const fares = {}
  for (const [key, fare] of Object.entries(trip.fares ?? {}).slice(0, 20)) {
    const [from, to] = String(key).split('>')
    if (STATION_NAMES.has(from) && STATION_NAMES.has(to) && OPTIONS.some((o) => o.id === fare)) fares[key] = fare
  }
  if (!Array.isArray(travellers) || travellers.length < 1 || travellers.length > MAX_TRAVELLERS) {
    return { error: `Between 1 and ${MAX_TRAVELLERS} travellers per booking.` }
  }
  const people = travellers.map((p) => ({
    firstName: String(p?.firstName ?? '').trim().slice(0, 60),
    lastName: String(p?.lastName ?? '').trim().slice(0, 60),
  }))
  if (people.some((p) => !p.firstName || !p.lastName)) return { error: 'Every traveller needs a first and last name.' }
  const mail = String(email ?? '').trim()
  if (!EMAIL.test(mail)) return { error: 'Please enter a valid email address.' }
  // Passes and discount cards the travellers hold: unknown ids are dropped, and we reprice with them.
  const passes = cleanPasses(trip.passes)
  return { trip: { start: trip.start, startDate: trip.startDate, optionId: trip.optionId, stops, departures, fares, passes }, travellers: people, email: mail }
}

app.listen(PORT, () => {
  console.log(`Eurailo API on http://localhost:${PORT}`)
  if (!stripe) console.warn('⚠ STRIPE_SECRET_KEY is not set: checkout will show a setup message.')
  else if (!/^(sk|rk)_test_/.test(STRIPE_SECRET_KEY)) console.warn('⚠ Using a LIVE Stripe key: real cards will be charged.')
  if (!STRIPE_WEBHOOK_SECRET) console.warn('ℹ No STRIPE_WEBHOOK_SECRET: payment status is read from Stripe when the confirmation page loads.')
})
