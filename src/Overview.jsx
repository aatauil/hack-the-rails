import { Fragment, useMemo, useState } from 'react'
import { STATIONS } from './data.js'
import { planAll, formatDuration, formatKg, fmtDate, fmtTime, DEPARTURE_TIMES, legKey, compareWithFlying, legVersusFlight, nightTrainPossible, NIGHT_TRAIN } from './trip.js'
import { buildQuote, OPERATORS } from './tickets.js'
import { OperatorBadge } from './Tickets.jsx'
import { legNotes, stayNotes, statusOf, tripTotals, passComparison, LEVELS } from './insights.js'
import RouteMap, { KIND_LABEL } from './RouteMap.jsx'
import TripTimeline from './TripTimeline.jsx'
import { TotalsBar, PassCompare, LevelIcon, FlyCompare } from './TripInsights.jsx'
import PassWallet from './PassWallet.jsx'
import { money } from './tickets.js'

const byName = Object.fromEntries(STATIONS.map((s) => [s.name, s]))
const hhmm = (d) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
const dayName = (d) => d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })

// A time on the ticket that is also the train picker: choose by when it leaves, or by when it gets in.
function TimePick({ leg, end, onPick }) {
  const times = nightTrainPossible(leg) ? [...DEPARTURE_TIMES, NIGHT_TRAIN.departs] : DEPARTURE_TIMES
  const label = (t) => {
    if (end === 'depart') return t.replace(':', 'h')
    const [h, m] = t.split(':').map(Number)
    const dep = new Date(leg.depart)
    dep.setHours(h, m, 0, 0)
    const arr = new Date(dep.getTime() + leg.minutes * 60000)
    return `${fmtTime(arr)}${arr.getDate() !== dep.getDate() ? ' +1' : ''}`
  }
  const shown = end === 'depart' ? fmtTime(leg.depart) : fmtTime(leg.arrive)
  const nextDay = end === 'arrive' && leg.arrive.getDate() !== leg.depart.getDate()
  return (
    <span className="it-pick" title="Pick another train">
      {shown}{nextDay && <sup>+1</sup>}
      <select
        value={hhmm(leg.depart)}
        onChange={(e) => onPick(legKey(leg.from, leg.to), e.target.value)}
        aria-label={end === 'depart' ? `Departure time ${leg.from} to ${leg.to}` : `Arrival time in ${leg.to}`}
      >
        {times.map((t) => <option key={t} value={t}>{label(t)}{t === NIGHT_TRAIN.departs ? ' · night train' : ''}</option>)}
      </select>
    </span>
  )
}

function Notes({ notes }) {
  if (!notes.length) return null
  return (
    <ul className="notes">
      {notes.map((n, i) => <li key={i} className={`note ${n.level}`}><LevelIcon level={n.level} /> {n.text}</li>)}
    </ul>
  )
}

// One train ride, drawn as the ticket the traveller will get: who runs it and what it costs.
// Times and dates live on the timeline next to it, so they are not repeated here.
function LegTicket({ i, tickets, notes, status, lit, onHover, vs }) {
  const reservation = tickets.some((t) => t.reservationRequired)
  const warns = notes.filter((n) => n.level === 'warn')
  const tips = notes.filter((n) => n.level !== 'warn')
  const cents = tickets.reduce((n, t) => n + t.totalCents, 0)
  const extras = tips.length > 0 || reservation || vs.night || (!vs.shortHop && vs.savedMin > 0)
  return (
    <article className={`tix ${lit ? 'hl' : ''} ${status}`} onMouseEnter={() => onHover({ type: 'leg', i })} onMouseLeave={() => onHover(null)}>
      <div className="tix-main">
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
        {warns.length > 0 && <Notes notes={warns} />}
        {extras && (
          <details className="leg-more">
            <summary>Details{tips.length ? ` · ${tips.length} tip${tips.length > 1 ? 's' : ''}` : ''}</summary>
            <ul className="tix-facts">
              {reservation && <li>Seat reservation included</li>}
              {vs.night && <li>Sleep on board, saves about €{vs.hotelEur} on a hotel</li>}
              {!vs.night && !vs.shortHop && vs.savedMin > 0 && <li>{formatDuration(vs.savedMin)} quicker than flying, door to door</li>}
            </ul>
            <Notes notes={tips} />
          </details>
        )}
      </div>
      <div className="tix-stub">
        <span className="tix-price">{money(cents)}</span>
      </div>
    </article>
  )
}

// The rail between two cities, drawn per train in the same style as the map.
function Rail({ tickets }) {
  return (
    <span className="ht-rail ride">
      {tickets.map((t, k) => (
        <Fragment key={t.id}>
          {k > 0 && <span className="it-change" title={`Change in ${t.from}`} />}
          <span className={`it-seg ${t.kind}`} />
        </Fragment>
      ))}
    </span>
  )
}

// Days in a city as small dots under the city's dot, one per day.
// Tap a day to stay that many days (tap the last one to drop it), or the + dot to add a day.
function DayDots({ stop, arrive, onChange }) {
  const set = (n) => onChange(stop.name, Math.max(1, n) - stop.days)
  return (
    <div className="ht-days">
      <span className="ht-daydots" role="group" aria-label={`Days in ${stop.name}`}>
        {Array.from({ length: stop.days }, (_, k) => {
          const n = k + 1
          const isLast = n === stop.days
          const date = new Date(arrive)
          date.setDate(date.getDate() + k)
          return (
            <button
              key={k} type="button" className={`it-daydot ${isLast ? 'last' : ''}`} onClick={() => set(isLast ? n - 1 : n)}
              disabled={isLast && n === 1} title={dayName(date)}
              aria-label={isLast ? (n === 1 ? `1 day in ${stop.name}` : `One day less in ${stop.name}`) : `Stay ${n} ${n === 1 ? 'day' : 'days'} in ${stop.name}`}
            />
          )
        })}
        <button type="button" className="it-daydot add" onClick={() => set(stop.days + 1)} aria-label={`One day more in ${stop.name}`}>+</button>
      </span>
      <span className="it-dates">{stop.days} {stop.days === 1 ? 'day' : 'days'}</span>
    </div>
  )
}

// A sidebar section that starts folded, so the extras never crowd the plan.
function Extra({ title, hint, open = false, children }) {
  return (
    <details className="extra" open={open}>
      <summary><span>{title}</span>{hint && <small>{hint}</small>}</summary>
      <div className="extra-body">{children}</div>
    </details>
  )
}

const signedMoney = (c) => (c === 0 ? 'Same price' : `${c > 0 ? '+' : '−'}${money(Math.abs(c))}`)
const signedTime = (m) => (m === 0 ? 'same time' : `${formatDuration(Math.abs(m))} ${m < 0 ? 'faster' : 'slower'}`)

export default function Overview({
  start, startDate, onDateChange, stops, onChange, onBack, chosen, onChoose, onBook, departures, onPickTrain, passes = [], onPasses,
}) {
  const [hover, setHover] = useState(null)
  const [mapOpen, setMapOpen] = useState(false)

  const plans = useMemo(
    () => planAll(stops, new Date(`${startDate}T00:00:00`), start, departures),
    [stops, startDate, start, departures],
  )
  const plan = plans.find((p) => p.id === chosen)
  // One quote per package, priced with the passes the traveller holds (same maths as checkout).
  const quotes = useMemo(
    () => Object.fromEntries(plans.map((p) => [p.id, buildQuote({ start: start.name, startDate, stops, optionId: p.id, travellers: 1, departures, passes })])),
    [plans, start, startDate, stops, departures, passes],
  )
  const quote = quotes[chosen]
  const lastLeg = plan.legs[plan.legs.length - 1]
  const endDate = new Date(lastLeg.arrive)
  endDate.setDate(endDate.getDate() + stops[stops.length - 1].days)

  const view = useMemo(() => {
    const today = new Date()
    const legTickets = plan.legs.map((_, i) => quote.tickets.filter((t) => t.legIndex === i))
    const legs = plan.legs.map((leg, i) => {
      const notes = legNotes(leg, legTickets[i], today)
      const stay = stayNotes(leg.to, leg, plan.legs[i + 1] ?? null)
      return { leg, tickets: legTickets[i], notes, stay, status: statusOf([...notes, ...stay]) }
    })
    const kinds = legTickets.map((ts) => (ts.some((t) => t.kind === 'night') ? 'night' : ts.every((t) => t.kind === 'highspeed') ? 'highspeed' : 'regional'))
    const points = [start, ...stops].map((s) => byName[s.name])
    const segments = quote.tickets.map((t) => ({
      leg: t.legIndex, kind: t.kind, coords: [[byName[t.from].lng, byName[t.from].lat], [byName[t.to].lng, byName[t.to].lat]],
    }))
    return { legs, kinds, points, segments }
  }, [plan, quote, start, stops])

  const flying = compareWithFlying(plan)
  const totals = tripTotals({ plan, quote, start, stops, startDate: new Date(`${startDate}T00:00:00`), endDate })
  const pass = passComparison({ plan, quote, startDate: new Date(`${startDate}T00:00:00`), endDate })
  const allNotes = view.legs.flatMap((l) => [...l.notes, ...l.stay])

  const warnCount = allNotes.filter((n) => n.level === 'warn').length

  return (
    <div className="overview">
      <header className="ov-head">
        <button className="ghost" onClick={onBack}>← Edit route</button>
        <div className="ov-title">
          <h1>{start.name} → {stops[stops.length - 1].name}</h1>
          <p>{stops.length} stops · {fmtDate(plan.legs[0].depart)} – {fmtDate(endDate)}</p>
        </div>
        <label className="ov-date">
          Leaving on
          <input type="date" value={startDate} onChange={(e) => e.target.value && onDateChange(e.target.value)} />
        </label>
      </header>

      {/* 1. The trip, left to right: cities as dots, trains as tickets, times you can change right there */}
      <section className="itin" aria-label="Your stops and trains">
        <div className="itin-head">
          <h2>Your stops and trains</h2>
          <span className="it-legend">
            {['highspeed', 'regional', 'night'].filter((k) => quote.tickets.some((t) => t.kind === k)).map((k) => (
              <span key={k}><i className={`it-seg ${k}`} /> {KIND_LABEL[k]}</span>
            ))}
          </span>
        </div>
        <div className="ht-scroll">
          <ol className="ht">
            <li className="ht-stop first">
              <div className="ht-top">
                <strong>{start.name}</strong>
                <span className="it-dates">{dayName(plan.legs[0].depart)}</span>
              </div>
              <span className="ht-rail"><span className="it-dot" /></span>
              <div className="ht-body"><span className="it-dates">Start</span></div>
            </li>
            {view.legs.map((l, i) => {
              const stop = stops[i]
              const last = i === view.legs.length - 1
              return (
                <Fragment key={`${l.leg.from}>${l.leg.to}`}>
                  <li className="ht-ride">
                    <div className="ht-top ht-times">
                      <TimePick leg={l.leg} end="depart" onPick={onPickTrain} />
                      <span className="ht-dur">{formatDuration(l.leg.minutes)}</span>
                      <TimePick leg={l.leg} end="arrive" onPick={onPickTrain} />
                    </div>
                    <Rail tickets={l.tickets} />
                    <div className="ht-body">
                      <LegTicket
                        i={i} tickets={l.tickets} notes={l.notes} status={l.status} vs={legVersusFlight(l.leg)}
                        lit={hover?.type === 'leg' && hover.i === i} onHover={setHover}
                      />
                    </div>
                  </li>
                  <li
                    className={`ht-stop ${last ? 'last' : ''} ${hover?.type === 'stop' && hover.i === i + 1 ? 'hl' : ''}`}
                    onMouseEnter={() => setHover({ type: 'stop', i: i + 1 })} onMouseLeave={() => setHover(null)}
                  >
                    <div className="ht-top">
                      <strong>{stop.name}</strong>
                      <span className="it-dates">{dayName(l.leg.arrive)}</span>
                    </div>
                    <span className="ht-rail"><span className="it-dot" /></span>
                    <div className="ht-body">
                      <DayDots stop={stop} arrive={l.leg.arrive} onChange={onChange} />
                      <Notes notes={l.stay.filter((n) => n.level === 'warn')} />
                    </div>
                  </li>
                </Fragment>
              )
            })}
          </ol>
        </div>
      </section>

      {/* 2. Which kind of trip: the biggest switch, with what it changes */}
      <section className="ov-options" aria-label="Trip options">
        {plans.map((p) => {
          const dPrice = quotes[p.id].totalCents - quote.totalCents
          const dTime = p.totalMin - plan.totalMin
          const isChosen = p.id === chosen
          return (
            <button key={p.id} className={`option ${isChosen ? 'chosen' : ''}`} onClick={() => onChoose(p.id)} aria-pressed={isChosen}>
              <span className="opt-tag">{p.tag}</span>
              <span className="opt-price">{money(quotes[p.id].totalCents)}</span>
              <span className="opt-sub">{formatDuration(p.totalMin)} on trains · {p.changes === 0 ? 'direct' : `${p.changes} change per leg`}</span>
              <span className={`opt-delta ${isChosen ? 'now' : dPrice < 0 ? 'cheaper' : ''}`}>
                {isChosen ? '✓ Your pick' : `${signedMoney(dPrice)} · ${signedTime(dTime)}`}
              </span>
            </button>
          )
        })}
      </section>

      {/* 3. Everything else: there when you want it, folded when you don't */}
      <section className="ov-more" aria-label="More about this trip">
        <div className="ov-col">
          <div className={`ov-mapbox ${mapOpen ? 'open' : ''}`}>
            <RouteMap points={view.points} segments={view.segments} hover={hover} onHover={setHover} />
            <button className="map-toggle" onClick={() => setMapOpen((o) => !o)}>{mapOpen ? 'Smaller map' : 'Bigger map'}</button>
          </div>
        </div>
        <div className="ov-col">
          <FlyCompare cmp={flying} />
        </div>
        <div className="ov-col">
          <PassWallet quote={quote} passes={passes} onChange={onPasses} />
          {passes.length === 0 && (
            <Extra title="Rail pass or tickets?" hint={pass ? (pass.winner === 'tickets' ? 'tickets are cheaper' : 'a pass is cheaper') : null}>
              <PassCompare cmp={pass} />
            </Extra>
          )}
          <Extra title="Trip in numbers" hint={`${formatDuration(totals.travelMin)} on trains · ${totals.countries} countries`}>
            <TotalsBar totals={totals} />
          </Extra>
        </div>
      </section>

      <Extra title="Your trip, to scale" hint="time in cities vs on trains">
        <TripTimeline start={start} stops={stops} legs={plan.legs} kinds={view.kinds} endDate={endDate} hover={hover} onHover={setHover} />
      </Extra>

      <footer className="ov-foot">
        <div>
          <strong>{plan.tag}</strong> · {fmtDate(plan.legs[0].depart)} – {fmtDate(endDate)}
          {warnCount > 0 && <span className="foot-warn"> · <LevelIcon level="warn" /> {LEVELS.warn.label}</span>}
        </div>
        <button className="primary big" onClick={onBook}>
          Continue to checkout · {money(quote.totalCents)}
        </button>
      </footer>
    </div>
  )
}
