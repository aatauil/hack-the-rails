import { useState } from 'react'
import { PASSES } from './passes.js'
import { PassList } from './PassPicker.jsx'
import { money } from './tickets.js'

const GROUP_LABEL = { pass: 'Rail pass', card: 'Discount card', local: 'Travel pass' }

// The passes and cards the traveller holds, each drawn as a small ticket that shows at a
// glance whether it is doing anything on this trip.
export default function PassWallet({ quote, passes, onChange }) {
  const [adding, setAdding] = useState(false)

  // What each pass does on this trip: the trains it covers and how much it saves.
  const use = Object.fromEntries(passes.map((id) => [id, { trains: 0, savedCents: 0 }]))
  for (const t of quote.tickets) {
    if (!t.pass || !use[t.pass]) continue
    use[t.pass].trains += 1
    use[t.pass].savedCents += (t.fullUnitCents - t.unitCents) * quote.travellers
  }
  const active = passes.filter((id) => use[id].trains > 0).length

  return (
    <section className="wallet" aria-label="Your passes and cards">
      <div className="wallet-head">
        <h2>Your passes</h2>
        {passes.length > 0 && (
          <small className={active ? 'on' : ''}>
            {active ? `${active} of ${passes.length} active · saves ${money(quote.passSavingsCents)}` : 'none valid on this trip'}
          </small>
        )}
      </div>

      {passes.map((id) => {
        const p = PASSES[id]
        const u = use[id]
        const on = u.trains > 0
        return (
          <article key={id} className={`pticket g-${p.group} ${on ? 'on' : 'off'}`}>
            <div className="pt-main">
              <span className="pt-kind">{GROUP_LABEL[p.group]}</span>
              <strong className="pt-name">{p.name}</strong>
              <span className="pt-use">
                {on
                  ? `Covers ${u.trains} of ${quote.tickets.length} trains${u.savedCents ? ` · saves ${money(u.savedCents)}` : ''}`
                  : 'Not valid on these trains'}
              </span>
            </div>
            <div className="pt-stub">
              <span className="pt-state">{on ? 'Active' : 'Unused'}</span>
              <button type="button" className="pt-x" onClick={() => onChange(passes.filter((x) => x !== id))} aria-label={`Remove ${p.name}`}>×</button>
            </div>
          </article>
        )
      })}

      {adding ? (
        <div className="wallet-add-open">
          <p className="pp-intro">Tick the passes and cards you already have. Every price takes them into account.</p>
          <PassList passes={passes} onChange={onChange} />
          <div className="pp-foot">
            <button type="button" className="primary" onClick={() => setAdding(false)}>Done</button>
          </div>
        </div>
      ) : (
        <button type="button" className="wallet-add" onClick={() => setAdding(true)}>
          + {passes.length ? 'Add another pass or card' : `Have a rail pass or discount card? Add it`}
        </button>
      )}
    </section>
  )
}
