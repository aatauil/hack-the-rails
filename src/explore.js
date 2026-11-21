// Explore page maths: when you leave, how long you go, and what each destination looks like
// from where you are (price, time on the train, weather that time of year).
// Prices come from the same trip maths as the overview, so "from €45" here is what you see there.

import { STATIONS } from './data.js'
import { OPTIONS, planTrip } from './trip.js'

export const WHEN = [
  { id: 'week', label: 'This week' },
  { id: 'month', label: 'Next month' },
  { id: 'half', label: 'Next 6 months' },
]

// Nights away, and the longest single train ride that still fits a trip that long.
export const LENGTH = [
  { id: 'weekend', label: 'Weekend', nights: 2, maxRideMin: 5 * 60 },
  { id: 'week', label: '1 week', nights: 7, maxRideMin: 9 * 60 },
  { id: 'two', label: '2 weeks', nights: 14, maxRideMin: Infinity },
]

// --- Weather -------------------------------------------------------------------------------
// Typical daytime high (°C) per month for a few climate types, plus a per-city nudge.
// Rough averages, good enough to tell "beach weather" from "bring a coat".
const CLIMATES = {
  maritime: { highs: [6, 7, 11, 14, 18, 21, 23, 23, 19, 15, 10, 7], wet: [0, 1, 2, 9, 10, 11] },
  continental: { highs: [2, 5, 10, 15, 20, 23, 25, 25, 20, 14, 7, 3], wet: [10] },
  southwest: { highs: [10, 12, 15, 17, 21, 25, 27, 28, 24, 19, 14, 11], wet: [0, 10, 11] },
  po: { highs: [7, 10, 15, 19, 24, 28, 30, 29, 25, 18, 12, 7], wet: [10] },
  med: { highs: [13, 14, 16, 18, 22, 26, 29, 29, 26, 22, 17, 14], wet: [] },
}
const CITY_CLIMATE = {
  London: ['maritime', 0], Lille: ['maritime', 0], Brussels: ['maritime', 0], Amsterdam: ['maritime', -1],
  Rotterdam: ['maritime', -1], Paris: ['maritime', 1], Hamburg: ['maritime', -1], Cologne: ['maritime', 1],
  Luxembourg: ['continental', 0], Frankfurt: ['continental', 1], Strasbourg: ['continental', 1],
  Basel: ['continental', 1], Zurich: ['continental', 0], Bern: ['continental', -1], Lausanne: ['continental', 1],
  Geneva: ['continental', 1], Munich: ['continental', 0], Innsbruck: ['continental', 0], Salzburg: ['continental', 0],
  Vienna: ['continental', 1], Prague: ['continental', 0], Berlin: ['continental', 0],
  Bordeaux: ['southwest', 0], Toulouse: ['southwest', 0],
  Lyon: ['po', -1], Turin: ['po', -1], Milan: ['po', 0], Venice: ['po', -1], Florence: ['po', 2],
  Marseille: ['med', 0], Nice: ['med', 0], Barcelona: ['med', 0], Rome: ['med', 1],
}

export function weather(city, month) {
  const [type, nudge] = CITY_CLIMATE[city] ?? ['continental', 0]
  const c = CLIMATES[type]
  const high = c.highs[month] + nudge
  const icon = high >= 24 || (type === 'med' && high >= 17) ? '☀️' : high <= 4 ? '❄️' : c.wet.includes(month) ? '🌧️' : '⛅'
  return { high, icon, month }
}

export const monthName = (m) => new Date(2000, m, 1).toLocaleDateString('en-GB', { month: 'short' })

// --- Dates ---------------------------------------------------------------------------------
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
function nextFriday(from) {
  const d = new Date(from)
  d.setDate(d.getDate() + 1)
  while (d.getDay() !== 5) d.setDate(d.getDate() + 1)
  return d
}
const monthStart = (today, k) => new Date(today.getFullYear(), today.getMonth() + k, 1)

// Months a "when" choice covers, as { year, month, date } where date is a sensible day to leave.
export function windowMonths(when, today = new Date()) {
  if (when === 'week') {
    const d = nextFriday(today)
    return [{ month: d.getMonth(), date: iso(d) }]
  }
  const ks = when === 'month' ? [1] : [0, 1, 2, 3, 4, 5]
  return ks.map((k) => {
    const d = k === 0 ? nextFriday(today) : nextFriday(new Date(monthStart(today, k).getTime() - 86400000))
    return { month: d.getMonth(), date: iso(d) }
  })
}

// The month in the window with the warmest weather across `cities`: that is when we suggest leaving.
export function bestMonth(months, cities) {
  if (months.length === 1 || cities.length === 0) return months[0]
  const score = (m) => cities.reduce((n, c) => n + weather(c, m.month).high, 0)
  return months.reduce((best, m) => (score(m) > score(best) ? m : best))
}

// --- Destinations --------------------------------------------------------------------------
const CHEAPEST = OPTIONS.find((o) => o.id === 'cheapest')
const FASTEST = OPTIONS.find((o) => o.id === 'fastest')

// Every city you could go next from `from`, cheapest first, with what it costs, how long the
// train takes, whether that fits the trip length, and the weather when you would be there.
export function destinations({ from, exclude, length, months }) {
  const date = new Date(`${months[0].date}T00:00:00`)
  return STATIONS.filter((s) => s.name !== from.name && !exclude.has(s.name))
    .map((s) => {
      const stop = [{ ...s, days: 1 }]
      const cheap = planTrip(stop, CHEAPEST, date, from)
      const fast = planTrip(stop, FASTEST, date, from)
      const best = bestMonth(months, [s.name])
      return {
        ...s,
        price: cheap.price,
        minutes: fast.totalMin,
        savedKg: fast.savedKg,
        fits: fast.totalMin <= length.maxRideMin,
        weather: weather(s.name, best.month),
        months: months.map((m) => weather(s.name, m.month)),
      }
    })
    .sort((a, b) => b.fits - a.fits || a.price - b.price)
}

// Share the trip's nights across the stops (earlier stops get the spare nights).
export function spreadDays(count, nights) {
  const base = Math.max(1, Math.floor(nights / count))
  const extra = Math.max(0, nights - base * count)
  return Array.from({ length: count }, (_, i) => base + (i < extra ? 1 : 0))
}
