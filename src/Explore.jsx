import { STATIONS } from './data.js'
import { WHEN, LENGTH, monthName } from './explore.js'
import { formatDuration, formatKg, fmtShortRange } from './trip.js'

const BY_NAME = [...STATIONS].sort((a, b) => a.name.localeCompare(b.name))

function Chip({ value, onChange, options }) {
  return (
    <select className="ex-chip" value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
    </select>
  )
}

function Row({ d, onSelect, onHover }) {
  return (
    <li>
      <button className="ex-row" onClick={() => onSelect(d.name)} onMouseEnter={() => onHover(d.name)} onMouseLeave={() => onHover(null)}>
        <span className="ex-row-name">{d.name}</span>
        <span className="ex-row-meta">{d.weather.icon} {d.weather.high}°</span>
        <span className="ex-row-meta">{formatDuration(d.minutes)}</span>
        <span className="ex-row-price">€{d.price}</span>
      </button>
    </li>
  )
}

function Detail({ d, onBack, onAdd }) {
  return (
    <div className="ex-detail">
      <button className="ex-back" onClick={onBack} aria-label="Back to all destinations">←</button>
      <h2>{d.name}</h2>
      <div className="ex-price">€{d.price}</div>
      <dl className="ex-facts">
        <div><dt>🚆</dt><dd>{formatDuration(d.minutes)}</dd></div>
        <div><dt>{d.weather.icon}</dt><dd>{d.weather.high}°</dd></div>
        <div><dt>🌱</dt><dd>−{formatKg(d.savedKg)} CO₂ vs flying</dd></div>
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
      <button className="primary ex-add" onClick={() => onAdd(d.name)}>Add to trip</button>
    </div>
  )
}

export default function Explore({
  startName, onStart, when, onWhen, length, onLength, trip, startDate, nights, onRemove, onNext,
  dests, selected, onSelect, onHover, onAdd,
}) {
  const pick = dests.find((d) => d.name === selected)
  const shown = dests.filter((d) => d.fits)

  return (
    <aside className="ex">
      <div className="ex-search">
        <div className="brand">🚆 Eurailo</div>
        <select className="ex-from" value={startName} onChange={(e) => onStart(e.target.value)} aria-label="From">
          {BY_NAME.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
        </select>
        <div className="ex-chips">
          <Chip value={when} onChange={onWhen} options={WHEN} />
          <Chip value={length} onChange={onLength} options={LENGTH} />
        </div>
      </div>

      {trip.length > 0 && (
        <div className="ex-trip">
          <div className="ex-route">
            <span>{startName}</span>
            {trip.map((s) => (
              <span key={s.name} className="ex-stop">
                → {s.name}
                <button onClick={() => onRemove(s.name)} aria-label={`Remove ${s.name}`}>×</button>
              </span>
            ))}
          </div>
          <div className="ex-trip-foot">
            <span>{fmtShortRange(startDate, nights)}</span>
            <button className="primary" onClick={onNext}>Continue</button>
          </div>
        </div>
      )}

      {pick ? (
        <Detail d={pick} onBack={() => onSelect(null)} onAdd={onAdd} />
      ) : (
        <ul className="ex-list">
          {shown.map((d) => <Row key={d.name} d={d} onSelect={onSelect} onHover={onHover} />)}
        </ul>
      )}
    </aside>
  )
}
