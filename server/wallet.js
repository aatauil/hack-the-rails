// Wallet passes for one train ride of a booking (one ride can hold several operator tickets
// when the traveller changes trains between rail companies).
//
// Google Wallet: works once GOOGLE_WALLET_ISSUER_ID and GOOGLE_WALLET_KEY_FILE (a service
// account JSON key with access to that issuer) are set. We sign a "save to wallet" JWT that
// carries the pass itself, so nothing has to be created on Google's side first.
//
// Apple Wallet: needs a signed .pkpass (a zip of pass.json + images + manifest, signed with a
// Pass Type ID certificate from an Apple Developer account). Not set up yet; `applePass`
// is the place to plug it in (for example with the `passkit-generator` package).

import { readFileSync } from 'node:fs'
import { createSign } from 'node:crypto'
import { OPERATORS } from '../src/tickets.js'

const { GOOGLE_WALLET_ISSUER_ID, GOOGLE_WALLET_KEY_FILE } = process.env

let googleKey = null
if (GOOGLE_WALLET_ISSUER_ID && GOOGLE_WALLET_KEY_FILE) {
  try {
    googleKey = JSON.parse(readFileSync(GOOGLE_WALLET_KEY_FILE, 'utf8'))
  } catch (err) {
    console.error('Could not read GOOGLE_WALLET_KEY_FILE:', err.message)
  }
}

export class WalletError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

const time = (iso) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })
const day = (iso) => new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Europe/Paris' })

// What every pass shows, whichever wallet it goes to.
export function rideDetails(booking, legIndex) {
  const tickets = booking.tickets.filter((t) => t.legIndex === legIndex)
  if (!tickets.length) throw new WalletError(404, 'That train is not part of this booking.')
  const first = tickets[0]
  const last = tickets.at(-1)
  const lead = booking.travellers[0]
  return {
    id: `${booking.id}-${legIndex + 1}`,
    from: first.from,
    to: last.to,
    depart: first.depart,
    arrive: last.arrive,
    passenger: lead ? `${lead.firstName} ${lead.lastName}` + (booking.travellers.length > 1 ? ` +${booking.travellers.length - 1}` : '') : '',
    color: OPERATORS[first.operator].color,
    trains: tickets.map((t) => ({
      operator: OPERATORS[t.operator].name,
      service: t.service,
      from: t.from,
      to: t.to,
      depart: t.depart,
      arrive: t.arrive,
      reference: t.reference,
      status: t.status,
    })),
    // Until the rail company issues its ticket, the code carries our booking reference.
    barcode: tickets.every((t) => t.reference) ? tickets.map((t) => t.reference).join(' ') : booking.id,
  }
}

export function googleSaveUrl(booking, legIndex) {
  if (!googleKey) throw new WalletError(501, 'Google Wallet isn’t set up on this server yet.')
  const ride = rideDetails(booking, legIndex)
  const issuer = GOOGLE_WALLET_ISSUER_ID
  const classId = `${issuer}.eurailo_train`
  const object = {
    id: `${issuer}.${ride.id.replace(/[^\w.-]/g, '_')}`,
    classId,
    state: 'ACTIVE',
    hexBackgroundColor: ride.color,
    cardTitle: { defaultValue: { language: 'en-GB', value: 'Eurailo' } },
    header: { defaultValue: { language: 'en-GB', value: `${ride.from} → ${ride.to}` } },
    subheader: { defaultValue: { language: 'en-GB', value: `${day(ride.depart)} · ${time(ride.depart)}–${time(ride.arrive)}` } },
    textModulesData: [
      { id: 'passenger', header: 'Passenger', body: ride.passenger },
      ...ride.trains.map((t, i) => ({
        id: `train${i}`,
        header: `${time(t.depart)} ${t.from} → ${t.to}`,
        body: `${t.service} · ${t.operator}${t.reference ? ` · ref ${t.reference}` : ' · ticket being issued'}`,
      })),
      { id: 'booking', header: 'Booking', body: booking.id },
    ],
    barcode: { type: 'QR_CODE', value: ride.barcode, alternateText: ride.barcode },
    validTimeInterval: { start: { date: ride.depart }, end: { date: ride.arrive } },
  }
  const claims = {
    iss: googleKey.client_email,
    aud: 'google',
    typ: 'savetowallet',
    iat: Math.floor(Date.now() / 1000),
    payload: { genericClasses: [{ id: classId }], genericObjects: [object] },
  }
  return `https://pay.google.com/gp/v/save/${signJwt(claims, googleKey.private_key)}`
}

export function applePass(_booking, _legIndex) {
  throw new WalletError(501, 'Apple Wallet isn’t set up on this server yet.')
}

const b64url = (buf) => Buffer.from(buf).toString('base64url')

function signJwt(claims, privateKey) {
  const body = `${b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${b64url(JSON.stringify(claims))}`
  const sig = createSign('RSA-SHA256').update(body).sign(privateKey)
  return `${body}.${b64url(sig)}`
}
