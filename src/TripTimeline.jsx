import { formatDuration } from './trip.js'

// The whole trip on one line, to scale: each city is as wide as the time you spend there,
// each train as wide as the ride (with a minimum, or short rides would vanish).
const shortDate = (d) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

export default function TripTimeline({ start, stops, legs, kinds, endDate, hover, onHover }) {
  const lit = (type, i) => hover?.type === type && hover.i === i
  const items = [
    <div key="start" className={`tl2-start ${lit('stop', 0) ? 'hl' : ''}`}
      onMouseEnter={() => onHover({ type: 'stop', i: 0 })} onMouseLeave={() => onHover(null)}>
      <span className="tl2-num">🚂</span>
      <span className="tl2-city">{start.name}</span>
    </div>,
  ]
  legs.forEach((leg, i) => {
    const kind = kinds[i]
    items.push(
      <div key={`leg${i}`} className={`tl2-leg ${kind} ${lit('leg', i) ? 'hl' : ''}`}
        style={{ flexGrow: leg.minutes }}
        onMouseEnter={() => onHover({ type: 'leg', i })} onMouseLeave={() => onHover(null)}
        title={`${leg.from} → ${leg.to} · ${formatDuration(leg.minutes)}`}>
        <span className="tl2-line" />
        <span className="tl2-dur">{kind === 'night' ? '🌙' : '🚆'} {formatDuration(leg.minutes)}</span>
      </div>,
    )
    const leave = legs[i + 1]?.depart ?? endDate
    const stayMin = Math.max(60, (leave - leg.arrive) / 60000)
    const s = stops[i]
    items.push(
      <div key={`stay${i}`} className={`tl2-stay ${lit('stop', i + 1) ? 'hl' : ''}`}
        style={{ flexGrow: stayMin }}
        onMouseEnter={() => onHover({ type: 'stop', i: i + 1 })} onMouseLeave={() => onHover(null)}>
        <span className="tl2-num">{i + 1}</span>
        <span className="tl2-city">{s.name}</span>
        <span className="tl2-days">{s.days} {s.days === 1 ? 'day' : 'days'}</span>
        <span className="tl2-dates">{shortDate(leg.arrive)} – {shortDate(leave)}</span>
      </div>,
    )
  })

  return (
    <section className="tl2-wrap" aria-label="Trip timeline, to scale">
      <div className="tl2-head">
        <h2>Your trip, to scale</h2>
        <span>Wide blocks are time in a city, thin ones are time on the train</span>
      </div>
      <div className="tl2-scroll">
        <div className="tl2">{items}</div>
      </div>
    </section>
  )
}
