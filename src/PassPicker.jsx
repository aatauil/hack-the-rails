import { useEffect, useRef, useState } from 'react'
import { PASS_LIST, PASS_GROUPS, PASSES } from './passes.js'

// "I already have a pass": pick the passes and discount cards you hold, and every price
// in the app takes them into account.
export default function PassPicker({ passes, onChange, compact = false }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const close = (e) => !ref.current?.contains(e.target) && setOpen(false)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  const label = passes.length === 0 ? 'None' : passes.length === 1 ? PASSES[passes[0]].name : `${passes.length} passes & cards`

  return (
    <div className={`pp ${compact ? 'compact' : ''}`} ref={ref}>
      <button type="button" className="tb-field pp-btn" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="tb-label">🎫 Your passes</span>
        <span className="pp-value">{label} ▾</span>
      </button>
      {open && (
        <div className="pp-pop" role="dialog" aria-label="Your rail passes and discount cards">
          <p className="pp-intro">Already have a rail pass or discount card? Tick it and we’ll price every train with it.</p>
          <PassList passes={passes} onChange={onChange} />
          <div className="pp-foot">
            {passes.length > 0 && <button type="button" className="ghost" onClick={() => onChange([])}>Clear</button>}
            <button type="button" className="primary" onClick={() => setOpen(false)}>Done</button>
          </div>
        </div>
      )}
    </div>
  )
}

// The grouped tick list of every pass and card (used by the picker and the overview wallet).
export function PassList({ passes, onChange }) {
  const toggle = (id) => onChange(passes.includes(id) ? passes.filter((p) => p !== id) : [...passes, id])
  return (
    <>
      {Object.entries(PASS_GROUPS).map(([group, title]) => (
        <fieldset key={group}>
          <legend>{title}</legend>
          {PASS_LIST.filter((p) => p.group === group).map((p) => (
            <label key={p.id} className="pp-row">
              <input type="checkbox" checked={passes.includes(p.id)} onChange={() => toggle(p.id)} />
              <span>
                <strong>{p.name}</strong>
                <small>{p.summary}</small>
              </span>
            </label>
          ))}
        </fieldset>
      ))}
    </>
  )
}
