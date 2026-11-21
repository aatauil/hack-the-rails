import { useEffect, useMemo, useState } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, PaymentElement, ExpressCheckoutElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { buildQuote, money, OPERATORS, MAX_TRAVELLERS } from './tickets.js'
import { PriceBreakdown } from './Tickets.jsx'
import { fmtTime } from './trip.js'

// Stripe.js is loaded once, with the publishable key the server hands out.
let stripePromise = null
function useStripeConfig() {
  const [config, setConfig] = useState(null)
  useEffect(() => {
    fetch('/api/config')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('API unreachable'))))
      .then((c) => {
        if (c.configured && !stripePromise) stripePromise = loadStripe(c.publishableKey)
        setConfig(c)
      })
      .catch(() => setConfig({ configured: false, unreachable: true }))
  }, [])
  return config
}

const APPEARANCE = {
  theme: 'stripe',
  variables: {
    colorPrimary: '#0b7a6b',
    colorText: '#111111',
    fontFamily: 'Inter, system-ui, sans-serif',
    borderRadius: '10px',
    spacingUnit: '4px',
  },
  rules: { '.Input': { border: '1.5px solid #d4d4d4', boxShadow: 'none' }, '.Label': { fontWeight: '600' } },
}
const FONTS = [{ cssSrc: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;800&display=swap' }]

const emptyTraveller = () => ({ firstName: '', lastName: '' })
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export default function Checkout({ start, startDate, stops, departures = {}, optionId, passes = [], onBack, onPaid }) {
  const config = useStripeConfig()
  const [travellers, setTravellers] = useState([emptyTraveller()])
  const [email, setEmail] = useState('')
  const [payment, setPayment] = useState(null) // { bookingId, clientSecret, quote, signature }
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [touched, setTouched] = useState(false)

  const trip = useMemo(
    () => ({
      start: start.name,
      startDate,
      optionId,
      stops: stops.map((s) => ({ name: s.name, days: s.days })),
      departures, // trains the traveller picked on the overview ("Paris>Geneva": "09:30")
      passes, // passes and discount cards they hold; the server reprices with them too
    }),
    [start, startDate, optionId, stops, departures, passes],
  )
  const quote = useMemo(() => buildQuote({ ...trip, travellers: travellers.length }), [trip, travellers.length])

  // Payment is tied to the exact details it was created for; editing them sends you back a step.
  const signature = JSON.stringify({ trip, travellers, email })
  const paymentReady = payment && payment.signature === signature

  const detailsValid = travellers.every((p) => p.firstName.trim() && p.lastName.trim()) && EMAIL.test(email.trim())

  const setCount = (n) => {
    const count = Math.min(MAX_TRAVELLERS, Math.max(1, n))
    setTravellers((prev) => (count > prev.length ? [...prev, ...Array.from({ length: count - prev.length }, emptyTraveller)] : prev.slice(0, count)))
  }
  const editTraveller = (i, field, value) =>
    setTravellers((prev) => prev.map((p, j) => (j === i ? { ...p, [field]: value } : p)))

  const continueToPayment = async (e) => {
    e.preventDefault()
    setTouched(true)
    if (!detailsValid) return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trip, travellers, email: email.trim(), bookingId: payment?.bookingId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Something went wrong.')
      if (data.free) return onPaid(data.bookingId) // passes cover the whole trip
      setPayment({ ...data, signature })
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const fieldError = (v) => touched && !v.trim()

  return (
    <div className="checkout">
      <header className="ov-head">
        <button className="ghost" onClick={onBack}>← Back to packages</button>
        <div className="ov-title">
          <h1>Checkout</h1>
          <p>{quote.optionTag} · {start.name} → {stops.at(-1).name}</p>
        </div>
      </header>

      <div className="co-grid">
        <aside className="co-summary">
          <TripSummary quote={quote} start={start} stops={stops} />
        </aside>

        <main className="co-main">
          <form className="co-card" onSubmit={continueToPayment} noValidate>
            <h2><span className="co-step">1</span> Who’s travelling</h2>
            <div className="co-count">
              <span>Travellers</span>
              <div className="days">
                <button type="button" onClick={() => setCount(travellers.length - 1)} disabled={travellers.length <= 1} aria-label="One traveller less">−</button>
                <span>{travellers.length}</span>
                <button type="button" onClick={() => setCount(travellers.length + 1)} disabled={travellers.length >= MAX_TRAVELLERS} aria-label="One traveller more">+</button>
              </div>
            </div>
            <p className="co-hint">Use names exactly as on each passport or ID card: several rail companies print them on the ticket.</p>
            {travellers.map((p, i) => (
              <fieldset className="co-person" key={i}>
                <legend>Traveller {i + 1}{i === 0 ? ' · lead' : ''}</legend>
                <label className={fieldError(p.firstName) ? 'invalid' : ''}>
                  First name
                  <input value={p.firstName} autoComplete={i === 0 ? 'given-name' : 'off'} onChange={(e) => editTraveller(i, 'firstName', e.target.value)} />
                </label>
                <label className={fieldError(p.lastName) ? 'invalid' : ''}>
                  Last name
                  <input value={p.lastName} autoComplete={i === 0 ? 'family-name' : 'off'} onChange={(e) => editTraveller(i, 'lastName', e.target.value)} />
                </label>
              </fieldset>
            ))}
            <label className={`co-email ${touched && !EMAIL.test(email.trim()) ? 'invalid' : ''}`}>
              Email for your tickets
              <input type="email" value={email} autoComplete="email" placeholder="you@example.com" onChange={(e) => setEmail(e.target.value)} />
              <small>Each rail company’s e-ticket is sent here as soon as it’s issued, so they may arrive separately.</small>
            </label>
            {!paymentReady && (
              <button className="primary big co-continue" type="submit" disabled={busy || (config?.configured === false && quote.totalCents > 0)}>
                {busy ? 'Preparing payment…' : quote.totalCents === 0 ? 'Book with my passes · nothing to pay' : payment ? 'Update and continue' : 'Continue to payment'}
              </button>
            )}
            {error && <div className="co-error">{error}</div>}
          </form>

          {quote.totalCents > 0 && (
          <section className={`co-card ${paymentReady ? '' : 'co-locked'}`}>
            <h2><span className="co-step">2</span> Payment</h2>
            {config === null && <p className="co-hint">Loading payment options…</p>}
            {config?.configured === false && <SetupNotice unreachable={config.unreachable} />}
            {config?.configured && !paymentReady && (
              <p className="co-hint">{payment ? 'You changed your details: confirm them above to update the payment.' : 'Fill in who’s travelling to see payment options.'}</p>
            )}
            {config?.configured && paymentReady && (
              <Elements
                key={payment.clientSecret + payment.quote.totalCents}
                stripe={stripePromise}
                options={{ clientSecret: payment.clientSecret, appearance: APPEARANCE, fonts: FONTS }}
              >
                <PayForm bookingId={payment.bookingId} quote={payment.quote} email={email.trim()} onPaid={onPaid} />
              </Elements>
            )}
          </section>
          )}
        </main>
      </div>
    </div>
  )
}

function PayForm({ bookingId, quote, email, onPaid }) {
  const stripe = useStripe()
  const elements = useElements()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [expressShown, setExpressShown] = useState(false)

  const returnUrl = `${window.location.origin}/?booking=${encodeURIComponent(bookingId)}`

  // Apple Pay / Google Pay / Link have already collected everything; the form needs validating first.
  const confirm = async ({ express = false } = {}) => {
    if (!stripe || !elements) return
    setBusy(true)
    setError(null)
    if (!express) {
      const { error: submitError } = await elements.submit()
      if (submitError) {
        setError(submitError.message)
        setBusy(false)
        return
      }
    }
    // Cards usually finish here; bank redirects (iDEAL, Bancontact…) come back via returnUrl.
    const { error: payError } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: returnUrl, receipt_email: email },
      redirect: 'if_required',
    })
    if (payError) {
      setError(payError.message)
      setBusy(false)
      return
    }
    onPaid(bookingId)
  }

  return (
    <div className="pay">
      <ExpressCheckoutElement
        options={{ buttonHeight: 48 }}
        onReady={({ availablePaymentMethods }) => setExpressShown(Boolean(availablePaymentMethods))}
        onConfirm={() => confirm({ express: true })}
      />
      {expressShown && <div className="pay-or"><span>or pay another way</span></div>}
      <PaymentElement options={{ layout: 'tabs', defaultValues: { billingDetails: { email } } }} />
      <button className="primary big pay-btn" onClick={() => confirm()} disabled={!stripe || busy}>
        {busy ? 'Processing…' : `Pay ${money(quote.totalCents)}`}
      </button>
      {error && <div className="co-error">{error}</div>}
      <p className="pay-note">
        🔒 Payments are processed securely by Stripe. Your card statement shows one payment to Eurailo; we then pay
        {' '}{quote.operators.length === 1 ? OPERATORS[quote.operators[0].operator].name : `the ${quote.operators.length} rail companies`} for your tickets.
      </p>
    </div>
  )
}

const fmtDay = (iso) => new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })

// The total up top, then the trip as a simple line of stops: when you leave, when you arrive, how long you stay.
function TripSummary({ quote, start, stops }) {
  const legs = []
  for (const t of quote.tickets) (legs[t.legIndex] ??= []).push(t)
  return (
    <div className="co-card co-trip">
      <div className="co-total">
        <span className="co-total-label">Total{quote.travellers > 1 ? ` · ${quote.travellers} travellers` : ''}</span>
        <span className="co-total-price">{money(quote.totalCents)}</span>
        {quote.passSavingsCents > 0 && <span className="co-total-saved">You save {money(quote.passSavingsCents)} with your passes</span>}
      </div>

      <ol className="co-stops">
        <li className="co-stop">
          <div className="co-place">
            <span className="co-dot" />
            <strong>{start.name}</strong>
            <small>Start</small>
          </div>
        </li>
        {stops.map((s, i) => {
          const leg = legs[i]
          const changes = leg ? leg.length - 1 : 0
          return (
            <li className="co-stop" key={i}>
              {leg && (
                <div className="co-ride">
                  {fmtDay(leg[0].depart)} · {fmtTime(new Date(leg[0].depart))} → {fmtTime(new Date(leg.at(-1).arrive))}
                  {changes > 0 && <span> · {changes} {changes === 1 ? 'change' : 'changes'}</span>}
                </div>
              )}
              <div className="co-place">
                <span className="co-dot" />
                <strong>{s.name}</strong>
                <small>{s.days} {s.days === 1 ? 'day' : 'days'}</small>
              </div>
            </li>
          )
        })}
      </ol>

      <details className="co-details">
        <summary>Price details</summary>
        <PriceBreakdown quote={quote} />
      </details>
    </div>
  )
}

function SetupNotice({ unreachable }) {
  return (
    <div className="co-setup">
      <strong>{unreachable ? 'The payment server isn’t running.' : 'Stripe isn’t connected yet.'}</strong>
      <p>
        {unreachable
          ? 'Start everything with npm run dev (it runs the API and the site together).'
          : 'Add STRIPE_SECRET_KEY and STRIPE_PUBLISHABLE_KEY to .env (see .env.example), then restart npm run dev.'}
      </p>
    </div>
  )
}
