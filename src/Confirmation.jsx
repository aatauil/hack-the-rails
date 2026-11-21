import { useEffect, useState } from 'react'
import TicketWallet from './TicketWallet.jsx'

const fmtDate = (iso) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

// After payment (or when Stripe sends you back from a bank page): one Hippity Hop pass for
// the whole trip, with each train ride as its own ticket underneath (swipe between them).
// `mock` is a ready-made booking (dev shortcut from the overview), so nothing is fetched.
export default function Confirmation({ bookingId, mock, onDone }) {
  const [fetched, setFetched] = useState(null)
  const [error, setError] = useState(null)
  const booking = mock ?? fetched

  useEffect(() => {
    if (mock) return
    let stop = false
    let timer
    const load = async () => {
      try {
        const res = await fetch(`/api/bookings/${encodeURIComponent(bookingId)}`)
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Could not load your booking.')
        if (stop) return
        setFetched(data)
        // Keep checking while the payment settles or tickets are still being issued.
        const pending = data.status === 'processing' || data.tickets.some((t) => t.status === 'requested')
        if (pending) timer = setTimeout(load, data.status === 'processing' ? 2000 : 15000)
      } catch (err) {
        if (!stop) setError(err.message)
      }
    }
    load()
    return () => {
      stop = true
      clearTimeout(timer)
    }
  }, [bookingId, mock])

  if (error) return <Shell onDone={onDone}><div className="co-error">{error}</div></Shell>
  if (!booking) return <Shell onDone={onDone}><p className="co-hint">Loading your booking…</p></Shell>

  if (booking.status !== 'paid' && booking.status !== 'processing') {
    return (
      <Shell onDone={onDone}>
        <div className="cf-msg">
          <h1>Payment didn’t go through</h1>
          <p>Nothing was charged and no tickets were booked. Go back and try again with another payment method.</p>
        </div>
      </Shell>
    )
  }

  const paid = booking.status === 'paid'

  return (
    <Shell onDone={onDone}>
      <div className="cf-msg">
        <h1>{paid ? 'You’re all booked!' : 'Confirming your payment…'}</h1>
        <p>{paid ? 'Show this pass in Hippity Hop to see every ticket for your trip.' : 'Your bank is still confirming. This page updates by itself.'}</p>
      </div>
      <Pass booking={booking} />
      <TicketWallet booking={booking} showStatus={paid} />
    </Shell>
  )
}

// The one ticket that matters: the Hippity Hop pass. Its QR opens every train ticket in the app.
function Pass({ booking }) {
  const { trip, tickets } = booking
  const first = tickets[0]
  const last = tickets.at(-1)
  return (
    <article className="cf-pass">
      <div className="cf-pass-main">
        <img className="cf-pass-logo" src="/brand/hippity-hop-logo-primary.svg" alt="Hippity Hop" />
        <div className="cf-pass-route">{trip.start} → {trip.stops.at(-1).name}</div>
        <div className="cf-pass-meta">
          {fmtDate(first.depart)} – {fmtDate(last.arrive)} · {trip.stops.length} {trip.stops.length === 1 ? 'stop' : 'stops'} · {tickets.length} {tickets.length === 1 ? 'train' : 'trains'}
        </div>
        <div className="cf-pass-ref">{booking.id}</div>
      </div>
      <div className="cf-pass-stub">
        <QR value={booking.id} />
        <small>Scan in Hippity Hop</small>
      </div>
    </article>
  )
}

// A QR-style code drawn from the booking id. Placeholder until the app has real pass links.
function QR({ value, size = 25 }) {
  let h = 2166136261
  for (const c of value) h = Math.imul(h ^ c.charCodeAt(0), 16777619)
  const rand = () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909)) >>> 0) / 4294967296
  const finder = (x, y) => [[0, 0], [size - 7, 0], [0, size - 7]].some(([fx, fy]) => x >= fx - 1 && x <= fx + 7 && y >= fy - 1 && y <= fy + 7)
  const cells = []
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!finder(x, y) && rand() < 0.5) cells.push(`M${x} ${y}h1v1h-1z`)
  const eye = (x, y) => (
    <g key={`${x}-${y}`}>
      <rect x={x} y={y} width="7" height="7" />
      <rect x={x + 1} y={y + 1} width="5" height="5" fill="#fff" />
      <rect x={x + 2} y={y + 2} width="3" height="3" />
    </g>
  )
  return (
    <svg className="cf-qr" viewBox={`-1 -1 ${size + 2} ${size + 2}`} role="img" aria-label="Pass QR code" shapeRendering="crispEdges">
      <rect x="-1" y="-1" width={size + 2} height={size + 2} fill="#fff" />
      <path d={cells.join('')} />
      {eye(0, 0)}{eye(size - 7, 0)}{eye(0, size - 7)}
    </svg>
  )
}

function Shell({ children, onDone }) {
  return (
    <div className="cf">
      <header className="cf-head">
        <button className="ghost" onClick={onDone}>Plan another trip</button>
      </header>
      {children}
    </div>
  )
}
