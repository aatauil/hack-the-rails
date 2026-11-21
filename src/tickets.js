// Turns a planned trip into the actual tickets we have to buy, one per rail company.
// Shared by the browser (to show the breakdown) and the server (to charge for it), so the
// amount Stripe charges is always computed from the same rules the customer saw.

import { STATIONS } from './data.js'
import { planTrip, OPTIONS } from './trip.js'
import { PROVIDERS } from './providers.js'
import { bestPassFare } from './passes.js'

// What Eurailo adds on top of the rail companies' fares, per booking (in cents).
// Shown as its own line at checkout so the customer sees exactly what goes to whom.
export const BOOKING_FEE_CENTS = 0
export const CURRENCY = 'eur'
export const MAX_TRAVELLERS = 9
const CHANGE_MINUTES = 45 // time we leave to change between two separately ticketed trains

export const COUNTRY = {
  Brussels: 'BE', Paris: 'FR', Lille: 'FR', Amsterdam: 'NL', Rotterdam: 'NL', Cologne: 'DE',
  Luxembourg: 'LU', Frankfurt: 'DE', Strasbourg: 'FR', Basel: 'CH', Zurich: 'CH', Bern: 'CH',
  Lausanne: 'CH', Geneva: 'CH', Lyon: 'FR', Marseille: 'FR', Nice: 'FR', Turin: 'IT', Milan: 'IT',
  Venice: 'IT', Florence: 'IT', Rome: 'IT', Munich: 'DE', Innsbruck: 'AT', Salzburg: 'AT',
  Vienna: 'AT', Prague: 'CZ', Berlin: 'DE', Hamburg: 'DE', London: 'GB', Barcelona: 'ES',
  Bordeaux: 'FR', Toulouse: 'FR',
}

// Every rail company (name, colour, ticket delivery, booking horizon) lives in providers.js.
export const OPERATORS = PROVIDERS

// The national operator you'd buy from inside each country.
const NATIONAL = { FR: 'sncf', BE: 'sncb', NL: 'ns', DE: 'db', LU: 'cfl', CH: 'sbb', IT: 'trenitalia', AT: 'obb', CZ: 'cd', ES: 'renfe', GB: 'eurostar' }

// Train brands by operator and fare type.
const BRAND = {
  fast: { sncf: 'TGV INOUI', db: 'ICE', trenitalia: 'Frecciarossa', italo: 'Italo', obb: 'Railjet', sbb: 'InterCity', sncb: 'InterCity', ns: 'Intercity direct', renfe: 'AVE', cd: 'Railjet', cfl: 'InterCity', eurostar: 'Eurostar' },
  cheap: { sncf: 'OUIGO', db: 'IC Sparpreis', trenitalia: 'Regionale Veloce', italo: 'Italo Low Cost', obb: 'Sparschiene', sbb: 'IR Supersaver', sncb: 'InterCity', ns: 'Intercity', renfe: 'Avlo', cd: 'EuroCity', cfl: 'Regional', eurostar: 'Eurostar Standard' },
}

// Fare rules depend on the kind of fare we buy for each package.
const CONDITIONS = {
  sustainable: { label: 'Semi-flex', exchange: 'Free exchange until 1 day before', refund: 'Refundable minus a fee until 1 day before' },
  fastest: { label: 'Flex', exchange: 'Free exchange until departure', refund: 'Refundable until departure' },
  cheapest: { label: 'Saver', exchange: 'No exchanges', refund: 'Non-refundable' },
}

// Trains that run on high-speed lines. Everything else is drawn as a regional train.
const HIGH_SPEED = new Set(['TGV INOUI', 'OUIGO', 'ICE', 'Frecciarossa', 'Italo', 'Italo Low Cost', 'Railjet', 'AVE', 'Avlo', 'Eurostar', 'Eurostar Standard'])

// Trains where a seat reservation is compulsory, and what a rail-pass holder pays for one
// (in cents, per person). With normal tickets the reservation is already in the fare.
const RESERVATION_CENTS = {
  'TGV INOUI': 2000, OUIGO: 1000, Frecciarossa: 1300, Italo: 1500, 'Italo Low Cost': 1500,
  AVE: 1000, Avlo: 1000, Eurostar: 3000, 'Eurostar Standard': 3000, 'Night train': 2500,
}

// A long overnight ride is a night train (couchette), whatever runs it in the daytime.
const isNight = (depart, minutes) => depart.getHours() >= 19 && minutes >= 360

const byName = Object.fromEntries(STATIONS.map((s) => [s.name, s]))
const THALYS_NET = new Set(['Paris', 'Brussels', 'Amsterdam', 'Rotterdam', 'Cologne', 'Lille'])

function km(a, b) {
  const R = 6371
  const r = (d) => (d * Math.PI) / 180
  const h = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

// Who runs the direct train between two cities.
function directOperator(from, to) {
  const a = COUNTRY[from], b = COUNTRY[to]
  if (a === 'GB' || b === 'GB') return 'eurostar'
  if (a === b) return NATIONAL[a]
  if (a !== b && THALYS_NET.has(from) && THALYS_NET.has(to)) return 'eurostar'
  const pair = [a, b].sort().join('-')
  const CROSS = {
    'DE-FR': 'sncf', 'CH-FR': 'sncf', 'FR-IT': 'sncf', 'ES-FR': 'renfe', 'BE-LU': 'sncb', 'FR-LU': 'sncf',
    'AT-DE': 'obb', 'AT-IT': 'obb', 'AT-CH': 'obb', 'CH-DE': 'db', 'CH-IT': 'sbb', 'CZ-DE': 'cd',
    'AT-CZ': 'cd', 'BE-DE': 'db', 'BE-NL': 'ns', 'DE-NL': 'db', 'DE-LU': 'cfl',
  }
  return CROSS[pair] ?? NATIONAL[a]
}

// The cheapest way across a border is usually two national tickets with a change in between.
function changeStation(from, to) {
  const a = byName[from], b = byName[to]
  const direct = km(a, b)
  let best = null
  for (const s of STATIONS) {
    if (s.name === from || s.name === to) continue
    const via = km(a, s) + km(s, b)
    if (via <= direct * 1.3 && (!best || via < best.via)) best = { station: s, via }
  }
  return best?.station ?? null
}

const round5 = (m) => Math.round(m / 5) * 5
const addMin = (d, m) => new Date(d.getTime() + m * 60000)

// Split a leg into one or more tickets, each sold by one operator.
function legTickets(leg, optionId) {
  const fare = optionId === 'cheapest' ? 'cheap' : 'fast'
  const crossBorder = COUNTRY[leg.from] !== COUNTRY[leg.to]
  const via = optionId === 'cheapest' && crossBorder ? changeStation(leg.from, leg.to) : null
  const segOperators = via ? [segmentOperator(leg.from, via.name), segmentOperator(via.name, leg.to)] : null

  if (!via || segOperators[0] === segOperators[1]) {
    const op = directOperator(leg.from, leg.to)
    return [{ from: leg.from, to: leg.to, depart: leg.depart, arrive: leg.arrive, km: leg.km, operator: op, service: BRAND[fare][op], night: leg.night }]
  }

  const d1 = km(byName[leg.from], via), d2 = km(via, byName[leg.to])
  const ride = leg.minutes - CHANGE_MINUTES
  const m1 = round5((ride * d1) / (d1 + d2))
  const arrive1 = addMin(leg.depart, m1)
  return [
    { from: leg.from, to: via.name, depart: leg.depart, arrive: arrive1, km: (leg.km * d1) / (d1 + d2), operator: segOperators[0], service: BRAND.cheap[segOperators[0]] },
    { from: via.name, to: leg.to, depart: addMin(arrive1, CHANGE_MINUTES), arrive: leg.arrive, km: (leg.km * d2) / (d1 + d2), operator: segOperators[1], service: BRAND.cheap[segOperators[1]] },
  ]
}

// Saver tickets come from the national operator where that train starts (Eurostar for London).
function segmentOperator(from, to) {
  if (COUNTRY[from] === 'GB' || COUNTRY[to] === 'GB') return 'eurostar'
  return NATIONAL[COUNTRY[from]]
}

// Share `totalCents` across items by weight, so the parts always add up to the total.
function allocate(totalCents, weights) {
  const sum = weights.reduce((a, b) => a + b, 0) || 1
  const raw = weights.map((w) => (totalCents * w) / sum)
  const out = raw.map((x) => Math.floor(x / 10) * 10) // whole 10-cent amounts look like real fares
  let left = totalCents - out.reduce((a, b) => a + b, 0)
  const order = raw.map((x, i) => [x - out[i], i]).sort((a, b) => b[0] - a[0])
  for (let k = 0; left > 0; k = (k + 1) % out.length) {
    const step = Math.min(10, left)
    out[order[k][1]] += step
    left -= step
  }
  return out
}

// Everything checkout needs: the tickets, who sells them, and what the customer pays.
export function buildQuote({ start, startDate, stops, optionId, travellers, departures = {}, passes = [] }) {
  const option = OPTIONS.find((o) => o.id === optionId)
  const origin = byName[start]
  const plan = planTrip(stops.map((s) => ({ ...byName[s.name], days: s.days })), option, new Date(`${startDate}T00:00:00`), origin, departures)

  const tickets = plan.legs.flatMap((leg, legIndex) =>
    legTickets(leg, optionId).map((t, i, arr) => ({ ...t, legIndex, splitLeg: arr.length > 1, part: i })),
  )
  const perPerson = allocate(plan.price * 100, tickets.map((t) => t.km))
  const count = Math.max(1, travellers)

  const items = tickets.map((t, i) => {
    const night = t.night || isNight(t.depart, (t.arrive - t.depart) / 60000)
    const service = night ? 'Night train' : t.service
    const kind = night ? 'night' : HIGH_SPEED.has(service) ? 'highspeed' : 'regional'
    const reservationCents = RESERVATION_CENTS[service] ?? 0
    // Passes and discount cards the traveller already holds.
    const fare = bestPassFare(
      { operator: t.operator, service, kind, fromCountry: COUNTRY[t.from], toCountry: COUNTRY[t.to], saver: optionId === 'cheapest' },
      perPerson[i], reservationCents, passes,
    )
    return {
      id: `T${i + 1}`,
      legIndex: t.legIndex,
      from: t.from,
      to: t.to,
      depart: t.depart.toISOString(),
      arrive: t.arrive.toISOString(),
      operator: t.operator,
      service,
      kind,
      reservationRequired: service in RESERVATION_CENTS,
      passReservationCents: reservationCents,
      splitLeg: t.splitLeg,
      changeAfter: t.splitLeg && t.part === 0 ? CHANGE_MINUTES : null,
      conditions: CONDITIONS[optionId],
      fullUnitCents: perPerson[i],
      unitCents: fare.cents,
      totalCents: fare.cents * count,
      pass: fare.pass, // id of the pass or card that lowered this fare, if any
      passHow: fare.how,
    }
  })

  const byOperator = {}
  for (const t of items) {
    byOperator[t.operator] ??= { operator: t.operator, tickets: 0, cents: 0 }
    byOperator[t.operator].tickets += 1
    byOperator[t.operator].cents += t.totalCents
  }

  const ticketsCents = items.reduce((n, t) => n + t.totalCents, 0)
  const fullTicketsCents = items.reduce((n, t) => n + t.fullUnitCents * count, 0)
  return {
    optionId,
    optionTag: option.tag,
    travellers: count,
    tickets: items,
    operators: Object.values(byOperator),
    ticketsCents,
    passes,
    passSavingsCents: fullTicketsCents - ticketsCents,
    feeCents: BOOKING_FEE_CENTS,
    totalCents: ticketsCents + BOOKING_FEE_CENTS,
    currency: CURRENCY,
  }
}

export const money = (cents) =>
  (cents / 100).toLocaleString('en-IE', { style: 'currency', currency: 'EUR', minimumFractionDigits: cents % 100 ? 2 : 0 })
