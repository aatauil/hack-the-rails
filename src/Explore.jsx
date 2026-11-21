import { STATIONS } from './data.js'
import { WHEN, LENGTH, monthName } from './explore.js'
import { formatDuration, formatKg, fmtShortRange } from './trip.js'
import { photo } from './photos.js'

const BY_NAME = [...STATIONS].sort((a, b) => a.name.localeCompare(b.name))

function Chip({ value, onChange, options }) {
  return (
    <select className="ex-chip" value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
    </select>
  )
}

// Badges for the best next hops: quickest ride, most CO₂ saved against flying, lowest price.
const BADGES = {
  greenest: { label: 'Most sustainable', icon: '🌱', title: 'Saves the most CO₂ compared with flying' },
  fastest: { label: 'Fastest', icon: '⚡', title: 'Shortest train ride from here' },
  cheapest: { label: 'Cheapest', icon: '€', title: 'Lowest price from here' },
}
function badgesFor(list) {
  if (list.length < 2) return {}
  const pick = (better) => list.reduce((a, b) => (better(b, a) ? b : a)).name
  const out = {}
  const add = (id, name) => { (out[name] ??= []).push(id) }
  add('greenest', pick((b, a) => b.savedKg > a.savedKg))
  add('fastest', pick((b, a) => b.minutes < a.minutes))
  add('cheapest', pick((b, a) => b.price < a.price))
  return out
}

function Badge({ id }) {
  const b = BADGES[id]
  return <span className={`ex-badge ${id}`} title={b.title}><i aria-hidden>{b.icon}</i>{b.label}</span>
}

function Photo({ city, className }) {
  const src = photo(city)
  return (
    <span className={`ex-photo ${className ?? ''}`}>
      {src && <img src={src} alt="" loading="lazy" onError={(e) => { e.currentTarget.style.display = 'none' }} />}
    </span>
  )
}

// What you get going there, as small labelled facts rather than a run of numbers.
function Facts({ d }) {
  return (
    <span className="ex-facts-row">
      <span className="ex-fact" title="Train ride"><i aria-hidden>🚆</i>{formatDuration(d.minutes)}</span>
      <span className="ex-fact" title={`Typical daytime high in ${monthName(d.weather.month)}`}>
        <i aria-hidden>{d.weather.icon}</i>{d.weather.high}° <small>in {monthName(d.weather.month)}</small>
      </span>
      <span className="ex-fact co2" title="CO₂ saved compared with flying"><i aria-hidden>🌱</i>−{formatKg(d.savedKg)} CO₂</span>
    </span>
  )
}

function Row({ d, badges = [], onSelect, onHover }) {
  return (
    <li>
      <button className="ex-row" onClick={() => onSelect(d.name)} onMouseEnter={() => onHover(d.name)} onMouseLeave={() => onHover(null)}>
        <Photo city={d.name} />
        <span className="ex-row-body">
          {badges.length > 0 && <span className="ex-badges">{badges.map((b) => <Badge key={b} id={b} />)}</span>}
          <span className="ex-row-top">
            <span className="ex-row-name">{d.name}</span>
            <span className="ex-row-price"><small>from</small> €{d.price}</span>
          </span>
          <Facts d={d} />
        </span>
      </button>
    </li>
  )
}

function Detail({ d, from, badges = [], onBack, onAdd }) {
  return (
    <div className="ex-detail">
      <div className="ex-hero">
        <Photo city={d.name} className="big" />
        <button className="ex-back" onClick={onBack} aria-label="Back to all destinations">←</button>
      </div>
      <div className="ex-detail-body">
        {badges.length > 0 && <span className="ex-badges">{badges.map((b) => <Badge key={b} id={b} />)}</span>}
        <div className="ex-row-top">
          <h2>{d.name}</h2>
          <div className="ex-price"><small>from</small> €{d.price}</div>
        </div>
        <dl className="ex-stats">
          <div><dt title={`Train from ${from}`}>Train ride</dt><dd>🚆 {formatDuration(d.minutes)}</dd></div>
          <div><dt>Weather</dt><dd>{d.weather.icon} {d.weather.high}°</dd></div>
          <div className="co2"><dt>vs flying</dt><dd>🌱 −{formatKg(d.savedKg)} CO₂</dd></div>
        </dl>
        {d.months.length > 1 && (
          <ol className="ex-months">
            {d.months.map((w) => (
              <li key={w.month} className={w.month === d.weather.month ? 'best' : ''}>
                <span>{monthName(w.month)}</span>
                <span>{w.icon}</span>
                <b>{w.high}°</b>
              </li>
            ))}
          </ol>
        )}
        <button className="primary ex-add" onClick={() => onAdd(d.name)}>Add {d.name} to trip</button>
      </div>
    </div>
  )
}

const HOPS = 8

export default function Explore({
  startName, onStart, when, onWhen, length, onLength, trip, startDate, nights, onRemove, onNext,
  dests, selected, onSelect, onHover, onAdd,
}) {
  const pick = dests.find((d) => d.name === selected)
  // A hop is one of the closest train connections from where you are now (within the trip's limit).
  const reachable = dests.filter((d) => d.fits)
  const hops = [...reachable].sort((a, b) => a.minutes - b.minutes).slice(0, HOPS)
  const further = reachable.filter((d) => !hops.includes(d))
  const badges = badgesFor(hops)
  // The most sustainable connection always comes first, in its own card; then the other badged
  // picks, then the rest.
  const greenest = hops.find((d) => badges[d.name]?.includes('greenest'))
  const ranked = hops.filter((d) => d !== greenest).sort((a, b) => (badges[b.name]?.length ?? 0) - (badges[a.name]?.length ?? 0))
  const from = trip.length ? trip[trip.length - 1].name : startName
  const step = trip.length + 1

  return (
    <aside className="ex">
      <div className="ex-search">
        <div className="brand"><img src="/brand/hippity-hop-logo-primary.svg" alt="Hippity Hop" /></div>
        <select className="ex-from" value={startName} onChange={(e) => onStart(e.target.value)} aria-label="From">
          {BY_NAME.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
        </select>
        <div className="ex-chips">
          <Chip value={when} onChange={onWhen} options={WHEN} />
          <Chip value={length} onChange={onLength} options={LENGTH} />
        </div>
      </div>

      {/* The trip so far, one hop at a time */}
      {trip.length > 0 && (
        <div className="ex-trip">
          <ol className="ex-route">
            <li className="ex-stop start"><span className="ex-dot" />{startName}</li>
            {trip.map((s, i) => (
              <li key={s.name} className="ex-stop">
                <span className="ex-dot">{i + 1}</span>{s.name}
                <button onClick={() => onRemove(s.name)} aria-label={`Remove ${s.name}`}>×</button>
              </li>
            ))}
            <li className="ex-stop next"><span className="ex-dot">{step}</span>Next stop?</li>
          </ol>
          <div className="ex-trip-foot">
            <span>{fmtShortRange(startDate, nights)}</span>
            <button className="primary" onClick={onNext}>Done, see trip →</button>
          </div>
        </div>
      )}

      {pick ? (
        <Detail d={pick} from={from} badges={badges[pick.name]} onBack={() => onSelect(null)} onAdd={onAdd} />
      ) : (
        <>
          <div className="ex-step">
            <span className="ex-step-n">Stop {step}</span>
            <h2>{trip.length ? `Where next from ${from}?` : `Where to first from ${from}?`}</h2>
            <p>{hops.length} train connections from {from} · pick one, then keep hopping</p>
          </div>
          {greenest && (
            <section className="ex-green" aria-label="Most sustainable connection">
              <div className="ex-green-head">
                <span>🌱 Most sustainable connection</span>
                <small>Saves {formatKg(greenest.savedKg)} CO₂ compared with flying</small>
              </div>
              <ul className="ex-list">
                <Row d={greenest} badges={badges[greenest.name]} onSelect={onSelect} onHover={onHover} />
              </ul>
            </section>
          )}
          {greenest && ranked.length > 0 && <h3 className="ex-sub">Other connections</h3>}
          <ul className="ex-list">
            {ranked.map((d) => <Row key={d.name} d={d} badges={badges[d.name]} onSelect={onSelect} onHover={onHover} />)}
          </ul>
          {further.length > 0 && (
            <details className="ex-more">
              <summary>Show {further.length} more, further away</summary>
              <ul className="ex-list">
                {further.map((d) => <Row key={d.name} d={d} onSelect={onSelect} onHover={onHover} />)}
              </ul>
            </details>
          )}
        </>
      )}
    </aside>
  )
}
