import { formatDuration, formatKg } from './trip.js'
import { money } from './tickets.js'
import { LEVELS } from './insights.js'

export function LevelIcon({ level }) {
  return <span className={`lv lv-${level}`} aria-label={LEVELS[level].label}>{LEVELS[level].icon}</span>
}

// Headline numbers for the whole trip, always in the same order.
export function TotalsBar({ totals }) {
  const t = totals
  return (
    <section className="totals" aria-label="Trip totals">
      <div className="tot">
        <span className="tot-v">{t.days}</span>
        <span className="tot-l">days</span>
      </div>
      <div className="tot">
        <span className="tot-v">{t.cities}</span>
        <span className="tot-l">{t.cities === 1 ? 'city' : 'cities'} · {t.countries} {t.countries === 1 ? 'country' : 'countries'}</span>
      </div>
      <div className="tot">
        <span className="tot-v">{formatDuration(t.travelMin)}</span>
        <span className="tot-l">on trains · {Math.round(t.travelShare * 100)}% of your waking hours</span>
        <span className="tot-bar"><i style={{ width: `${Math.min(100, t.travelShare * 100)}%` }} /></span>
      </div>
      <div className="tot">
        <span className="tot-v">{money(t.totalCents)}</span>
        <span className="tot-l">
          tickets {money(t.ticketsCents)}
          {t.reservations > 0 && ` · ${t.reservations} seat ${t.reservations === 1 ? 'reservation' : 'reservations'} included`}
          {t.feeCents > 0 ? ` · fee ${money(t.feeCents)}` : ' · no booking fee'}
        </span>
      </div>
      <div className="tot green">
        <span className="tot-v">🌱 {formatKg(t.co2Kg)}</span>
        <span className="tot-l">CO₂ · {formatKg(t.savedKg)} less than flying</span>
      </div>
    </section>
  )
}

// Rail pass versus separate tickets, per person.
export function PassCompare({ cmp }) {
  if (!cmp) {
    return (
      <section className="pass card">
        <h2>Rail pass or tickets?</h2>
        <p className="muted">This trip is too long for a single rail pass, so separate tickets are the way to go.</p>
      </section>
    )
  }
  const max = Math.max(cmp.ticketsCents, cmp.passTotalCents)
  const w = (c) => `${(c / max) * 100}%`
  const ticketsWin = cmp.winner === 'tickets'
  return (
    <section className="pass card">
      <h2>Rail pass or tickets?</h2>
      <p className={`pass-verdict ${ticketsWin ? 'good' : 'warn'}`}>
        {ticketsWin
          ? <>Your tickets are <strong>{money(cmp.savingCents)} cheaper</strong> than a rail pass</>
          : <>A rail pass would be <strong>{money(cmp.savingCents)} cheaper</strong> for this trip</>}
      </p>
      <div className="pass-rows">
        <div className="pass-row">
          <span className="pass-l">Your tickets <small>reservations included</small></span>
          <span className="pass-track"><i className="tk" style={{ width: w(cmp.ticketsCents) }} /></span>
          <span className="pass-v">{money(cmp.ticketsCents)}</span>
        </div>
        <div className="pass-row">
          <span className="pass-l">{cmp.pass.travelDays}-day rail pass <small>+ {money(cmp.reservationsCents)} reservations</small></span>
          <span className="pass-track">
            <i className="ps" style={{ width: w(cmp.pass.cents) }} />
            <i className="rs" style={{ width: w(cmp.reservationsCents) }} />
          </span>
          <span className="pass-v">{money(cmp.passTotalCents)}</span>
        </div>
      </div>
      <p className="muted small">
        Per person, 2nd class. You travel on {cmp.travelDays} {cmp.travelDays === 1 ? 'day' : 'days'}; the pass price is an estimate.
        {!ticketsWin && ' Eurailo doesn’t sell passes yet. If you already have one, you only need the seat reservations.'}
      </p>
    </section>
  )
}

// Train versus plane, city centre to city centre. Booking sites only show the time in the
// air; here every step of flying is on the bar, so the comparison is a fair one.
const STEP_CLASS = { transfer: 'fs-transfer', airport: 'fs-airport', air: 'fs-air', bags: 'fs-bags', station: 'fs-station', ride: 'fs-ride', sleep: 'fs-sleep' }

function StepBar({ steps, total, max }) {
  return (
    <span className="fc-track" style={{ width: `${(total / max) * 100}%` }}>
      {steps.map((s, i) => (
        <i key={i} className={STEP_CLASS[s.id]} style={{ flexGrow: s.min }} title={`${s.label}: ${formatDuration(s.min)}`} />
      ))}
    </span>
  )
}

const PlaneIcon = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
    <path fill="currentColor" d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" />
  </svg>
)

// Two headline numbers against the plane; the per-leg, step-by-step bars stay folded.
export function FlyCompare({ cmp }) {
  const max = Math.max(...cmp.legs.map((l) => Math.max(l.trainMin, l.planeMin)))
  const canFly = cmp.flyableLegs > 0
  const quicker = cmp.savedMin >= 0
  const hotels = cmp.nightLegs.length
  return (
    <section className="flycmp" aria-label="Train versus flying, door to door">
      <div className="fc-head">
        <span className="fc-plane"><PlaneIcon /></span>
        <div>
          <h2>Compared with flying</h2>
          <p>Door to door, city centre to city centre</p>
        </div>
      </div>

      <div className="fc-stats">
        <div className="fc-stat good">
          <span className="fc-stat-v">{formatKg(cmp.co2SavedKg)}</span>
          <span className="fc-stat-l">less CO₂</span>
        </div>
        <div className={`fc-stat ${canFly && quicker ? 'good' : ''}`}>
          <span className="fc-stat-v">{canFly ? formatDuration(Math.abs(cmp.savedMin)) : '—'}</span>
          <span className="fc-stat-l">{!canFly ? 'few direct flights' : quicker ? 'time saved' : 'longer than flying'}</span>
        </div>
      </div>

      <details className="fc-more">
        <summary>How we compare</summary>
        <div className="fc-legs">
          {cmp.legs.map((l) => (
            <div key={`${l.from}>${l.to}`} className="fc-leg">
              <div className="fc-leg-name">{l.from} → {l.to}{l.night && <span className="fc-tag night">🌙 Night train</span>}</div>
              <div className="fc-row">
                <span className="fc-l">Train</span>
                <StepBar steps={l.train} total={l.trainMin} max={max} />
                <span className="fc-v">{formatDuration(l.trainMin)}</span>
              </div>
              {l.shortHop ? (
                <div className="fc-row"><span className="fc-l">Plane</span><span className="fc-none">No direct flights</span></div>
              ) : (
                <div className="fc-row">
                  <span className="fc-l">Plane</span>
                  <StepBar steps={l.plane} total={l.planeMin} max={max} />
                  <span className="fc-v">{formatDuration(l.planeMin)}</span>
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="fc-legend">
          <span><i className="fs-ride" /> Train</span>
          {hotels > 0 && <span><i className="fs-sleep" /> Asleep on board</span>}
          <span><i className="fs-station" /> Station</span>
          <span><i className="fs-transfer" /> To / from airport</span>
          <span><i className="fs-airport" /> Airport, 2h early</span>
          <span><i className="fs-air" /> Flight</span>
          <span><i className="fs-bags" /> Bags</span>
        </div>
        {hotels > 0 && (
          <p className="muted small">The night train is also your bed: about €{cmp.hotelSavedEur} saved on {hotels === 1 ? 'a hotel night' : `${hotels} hotel nights`}, and those hours don’t count as travel time.</p>
        )}
        <p className="muted small">Estimates. Flying includes getting to the airport, arriving 2 hours early, the flight, bags and getting into town.</p>
      </details>
    </section>
  )
}
