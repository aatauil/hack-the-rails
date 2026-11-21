// Things worth telling the traveller about their trip: totals, warnings, status per leg,
// and whether a rail pass would have been cheaper. Pure functions over a planned trip
// (`planTrip`) and its quote (`buildQuote`), so they stay in sync with what checkout charges.

import { COUNTRY, OPERATORS } from './tickets.js'
import { fmtTime, nightTrainPossible, NIGHT_TRAIN } from './trip.js'
import { HOTEL_EUR } from './data.js'

const DAY_MS = 86400000
const WAKING_HOURS = 14 // per day: what "share of your trip on trains" is measured against

// Cities whose trains leave from different stations depending on where they go.
const CITY_STATIONS = {
  Paris: {
    fallback: 'Gare de Lyon',
    transferMin: 30,
    how: 'RER or metro',
    by: {
      'Gare du Nord': ['London', 'Lille', 'Brussels', 'Amsterdam', 'Rotterdam', 'Cologne'],
      'Gare de l’Est': ['Strasbourg', 'Luxembourg', 'Frankfurt', 'Munich', 'Hamburg', 'Berlin', 'Vienna', 'Prague', 'Salzburg'],
      Montparnasse: ['Bordeaux', 'Toulouse'],
    },
  },
  Milan: {
    fallback: 'Centrale',
    transferMin: 20,
    how: 'metro line M2',
    by: { 'Porta Garibaldi': ['Paris', 'Lyon'] },
  },
}

// Which station in `city` you use for a train to or from `other`, or null if there is only one.
export function stationFor(city, other) {
  const c = CITY_STATIONS[city]
  if (!c) return null
  return Object.entries(c.by).find(([, list]) => list.includes(other))?.[0] ?? c.fallback
}

const shortDate = (d) => d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate())

// Status levels, each with its own colour *and* icon so it reads without colour too.
export const LEVELS = {
  ok: { icon: '✓', label: 'Ready to book' },
  warn: { icon: '!', label: 'Needs attention' },
  info: { icon: 'i', label: 'Good to know' },
}

// Notes for one leg (one train ride, maybe split over two tickets).
export function legNotes(leg, tickets, today = new Date()) {
  const notes = []

  // Booking window: not on sale yet, or close enough that fares climb.
  for (const t of tickets) {
    const opens = new Date(new Date(t.depart).getTime() - OPERATORS[t.operator].salesOpenDays * DAY_MS)
    if (opens > today) {
      notes.push({ level: 'warn', text: `${t.from} → ${t.to} goes on sale around ${opens.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}. You can book this leg from then.` })
    }
  }
  const daysAway = Math.round((startOfDay(leg.depart) - startOfDay(today)) / DAY_MS)
  if (daysAway >= 0 && daysAway <= 21) {
    notes.push({ level: 'info', text: `Leaves in ${daysAway} ${daysAway === 1 ? 'day' : 'days'}: fares usually go up as the date gets closer.` })
  }

  // A change of station halfway, with only the fixed buffer between two tickets.
  for (let i = 0; i < tickets.length - 1; i++) {
    const a = tickets[i], b = tickets[i + 1]
    const via = a.to
    const inSt = stationFor(via, a.from), outSt = stationFor(via, b.to)
    const buffer = Math.round((new Date(b.depart) - new Date(a.arrive)) / 60000)
    if (inSt && outSt && inSt !== outSt) {
      const c = CITY_STATIONS[via]
      const tight = buffer < c.transferMin + 20
      notes.push({
        level: tight ? 'warn' : 'info',
        text: `Change stations in ${via}: ${inSt} → ${outSt}, about ${c.transferMin} min by ${c.how}.${tight ? ` Your ${buffer} min change is tight.` : ''}`,
      })
    } else if (buffer < 15) {
      notes.push({ level: 'warn', text: `Only ${buffer} min to change trains in ${via}.` })
    }
  }

  if (COUNTRY[leg.from] === 'GB' || COUNTRY[leg.to] === 'GB') {
    notes.push({ level: 'info', text: 'London is on UK time, 1 hour behind the continent.' })
  }
  const night = tickets.some((t) => t.kind === 'night')
  if (!night && leg.minutes > 7 * 60) {
    notes.push({ level: 'info', text: `Long travel day: ${Math.round(leg.minutes / 60)} hours on the train.` })
  }
  if (!night && nightTrainPossible(leg)) {
    notes.push({
      level: 'info',
      text: `Tip: take the ${NIGHT_TRAIN.departs.replace(':', 'h')} night train instead. You sleep on board, wake up in ${leg.to} and skip a hotel night (about €${HOTEL_EUR[leg.to] ?? 130}).`,
    })
  }
  return notes
}

// Notes for a stay between arriving (`inLeg`) and leaving (`outLeg`, null for the last stop).
export function stayNotes(city, inLeg, outLeg) {
  const notes = []
  const h = inLeg.arrive.getHours()
  const overnight = inLeg.arrive.getDate() !== inLeg.depart.getDate()
  if (h >= 22 || (overnight && h < 5)) {
    notes.push({ level: 'warn', text: `Late arrival at ${fmtTime(inLeg.arrive)}. Let your accommodation know you'll check in late.` })
  } else if (h < 13) {
    notes.push({ level: 'info', text: `You arrive at ${fmtTime(inLeg.arrive)}. Hotel check-in is usually from 15h, so plan to drop your bags at the station lockers.` })
  }
  if (outLeg) {
    const inSt = stationFor(city, inLeg.from), outSt = stationFor(city, outLeg.to)
    if (inSt && outSt && inSt !== outSt) {
      notes.push({ level: 'info', text: `You arrive at ${city} ${inSt} but leave from ${city} ${outSt}.` })
    }
  }
  return notes
}

// The worst level in a list of notes decides a leg's status.
export const statusOf = (notes) => (notes.some((n) => n.level === 'warn') ? 'warn' : 'ok')

// Headline numbers for the whole trip.
export function tripTotals({ plan, quote, start, stops, startDate, endDate }) {
  const days = Math.max(1, Math.round((startOfDay(endDate) - startOfDay(startDate)) / DAY_MS))
  const countries = new Set([start, ...stops].map((s) => COUNTRY[s.name])).size
  const reservations = quote.tickets.filter((t) => t.reservationRequired).length
  return {
    days,
    cities: stops.length,
    countries,
    travelMin: plan.totalMin,
    travelShare: plan.totalMin / (days * WAKING_HOURS * 60),
    ticketsCents: quote.ticketsCents,
    feeCents: quote.feeCents,
    totalCents: quote.totalCents,
    reservations,
    co2Kg: plan.co2Kg,
    savedKg: plan.savedKg,
  }
}

// Rough adult 2nd-class prices of a Europe-wide rail pass (per person, in cents):
// travel days, and how many days you get to use them in.
const PASSES = [
  { travelDays: 4, withinDays: 30, cents: 28300 },
  { travelDays: 5, withinDays: 30, cents: 32300 },
  { travelDays: 7, withinDays: 30, cents: 38100 },
  { travelDays: 10, withinDays: 60, cents: 45500 },
  { travelDays: 15, withinDays: 60, cents: 56100 },
]

// Would a rail pass (plus the seat reservations it doesn't cover) beat separate tickets?
// Per person. Returns null when no pass fits the trip.
export function passComparison({ plan, quote, startDate, endDate }) {
  const travelDays = new Set(plan.legs.map((l) => startOfDay(l.depart).getTime())).size
  const span = Math.round((startOfDay(endDate) - startOfDay(startDate)) / DAY_MS) + 1
  const pass = PASSES.find((p) => p.travelDays >= travelDays && p.withinDays >= span)
  if (!pass) return null
  const perPerson = quote.travellers || 1
  const ticketsCents = Math.round(quote.ticketsCents / perPerson)
  const reservationsCents = quote.tickets.reduce((n, t) => n + t.passReservationCents, 0)
  const passTotalCents = pass.cents + reservationsCents
  return {
    pass,
    travelDays,
    ticketsCents,
    reservationsCents,
    passTotalCents,
    savingCents: Math.abs(ticketsCents - passTotalCents),
    winner: ticketsCents <= passTotalCents ? 'tickets' : 'pass',
  }
}
