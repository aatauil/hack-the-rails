// After payment: one horizontal ticket per train ride (per destination), side by side.
// Swipe, use the arrows or tap a city to move through the trip, and add each ride to
// Apple or Google Wallet.
import { Fragment, useEffect, useRef, useState } from 'react'
import { OPERATORS } from './tickets.js'
import { fmtTime } from './trip.js'
import { OperatorBadge } from './Tickets.jsx'

const fmtDay = (iso) => new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
const fmtDuration = (a, b) => {
  const min = Math.round((new Date(b) - new Date(a)) / 60000)
  return `${Math.floor(min / 60)}h${String(min % 60).padStart(2, '0')}`
}

export default function TicketWallet({ booking, showStatus = true }) {
  const legs = []
  for (const t of booking.tickets) (legs[t.legIndex] ??= []).push(t)
  const rides = legs.filter(Boolean)

  const track = useRef(null)
  const [active, setActive] = useState(0)

  // Follow the slide closest to the centre while the traveller swipes.
  useEffect(() => {
    const el = track.current
    if (!el) return
    const onScroll = () => {
      const mid = el.scrollLeft + el.clientWidth / 2
      let best = 0
      let bestDist = Infinity
      ;[...el.children].forEach((child, i) => {
        const d = Math.abs(child.offsetLeft + child.offsetWidth / 2 - mid)
        if (d < bestDist) { bestDist = d; best = i }
      })
      setActive(best)
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  const go = (i) => {
    const el = track.current
    const child = el?.children[Math.max(0, Math.min(rides.length - 1, i))]
    if (child) el.scrollTo({ left: child.offsetLeft - (el.clientWidth - child.offsetWidth) / 2, behavior: 'smooth' })
  }

  const onKey = (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); go(active + 1) }
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(active - 1) }
  }

  return (
    <section className="tw" aria-roledescription="carousel" aria-label="Your trains">
      <div className="tw-head">
        <h2 className="cf-sub">Your trains</h2>
        {rides.length > 1 && (
          <div className="tw-arrows">
            <button className="tw-arrow" onClick={() => go(active - 1)} disabled={active === 0} aria-label="Previous train">←</button>
            <button className="tw-arrow" onClick={() => go(active + 1)} disabled={active === rides.length - 1} aria-label="Next train">→</button>
          </div>
        )}
      </div>

      {rides.length > 1 && (
        <nav className="tw-stops" aria-label="Jump to a train">
          {rides.map((tickets, i) => (
            <button key={i} className={i === active ? 'on' : ''} onClick={() => go(i)} aria-current={i === active}>
              <span>{i + 1}</span>{tickets.at(-1).to}
            </button>
          ))}
        </nav>
      )}

      <div className={`tw-track ${rides.length === 1 ? 'single' : ''}`} ref={track} tabIndex={0} onKeyDown={onKey}>
        {rides.map((tickets, i) => (
          <div className="tw-slide" key={i} aria-roledescription="slide" aria-label={`Train ${i + 1} of ${rides.length}`}>
            <RideTicket tickets={tickets} booking={booking} index={i} count={rides.length} showStatus={showStatus} />
            {showStatus && <WalletButtons booking={booking} leg={tickets[0].legIndex} />}
          </div>
        ))}
      </div>
    </section>
  )
}

function RideTicket({ tickets, booking, index, count, showStatus }) {
  const first = tickets[0]
  const last = tickets.at(-1)
  const issued = tickets.every((t) => t.status === 'issued')
  const people = booking.travellers ?? []
  const lead = people[0] ? `${people[0].firstName} ${people[0].lastName}` : ''
  const refs = tickets.filter((t) => t.reference)
  return (
    <article className="rt" style={{ '--c': OPERATORS[first.operator].color }}>
      <div className="rt-main">
        <div className="rt-day">{fmtDay(first.depart)}</div>
        <div className="rt-route">
          <div className="rt-end">
            <strong>{fmtTime(new Date(first.depart))}</strong>
            <span>{first.from}</span>
          </div>
          <div className="rt-line" aria-hidden="true">
            <small>{fmtDuration(first.depart, last.arrive)}</small>
            <i />
          </div>
          <div className="rt-end to">
            <strong>{fmtTime(new Date(last.arrive))}</strong>
            <span>{last.to}</span>
          </div>
        </div>
        <div className="rt-trains">
          {tickets.map((t, k) => (
            <Fragment key={t.id}>
              {k > 0 && <span className="tix-chg">Change in {t.from}</span>}
              <div className="tix-train">
                <OperatorBadge id={t.operator} size="sm" />
                <strong>{t.service}</strong>
                {OPERATORS[t.operator].name !== t.service && <span className="tix-op">{OPERATORS[t.operator].name}</span>}
              </div>
            </Fragment>
          ))}
        </div>
        {lead && <div className="rt-who">{lead}{people.length > 1 ? ` +${people.length - 1}` : ''}</div>}
      </div>
      <div className="rt-stub">
        <span className="rt-num">{index + 1}<small>/{count}</small></span>
        {showStatus && (
          <span className={`cf-status ${issued ? 'ok' : 'wait'}`}>
            {issued ? '✓ Ready' : <><span className="spinner" /> Booking</>}
          </span>
        )}
        <span className="rt-ref">{refs.length ? refs.map((t) => t.reference).join(' · ') : booking.id}</span>
      </div>
    </article>
  )
}

// Apple Wallet gets a .pkpass file; Google Wallet opens its "save" page.
function WalletButtons({ booking, leg }) {
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState(null)

  const add = async (kind) => {
    setError(null)
    if (booking.id.startsWith('EU-MOCK')) {
      setError('This is a demo booking, so there is no wallet pass to add.')
      return
    }
    setBusy(kind)
    try {
      const res = await fetch(`/api/bookings/${encodeURIComponent(booking.id)}/legs/${leg}/wallet/${kind}`)
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? 'Could not create the wallet pass.')
      if (kind === 'google') {
        const { url } = await res.json()
        window.open(url, '_blank', 'noopener')
      } else {
        const blob = await res.blob()
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = `${booking.id}-train-${leg + 1}.pkpass`
        a.click()
        setTimeout(() => URL.revokeObjectURL(a.href), 1000)
      }
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="tw-wallet">
      <div className="tw-wallet-btns">
        <button className="wallet-btn" onClick={() => add('apple')} disabled={!!busy}>
          <AppleGlyph />
          <span><small>Add to</small>Apple Wallet</span>
        </button>
        <button className="wallet-btn" onClick={() => add('google')} disabled={!!busy}>
          <GoogleGlyph />
          <span><small>Add to</small>Google Wallet</span>
        </button>
      </div>
      {error && <p className="tw-wallet-err" role="alert">{error}</p>}
    </div>
  )
}

// Simple stacked-card wallet glyphs, not the platforms' official badge artwork.
const AppleGlyph = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
    <rect x="3" y="4" width="18" height="16" rx="3" fill="#fff" />
    <rect x="3" y="4" width="18" height="5" rx="2" fill="#2DA9F5" />
    <rect x="3" y="7.5" width="18" height="5" rx="2" fill="#FDB52B" />
    <rect x="3" y="11" width="18" height="5" rx="2" fill="#FC3158" />
    <path d="M3 14h5.5a3.5 3.5 0 0 0 7 0H21v3a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3z" fill="#E9E9EB" />
  </svg>
)
const GoogleGlyph = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
    <rect x="3" y="4" width="18" height="7" rx="2.5" fill="#EA4335" />
    <rect x="3" y="7.5" width="18" height="7" rx="2.5" fill="#FBBC04" />
    <rect x="3" y="11" width="18" height="7" rx="2.5" fill="#34A853" />
    <rect x="3" y="14" width="18" height="6" rx="2.5" fill="#4285F4" />
  </svg>
)
