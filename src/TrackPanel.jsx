import { fmtShortRange } from './trip.js'

export function StationIcon({ size = 40 }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 2c-4 0-8 .5-8 4v9.5A3.5 3.5 0 0 0 7.5 19L6 20.5v.5h2.23l2-2H14l2 2h2v-.5L16.5 19a3.5 3.5 0 0 0 3.5-3.5V6c0-3.5-3.58-4-8-4zM7.5 17a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm3.5-7H6V6h5v4zm2 0V6h5v4h-5zm3.5 7a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z"
      />
    </svg>
  )
}

const shortDate = (d) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
const addDays = (iso, n) => {
  const d = new Date(`${iso}T00:00:00`)
  d.setDate(d.getDate() + n)
  return d
}

// One point on the timeline: label above, a node on the rail, details below.
// The rail is drawn as two halves around each node, so it starts at the first
// node and ends exactly at the last one.
function Point({ kind, caption, name, node, children, onRemove }) {
  return (
    <div className={`tl-point ${kind}`}>
      {onRemove && (
        <button className="tl-remove" onClick={onRemove} aria-label={`Remove ${name}`} title={`Remove ${name}`}>×</button>
      )}
      <div className="tl-caption">{caption}</div>
      <div className="tl-name">{name}</div>
      <div className="tl-rail">
        <span className="tl-half left" />
        <span className="tl-node">{node}</span>
        <span className="tl-half right" />
      </div>
      <div className="tl-below">{children}</div>
    </div>
  )
}

export default function TrackPanel({ start, startDate, stops, open, mode, onChange, onToggle, onReset, onNext }) {
  const active = stops.filter((s) => s.enabled)
  const total = active.reduce((n, s) => n + s.days, 0)

  // Rough calendar for each stop (travel time ignored here; the overview has exact times).
  let offset = 0
  const dated = active.map((s) => {
    const from = addDays(startDate, offset)
    offset += s.days
    return { ...s, from, to: addDays(startDate, offset) }
  })

  return (
    <section className={`panel ${open ? 'open' : ''}`}>
      <div className="panel-head">
        <div>
          <div className="panel-title">Your trip from {start.name}</div>
          <div className="panel-sub">
            {active.length} {active.length === 1 ? 'stop' : 'stops'} · {total} days · {fmtShortRange(startDate, total)}
          </div>
        </div>
        <div className="panel-actions">
          <button className="ghost" onClick={onReset}>{mode === 'click' ? 'Clear route' : 'Redraw route'}</button>
          <button className="primary" onClick={onNext} disabled={active.length === 0}>Next →</button>
        </div>
      </div>

      <div className="track-scroll">
        {active.length === 0 ? (
          <div className="empty">Tap a station on the map to add it to your trip</div>
        ) : (
          <div className="timeline">
            <Point kind="start" caption="Departure" name={start.name} node="🚂">
              <div className="tl-date">{shortDate(addDays(startDate, 0))}</div>
            </Point>

            {dated.map((s, i) => {
              const last = i === dated.length - 1
              return (
                <Point
                  key={s.name}
                  kind={last ? 'final' : 'stop'}
                  caption={last ? 'Final stop' : `Stop ${i + 1}`}
                  name={s.name}
                  node={last ? '🏁' : <StationIcon size={18} />}
                  onRemove={() => onToggle(s.name)}
                >
                  <div className="stepper">
                    <button onClick={() => onChange(s.name, -1)} disabled={s.days <= 1} aria-label={`One day less in ${s.name}`}>−</button>
                    <span>{s.days} {s.days === 1 ? 'day' : 'days'}</span>
                    <button onClick={() => onChange(s.name, 1)} aria-label={`One day more in ${s.name}`}>+</button>
                  </div>
                  <div className="tl-date">{shortDate(s.from)} – {shortDate(s.to)}</div>
                </Point>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}
