import { useEffect, useState } from 'react'
import { TicketList, PriceBreakdown, OperatorBadge } from './Tickets.jsx'
import { OPERATORS, money } from './tickets.js'

// After payment (or when Stripe sends you back from a bank page): what you paid and
// where each ticket is with its rail company.
export default function Confirmation({ bookingId, onDone }) {
  const [booking, setBooking] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let stop = false
    let timer
    const load = async () => {
      try {
        const res = await fetch(`/api/bookings/${encodeURIComponent(bookingId)}`)
        const data = await res.json()
        if (!res.ok) throw new Error(data.error ?? 'Could not load your booking.')
        if (stop) return
        setBooking(data)
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
  }, [bookingId])

  if (error) return <Shell onDone={onDone}><div className="co-error">{error}</div></Shell>
  if (!booking) return <Shell onDone={onDone}><p className="co-hint">Loading your booking…</p></Shell>

  const { quote, trip } = booking
  const issued = booking.tickets.filter((t) => t.status === 'issued').length

  if (booking.status !== 'paid' && booking.status !== 'processing') {
    return (
      <Shell onDone={onDone}>
        <div className="cf-hero bad">
          <h1>Payment didn’t go through</h1>
          <p>Nothing was charged and no tickets were booked. You can go back and try again with another payment method.</p>
        </div>
      </Shell>
    )
  }

  return (
    <Shell onDone={onDone}>
      <div className={`cf-hero ${booking.status === 'paid' ? 'ok' : ''}`}>
        <div className="cf-ref">Booking {booking.id}</div>
        <h1>{booking.status === 'paid' ? `You’re going to ${trip.stops.at(-1).name}! 🎉` : 'Confirming your payment…'}</h1>
        <p>
          {booking.status === 'paid'
            ? <>We received {money(quote.totalCents)}. Now we’re booking your {quote.tickets.length} tickets with {quote.operators.length} rail {quote.operators.length === 1 ? 'company' : 'companies'}; each e-ticket goes to <strong>{booking.email}</strong> as soon as it’s issued.</>
            : 'Your bank is still confirming the payment. This page updates by itself.'}
        </p>
        {booking.receiptUrl && <a className="cf-receipt" href={booking.receiptUrl} target="_blank" rel="noreferrer">View payment receipt ↗</a>}
      </div>

      {booking.status === 'paid' && (
        <ol className="cf-steps">
          <li className="done"><span>✓</span>Payment received</li>
          <li className={issued === quote.tickets.length ? 'done' : 'now'}>
            <span>{issued === quote.tickets.length ? '✓' : '2'}</span>Tickets issued by rail companies ({issued}/{quote.tickets.length})
          </li>
          <li className={issued === quote.tickets.length ? 'done' : ''}><span>3</span>E-tickets in your inbox</li>
        </ol>
      )}

      <div className="cf-grid">
        <div className="co-card">
          <h2>Your tickets</h2>
          <TicketList quote={{ ...quote, tickets: booking.tickets }} showStatus={booking.status === 'paid'} />
        </div>
        <div className="co-card">
          <h2>Who you’ll hear from</h2>
          <ul className="cf-ops">
            {quote.operators.map((o) => (
              <li key={o.operator}>
                <OperatorBadge id={o.operator} />
                <div>
                  <strong>{OPERATORS[o.operator].name}</strong>
                  <small>{o.tickets} {o.tickets === 1 ? 'ticket' : 'tickets'} · {OPERATORS[o.operator].delivery}</small>
                </div>
              </li>
            ))}
          </ul>
          <h2>Travellers</h2>
          <p className="cf-people">{booking.travellers.map((p) => `${p.firstName} ${p.lastName}`).join(', ')}</p>
          <h2>What you paid</h2>
          <PriceBreakdown quote={quote} />
        </div>
      </div>
    </Shell>
  )
}

function Shell({ children, onDone }) {
  return (
    <div className="checkout">
      <header className="ov-head">
        <div className="brand">🚆 Eurailo</div>
        <div style={{ flex: 1 }} />
        <button className="ghost" onClick={onDone}>Plan another trip</button>
      </header>
      {children}
    </div>
  )
}
