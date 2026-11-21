import { useMemo, useState } from 'react'
import { PROVIDER_LIST, COUNTRY_NAMES, KINDS } from './providers.js'
import { PASS_LIST, PASS_GROUPS } from './passes.js'

const INTERRAIL = {
  yes: { label: 'Pass accepted', tone: 'ok' },
  reservation: { label: 'Pass + reservation', tone: 'info' },
  no: { label: 'Pass not accepted', tone: 'bad' },
}

// Who runs Europe's trains, and which passes work where. For information only: travellers
// never have to choose a company, Eurailo picks and buys the right tickets for them.
export default function Providers({ onBack }) {
  const [tab, setTab] = useState('companies')
  const [query, setQuery] = useState('')
  const [kind, setKind] = useState('all')

  const companies = useMemo(() => {
    const q = query.trim().toLowerCase()
    return PROVIDER_LIST.filter((o) => kind === 'all' || o.kind === kind).filter(
      (o) => !q || [o.name, o.network, COUNTRY_NAMES[o.country]].join(' ').toLowerCase().includes(q),
    )
  }, [query, kind])

  const routed = PROVIDER_LIST.filter((o) => o.routed).length

  return (
    <div className="overview providers">
      <header className="ov-head">
        <button className="ghost" onClick={onBack}>← Back to your trip</button>
        <div className="ov-title">
          <h1>Europe’s trains, in one place</h1>
          <p>
            {PROVIDER_LIST.length} rail companies and {PASS_LIST.length} passes and cards. You never have to pick one:
            we work out which tickets your trip needs and buy them for you.
          </p>
        </div>
      </header>

      <div className="pv-tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'companies'} className={tab === 'companies' ? 'on' : ''} onClick={() => setTab('companies')}>
          Rail companies <small>{PROVIDER_LIST.length}</small>
        </button>
        <button role="tab" aria-selected={tab === 'passes'} className={tab === 'passes' ? 'on' : ''} onClick={() => setTab('passes')}>
          Passes &amp; cards <small>{PASS_LIST.length}</small>
        </button>
      </div>

      {tab === 'companies' && (
        <>
          <div className="pv-filters">
            <input type="search" placeholder="Search by name, city or country" value={query} onChange={(e) => setQuery(e.target.value)} />
            <div className="pv-chips">
              {[['all', 'All'], ...Object.entries(KINDS)].map(([k, label]) => (
                <button key={k} className={kind === k ? 'on' : ''} onClick={() => setKind(k)}>{label}</button>
              ))}
            </div>
          </div>
          <p className="muted small">
            {routed} of these already power trip planning in this demo; the rest are next to connect.
            Timetables and fares are simulated for now.
          </p>
          <ul className="pv-grid">
            {companies.map((o) => (
              <li key={o.id} className="pv-card">
                <div className="pv-top">
                  <span className="op-badge" style={{ background: o.color }}>{o.short}</span>
                  <div>
                    <strong>{o.name}</strong>
                    <small>{COUNTRY_NAMES[o.country]} · {KINDS[o.kind]}</small>
                  </div>
                </div>
                <p>{o.network}</p>
                <div className="pv-tags">
                  <span className={`pv-tag ${INTERRAIL[o.interrail].tone}`}>{INTERRAIL[o.interrail].label}</span>
                  <span className="pv-tag">On sale ~{o.salesOpenDays} days ahead</span>
                  {o.routed && <span className="pv-tag live">In trip planner</span>}
                </div>
                <small className="muted">🎟 {o.delivery} · {o.site}</small>
              </li>
            ))}
          </ul>
          {companies.length === 0 && <p className="muted">No rail company matches that search.</p>}
        </>
      )}

      {tab === 'passes' && (
        <>
          <p className="muted small">
            Add the ones you have with “Your passes” on the trip page: every price then takes them into account.
            Prices and rules are estimates.
          </p>
          {Object.entries(PASS_GROUPS).map(([group, title]) => (
            <section key={group}>
              <h2 className="pv-h2">{title}</h2>
              <ul className="pv-grid">
                {PASS_LIST.filter((p) => p.group === group).map((p) => (
                  <li key={p.id} className="pv-card">
                    <strong>{p.name}</strong>
                    <small className="muted">{p.issuer} · {p.for}</small>
                    <p>{p.summary}</p>
                    <span className="pv-tag">{p.price}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </>
      )}
    </div>
  )
}
