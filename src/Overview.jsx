import { Fragment, useEffect, useMemo, useState } from 'react'
import { STATIONS } from './data.js'
import { planAll, planTrip, OPTIONS, DEFAULT_OPTION, formatDuration, formatKg, fmtDate, fmtTime, DEPARTURE_TIMES, legKey, compareWithFlying, legVersusFlight, nightTrainPossible, NIGHT_TRAIN } from './trip.js'
import { buildQuote, legAlternatives, OPERATORS } from './tickets.js'
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
// Other trains for the same ride sit behind it as a stack: click the ticket to swap.
// Times and dates live on the timeline next to it, so they are not repeated here.
function LegTicket({ i, tickets, notes, status, lit, onHover, vs, others, greener, onOpen }) {
  const reservation = tickets.some((t) => t.reservationRequired)
  const warns = notes.filter((n) => n.level === 'warn')
  const tips = notes.filter((n) => n.level !== 'warn')
  const cents = tickets.reduce((n, t) => n + t.totalCents, 0)
  const extras = tips.length > 0 || reservation || vs.night || (!vs.shortHop && vs.savedMin > 0)
  const layers = Math.min(others, 3)
  // Clicks on the folded details are for reading, not for swapping trains.
  const open = (e) => { if (others > 0 && !e.target.closest('details')) onOpen(i) }
  return (
    <div className={`tix-stack layers-${layers}`}>
      {Array.from({ length: layers }, (_, k) => <span key={k} className="tix-layer" style={{ '--k': layers - k }} aria-hidden />)}
      <article
        className={`tix ${lit ? 'hl' : ''} ${status} ${others ? 'swappable' : ''}`}
        onMouseEnter={() => onHover({ type: 'leg', i })} onMouseLeave={() => onHover(null)} onClick={open}
      >
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
          {greener && (
            <button type="button" className="tix-greener" onClick={(e) => { e.stopPropagation(); onOpen(i) }}>
              🌱 A more sustainable train saves {formatKg(greener.savedKg)} CO₂ on this ride
            </button>
          )}
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
          {others > 0 && (
            <button type="button" className="tix-swap" onClick={(e) => { e.stopPropagation(); onOpen(i) }}>
              {others} other train{others > 1 ? 's' : ''}
            </button>
          )}
        </div>
      </article>
    </div>
  )
}

// The lowest-CO₂ train among a ride's alternatives (your current one wins a tie).
const greenestAlt = (alts) => alts.reduce((best, a) => (a.co2Kg < best.co2Kg - 0.5 ? a : best), alts.find((a) => a.current))

const operatorNames = (tickets) => [...new Set(tickets.map((t) => OPERATORS[t.operator].name))].join(' + ')
const shift = (min, earlier, later) => (min === 0 ? null : `${formatDuration(Math.abs(min))} ${min < 0 ? earlier : later}`)

// What swapping to `alt` changes compared with the train you have now.
function differences(alt, cur) {
  const out = []
  const dKg = alt.co2Kg - cur.co2Kg
  if (Math.abs(dKg) >= 0.5) out.push({ kind: dKg < 0 ? 'green' : 'bad', text: `${dKg < 0 ? '−' : '+'}${formatKg(Math.abs(dKg))} CO₂` })
  const leave = shift(Math.round((alt.depart - cur.depart) / 60000), 'earlier', 'later')
  if (leave) out.push({ kind: 'time', text: `Leaves ${leave}` })
  const ride = shift(alt.minutes - cur.minutes, 'shorter', 'longer')
  if (ride) out.push({ kind: alt.minutes < cur.minutes ? 'good' : 'bad', text: `Ride ${ride}` })
  if (operatorNames(alt.tickets) !== operatorNames(cur.tickets)) out.push({ kind: 'company', text: `With ${operatorNames(alt.tickets)}` })
  const dc = alt.tickets.length - cur.tickets.length
  if (dc > 0) out.push({ kind: 'bad', text: `${dc} change${dc > 1 ? 's' : ''} more` })
  if (dc < 0) out.push({ kind: 'good', text: 'Direct, no change' })
  if (alt.conditions.label !== cur.conditions.label) out.push({ kind: 'info', text: `${alt.conditions.label} ticket` })
  return out
}

// The other trains for one ride, each drawn as a ticket with what it would change.
function SwapModal({ leg, alts, onPick, onClose }) {
  useEffect(() => {
    const esc = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onClose])
  const cur = alts.find((a) => a.current)
  const greenest = greenestAlt(alts)
  // Your train first, then the greenest trains: the sustainable choice is the easy one.
  const list = [cur, ...alts.filter((a) => !a.current).sort((a, b) => a.co2Kg - b.co2Kg)]
  return (
    <div className="swap-back" onClick={onClose}>
      <div className="swap" role="dialog" aria-modal="true" aria-label={`Trains from ${leg.from} to ${leg.to}`} onClick={(e) => e.stopPropagation()}>
        <header className="swap-head">
          <div>
            <h2>{leg.from} → {leg.to}</h2>
            <p>{dayName(leg.depart)} · {alts.length} trains · prices for this ride</p>
          </div>
          <button className="swap-x" onClick={onClose} aria-label="Close">×</button>
        </header>
        {greenest.current ? (
          <p className="swap-green ok">🌱 Your train is already the most sustainable way to do this ride.</p>
        ) : (
          <p className="swap-green">🌱 There is a more sustainable train: it saves {formatKg(cur.co2Kg - greenest.co2Kg)} CO₂ on this ride.</p>
        )}
        <ul className="swap-list">
          {list.map((a) => {
            const diffs = a.current ? [] : differences(a, cur)
            const next = a.arrive.getDate() !== a.depart.getDate()
            return (
              <li key={a.id}>
                <button className={`swap-tix ${a.current ? 'current' : ''} ${a === greenest && !a.current ? 'greenest' : ''}`} onClick={() => (a.current ? onClose() : onPick(a))}>
                  <span className="swap-main">
                    {a === greenest && <span className="swap-best">🌱 Most sustainable</span>}
                    <span className="swap-times">
                      <b>{fmtTime(a.depart)}</b>
                      <span className="swap-line"><small>{formatDuration(a.minutes)}</small></span>
                      <b>{fmtTime(a.arrive)}{next && <sup>+1</sup>}</b>
                    </span>
                    <span className="swap-trains">
                      {a.tickets.map((t, k) => (
                        <Fragment key={t.id}>
                          {k > 0 && <span className="tix-chg">change in {t.from}</span>}
                          <span className="tix-train"><OperatorBadge id={t.operator} size="sm" /><strong>{t.service}</strong></span>
                        </Fragment>
                      ))}
                    </span>
                    {a.current ? (
                      <span className="swap-diffs"><span className="swap-diff now">✓ Your train</span><span className="swap-diff info">{a.conditions.label} ticket</span></span>
                    ) : (
                      <span className="swap-diffs">{diffs.map((d, k) => <span key={k} className={`swap-diff ${d.kind}`}>{d.text}</span>)}</span>
                    )}
                  </span>
                  <span className="swap-stub">
                    <span className="tix-price">{money(a.cents)}</span>
                    {!a.current && (
                      <span className={`swap-delta ${a.deltaCents < 0 ? 'cheaper' : a.deltaCents > 0 ? 'dearer' : ''}`}>{signedMoney(a.deltaCents)}</span>
                    )}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
        <p className="swap-foot">Swapping only changes this ride. Still one payment for the whole trip.</p>
      </div>
    </div>
  )
}

// The rail between two cities, drawn per train in the same style as the map.
function Rail({ tickets }) {
  return (
    <span className="it-rail ride">
      {tickets.map((t, k) => (
        <Fragment key={t.id}>
          {k > 0 && <span className="it-change" title={`Change in ${t.from}`} />}
          <span className={`it-seg ${t.kind}`} />
        </Fragment>
      ))}
    </span>
  )
}

// Days in a city as small dots on the timeline, one per day, below the city's dot.
// Tap a day to stay that many days (tap the last one to drop it), or the + dot to add a day.
function DayRows({ stop, arrive, last, onChange }) {
  const set = (n) => onChange(stop.name, Math.max(1, n) - stop.days)
  return (
    <li className={`it-days ${last ? 'end' : ''}`}>
      <span className="it-time" />
      <span className="it-rail" role="group" aria-label={`Days in ${stop.name}`}>
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
      <span />
    </li>
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

// A greener train for one ride than the one picked, and how much CO₂ it saves (or null).
function greenerFor(alts) {
  const cur = alts.find((a) => a.current)
  const best = greenestAlt(alts)
  return best === cur ? null : { alt: best, savedKg: cur.co2Kg - best.co2Kg }
}

const costLine = (c) => (c === 0 ? 'costs the same' : c > 0 ? `costs ${money(c)} more` : `is ${money(-c)} cheaper`)
const signedMoney = (c) => (c === 0 ? 'Same price' : `${c > 0 ? '+' : '−'}${money(Math.abs(c))}`)
const signedTime = (m) => (m === 0 ? 'same time' : `${formatDuration(Math.abs(m))} ${m < 0 ? 'faster' : 'slower'}`)

export default function Overview({
  start, startDate, onDateChange, stops, onChange, onBack, chosen, onChoose, onBook, departures, fares = {}, onPickTrain, onSwapTrain, passes = [], onPasses, onMockSuccess,
}) {
  const [hover, setHover] = useState(null)
  const [swapLeg, setSwapLeg] = useState(null)

  const plans = useMemo(
    () => planAll(stops, new Date(`${startDate}T00:00:00`), start, departures, fares),
    [stops, startDate, start, departures, fares],
  )
  const plan = plans.find((p) => p.id === chosen)
  // One quote per package, priced with the passes the traveller holds (same maths as checkout).
  const quotes = useMemo(
    () => Object.fromEntries(plans.map((p) => [p.id, buildQuote({ start: start.name, startDate, stops, optionId: p.id, travellers: 1, departures, fares, passes })])),
    [plans, start, startDate, stops, departures, fares, passes],
  )
  const quote = quotes[chosen]
  // The most sustainable trip with no swapped trains: what we nudge back to when the traveller strays.
  const green = useMemo(() => {
    const opt = OPTIONS.find((o) => o.id === DEFAULT_OPTION)
    const p = planTrip(stops, opt, new Date(`${startDate}T00:00:00`), start, departures, {})
    const q = buildQuote({ start: start.name, startDate, stops, optionId: DEFAULT_OPTION, travellers: 1, departures, fares: {}, passes })
    return { plan: p, quote: q }
  }, [stops, startDate, start, departures, passes])
  const extraKg = plan.co2Kg - green.plan.co2Kg
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

  // Other trains for every ride, priced like checkout.
  const alts = useMemo(() => {
    const trip = { start: start.name, startDate, stops, optionId: chosen, departures, fares, passes }
    return plan.legs.map((_, i) => legAlternatives(trip, i))
  }, [plan, start, startDate, stops, chosen, departures, fares, passes])

  const flying = compareWithFlying(plan)
  const totals = tripTotals({ plan, quote, start, stops, startDate: new Date(`${startDate}T00:00:00`), endDate })
  const pass = passComparison({ plan, quote, startDate: new Date(`${startDate}T00:00:00`), endDate })
  const allNotes = view.legs.flatMap((l) => [...l.notes, ...l.stay])

  const warnCount = allNotes.filter((n) => n.level === 'warn').length

  // Price bubbles on the map, Google Flights style: what the train into each stop costs.
  const labels = [fmtDate(plan.legs[0].depart), ...view.legs.map((l) => money(l.tickets.reduce((n, t) => n + t.totalCents, 0)))]

  return (
    <div className="overview">
      <section className="ov-list" aria-label="Your trip">
        <header className="ov-head">
          <button className="ghost" onClick={onBack}>← Edit route</button>
          <label className="ov-date">
            <span>Leaving on</span>
            <input type="date" value={startDate} onChange={(e) => e.target.value && onDateChange(e.target.value)} />
          </label>
          {/* Dev only: skip payment and open a mock confirmation page. */}
          {import.meta.env.DEV && onMockSuccess && (
            <button type="button" className="dev-mock" onClick={onMockSuccess} title="Dev: open a mock confirmation page" aria-label="Open mock confirmation page">✓</button>
          )}
        </header>
        <div className="ov-title">
          <h1>{start.name} → {stops[stops.length - 1].name}</h1>
          <p>{stops.length} stops · {fmtDate(plan.legs[0].depart)} – {fmtDate(endDate)}</p>
        </div>

        {/* Which kind of trip: tabs like "Best / Cheapest", with what switching changes */}
        <section className="ov-options" role="tablist" aria-label="Trip options">
          {plans.map((p) => {
            const dPrice = quotes[p.id].totalCents - quote.totalCents
            const dTime = p.totalMin - plan.totalMin
            const isChosen = p.id === chosen
            return (
              <button key={p.id} role="tab" className={`option ${isChosen ? 'chosen' : ''}`} onClick={() => onChoose(p.id)} aria-selected={isChosen}>
                <span className="opt-tag">{p.id === DEFAULT_OPTION && '🌱 '}{p.tag}</span>
                {p.id === DEFAULT_OPTION && <span className="opt-rec">Recommended</span>}
                <span className="opt-price">{money(quotes[p.id].totalCents)}</span>
                <span className="opt-sub">{formatDuration(p.totalMin)} · {p.changes === 0 ? 'direct' : `${p.changes} change/leg`}</span>
                {!isChosen && <span className={`opt-delta ${dPrice < 0 ? 'cheaper' : ''}`}>{signedMoney(dPrice)} · {signedTime(dTime)}</span>}
                <span className={`opt-co2 ${p.id === DEFAULT_OPTION ? 'best' : ''}`}>{formatKg(p.co2Kg)} CO₂</span>
              </button>
            )
          })}
        </section>

        {extraKg >= 0.5 && (
          <div className="ov-nudge" role="note">
            <span className="ov-nudge-icon" aria-hidden>🌱</span>
            <div>
              <strong>There's a more sustainable way to do this trip</strong>
              <p>
                {chosen === DEFAULT_OPTION ? 'Your swapped trains' : `The ${plan.tag.toLowerCase()} trip`} add{chosen === DEFAULT_OPTION ? '' : 's'} {formatKg(extraKg)} CO₂.
                {' '}The most sustainable trip {costLine(green.quote.totalCents - quote.totalCents)}.
              </p>
            </div>
            <button className="primary" onClick={() => onChoose(DEFAULT_OPTION)}>Switch back</button>
          </div>
        )}

        <p className="ov-about">Prices include every ticket and our booking fee. One payment for the whole trip.</p>

        {/* The stops, with the times you can change right there */}
        <section className="itin" aria-label="Your stops and trains">
          <div className="itin-head">
            <h2>Your stops and trains</h2>
            <span className="it-legend">
              {['highspeed', 'regional', 'night'].filter((k) => quote.tickets.some((t) => t.kind === k)).map((k) => (
                <span key={k}><i className={`it-seg ${k}`} /> {KIND_LABEL[k]}</span>
              ))}
            </span>
          </div>
          <ol className="it">
            <li className="it-node first">
              <span className="it-time"><TimePick leg={plan.legs[0]} end="depart" onPick={onPickTrain} /></span>
              <span className="it-rail"><span className="it-dot" /></span>
              <div className="it-body">
                <div className="it-place"><strong>{start.name}</strong><span className="it-dates">{dayName(plan.legs[0].depart)}</span></div>
              </div>
            </li>
            {view.legs.map((l, i) => {
              const stop = stops[i]
              const last = i === view.legs.length - 1
              return (
                <Fragment key={`${l.leg.from}>${l.leg.to}`}>
                  <li className="it-ride">
                    <span className="it-time">{i > 0 && <TimePick leg={l.leg} end="depart" onPick={onPickTrain} />}</span>
                    <Rail tickets={l.tickets} />
                    <div className="it-body">
                      <LegTicket
                        i={i} tickets={l.tickets} notes={l.notes} status={l.status} vs={legVersusFlight(l.leg)}
                        lit={hover?.type === 'leg' && hover.i === i} onHover={setHover}
                        others={alts[i].length - 1} onOpen={setSwapLeg} greener={greenerFor(alts[i])}
                      />
                    </div>
                  </li>
                  <li
                    className={`it-node ${hover?.type === 'stop' && hover.i === i + 1 ? 'hl' : ''}`}
                    onMouseEnter={() => setHover({ type: 'stop', i: i + 1 })} onMouseLeave={() => setHover(null)}
                  >
                    <span className="it-time"><TimePick leg={l.leg} end="arrive" onPick={onPickTrain} /></span>
                    <span className="it-rail"><span className="it-dot" /></span>
                    <div className="it-body">
                      <div className="it-place">
                        <strong>{stop.name}</strong>
                        <span className="it-dates">{stop.days} {stop.days === 1 ? 'day' : 'days'}</span>
                      </div>
                      <Notes notes={l.stay.filter((n) => n.level === 'warn')} />
                    </div>
                  </li>
                  <DayRows stop={stop} arrive={l.leg.arrive} last={last} onChange={onChange} />
                </Fragment>
              )
            })}
          </ol>
        </section>

        {/* Everything else: there when you want it, folded when you don't */}
        <section className="ov-extras" aria-label="More about this trip">
          <FlyCompare cmp={flying} />
          <PassWallet quote={quote} passes={passes} onChange={onPasses} />
          {passes.length === 0 && (
            <Extra title="Rail pass or tickets?" hint={pass ? (pass.winner === 'tickets' ? 'tickets are cheaper' : 'a pass is cheaper') : null}>
              <PassCompare cmp={pass} />
            </Extra>
          )}
          <Extra title="Trip in numbers" hint={`${formatDuration(totals.travelMin)} on trains · ${totals.countries} countries`}>
            <TotalsBar totals={totals} />
          </Extra>
          <Extra title="Your trip, to scale" hint="time in cities vs on trains">
            <TripTimeline start={start} stops={stops} legs={plan.legs} kinds={view.kinds} endDate={endDate} hover={hover} onHover={setHover} />
          </Extra>
        </section>

        <footer className="ov-foot">
          <div>
            <strong>{plan.tag}</strong>
            {warnCount > 0 && <span className="foot-warn"> · <LevelIcon level="warn" /> {LEVELS.warn.label}</span>}
          </div>
          <button className="primary big" onClick={onBook}>
            Checkout · {money(quote.totalCents)}
          </button>
        </footer>
      </section>

      {swapLeg !== null && plan.legs[swapLeg] && (
        <SwapModal
          leg={plan.legs[swapLeg]} alts={alts[swapLeg]} onClose={() => setSwapLeg(null)}
          onPick={(a) => {
            const l = plan.legs[swapLeg]
            onSwapTrain(legKey(l.from, l.to), { time: a.time, fare: a.fare })
            setSwapLeg(null)
          }}
        />
      )}

      <section className="ov-map" aria-label="Route map">
        <RouteMap points={view.points} segments={view.segments} labels={labels} cooperative={false} hover={hover} onHover={setHover} />
      </section>
    </div>
  )
}
