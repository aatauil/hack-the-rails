// Ticket breakdown shared by checkout and the confirmation page: which rail company sells
// which part of the trip, at what price, and under which conditions.
import { OPERATORS, money } from './tickets.js'
import { fmtTime } from './trip.js'
import { PASSES } from './passes.js'

const fmtDay = (iso) => new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })

export function OperatorBadge({ id, size = 'md' }) {
  const op = OPERATORS[id]
  return (
    <span className={`op-badge ${size}`} style={{ background: op.color }} title={op.name}>
      {op.short}
    </span>
  )
}

const STATUS = {
  not_booked: null,
  requested: { label: 'Booking with operator', tone: 'wait' },
  issued: { label: 'Ticket issued', tone: 'ok' },
  failed: { label: 'Needs attention', tone: 'bad' },
}

function TicketCard({ t, travellers, showStatus }) {
  const op = OPERATORS[t.operator]
  const status = showStatus ? STATUS[t.status] : null
  return (
    <li className="tk">
      <OperatorBadge id={t.operator} />
      <div className="tk-main">
        <div className="tk-route">
          <strong>{fmtTime(new Date(t.depart))}</strong> {t.from}
          <span className="tk-arrow">→</span>
          <strong>{fmtTime(new Date(t.arrive))}</strong> {t.to}
        </div>
        <div className="tk-sub">
          Sold by <strong>{op.name}</strong> · {t.service} · {t.conditions.label} fare
        </div>
        <div className="tk-rules">
          <span>↔ {t.conditions.exchange}</span>
          <span>↩ {t.conditions.refund}</span>
        </div>
        {t.pass && <div className="tk-pass">🎫 {PASSES[t.pass]?.name}: {t.passHow}</div>}
        {status && (
          <div className={`tk-status ${status.tone}`}>
            {status.tone === 'wait' && <span className="spinner" />}
            {status.label}
            {t.reference ? ` · ref ${t.reference}` : status.tone === 'wait' ? ` · ${op.short}` : ''}
          </div>
        )}
      </div>
      <div className="tk-price">
        {t.pass && t.fullUnitCents > t.unitCents && <s className="tk-was">{money(t.fullUnitCents * travellers)}</s>}
        {money(t.totalCents)}
        {travellers > 1 && <small>{travellers} × {money(t.unitCents)}</small>}
      </div>
    </li>
  )
}

// Tickets grouped per journey day, with a clear warning wherever one train ride needs two tickets.
export function TicketList({ quote, showStatus = false }) {
  const legs = []
  for (const t of quote.tickets) (legs[t.legIndex] ??= []).push(t)
  return (
    <div className="tk-legs">
      {legs.map((tickets, i) => (
        <section className="tk-leg" key={i}>
          <h4>
            {fmtDay(tickets[0].depart)} · {tickets[0].from} → {tickets.at(-1).to}
            {tickets.length > 1 && <span className="tk-pill">{tickets.length} tickets</span>}
          </h4>
          <ul>
            {tickets.map((t) => (
              <FragmentWithChange key={t.id} t={t} travellers={quote.travellers} showStatus={showStatus} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

function FragmentWithChange({ t, travellers, showStatus }) {
  return (
    <>
      <TicketCard t={t} travellers={travellers} showStatus={showStatus} />
      {t.changeAfter && (
        <li className="tk-change">
          <span>🔁 Change in <strong>{t.to}</strong> · {t.changeAfter} min</span>
          <span className="tk-change-note">
            Two separate tickets: if the first train is late, the next company doesn’t have to rebook you.
            That’s why we leave {t.changeAfter} minutes to change.
          </span>
        </li>
      )}
    </>
  )
}

// "Who gets your money": one line per rail company, plus our own fee.
export function PriceBreakdown({ quote }) {
  return (
    <dl className="breakdown">
      {quote.operators.map((o) => (
        <div key={o.operator}>
          <dt>
            <OperatorBadge id={o.operator} size="sm" /> {OPERATORS[o.operator].name}
            <small> · {o.tickets} {o.tickets === 1 ? 'ticket' : 'tickets'}</small>
          </dt>
          <dd>{money(o.cents)}</dd>
        </div>
      ))}
      {quote.passSavingsCents > 0 && (
        <div className="saved">
          <dt>Saved with your passes &amp; cards</dt>
          <dd>−{money(quote.passSavingsCents)}</dd>
        </div>
      )}
      <div className="fee">
        <dt>Eurailo booking fee</dt>
        <dd>{quote.feeCents ? money(quote.feeCents) : 'Free'}</dd>
      </div>
      <div className="total">
        <dt>Total{quote.travellers > 1 ? ` for ${quote.travellers} travellers` : ''}</dt>
        <dd>{money(quote.totalCents)}</dd>
      </div>
    </dl>
  )
}
