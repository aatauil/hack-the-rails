// Demo trip maths: rough but believable numbers, no real timetable or pricing API.

import { AIRPORTS, HOTEL_EUR } from './data.js'

const RAIL_DETOUR = 1.2 // track is longer than the straight line
const FLIGHT_KG_PER_KM = 0.25 // per passenger, short-haul incl. airport overhead
const TRAIN_KG_PER_KM = { sustainable: 0.008, cheapest: 0.03, fastest: 0.02 }

// Eurailo pushes the greenest trip: it is the default everywhere, and other options are opt-in.
export const DEFAULT_OPTION = 'sustainable'

// CO₂ (kg, per passenger) for `km` of rail on a given kind of train.
export const trainKg = (km, optionId) => km * TRAIN_KG_PER_KM[optionId]

export const OPTIONS = [
  {
    id: 'sustainable',
    tag: 'Most sustainable',
    blurb: 'Direct electric trains on renewable power',
    speed: 140, // average km/h door to door
    eurPerKm: 0.24,
    departAt: [10, 30],
    changes: 0,
  },
  {
    id: 'cheapest',
    tag: 'Cheapest',
    blurb: 'Off-peak and regional trains, early starts',
    speed: 100,
    eurPerKm: 0.17,
    departAt: [7, 15],
    changes: 1,
  },
  {
    id: 'fastest',
    tag: 'Fastest',
    blurb: 'High-speed lines (TGV, ICE, Frecciarossa)',
    speed: 185,
    eurPerKm: 0.3,
    departAt: [9, 30],
    changes: 0,
  },
]

function haversineKm(a, b) {
  const R = 6371
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

const addMinutes = (d, m) => new Date(d.getTime() + m * 60000)
const addDays = (d, n) => {
  const x = new Date(d)
  x.setDate(x.getDate() + n)
  return x
}

// Train departure times on offer for every leg (same board for every route, for the demo).
export const DEPARTURE_TIMES = ['06:15', '07:15', '08:30', '09:30', '10:30', '12:00', '13:45', '15:30', '17:15', '19:00']

// Night trains: on long legs there is also an evening sleeper that gets in the next morning.
// A leg leaving from 19h that is at least `minKm` long is a night train.
export const NIGHT_TRAIN = { departs: '21:30', arrivesBy: [7, 30], minKm: 600 }
export const nightTrainPossible = (leg) => leg.km >= NIGHT_TRAIN.minKm

// Key for a leg's chosen train, e.g. "Paris>Geneva".
export const legKey = (from, to) => `${from}>${to}`

// Fares follow demand: early and late trains are cheaper, rush-hour trains dearer.
export function timeFactor(hour) {
  if (hour >= 19) return 0.9
  if (hour < 8) return 0.85
  if (hour < 10 || (hour >= 17 && hour < 19)) return 1.15
  return 1
}

// Build one option's timetable + totals for the chosen stops.
// `departures` maps legKey -> "HH:MM" for legs where the traveller picked their own train;
// other legs use the option's default departure time. `fares` maps legKey -> option id for legs
// where they swapped to another kind of train (e.g. a saver train on one leg of a fast trip).
export function planTrip(stops, option, startDate, start, departures = {}, fares = {}) {
  const legs = []
  let from = start
  let day = new Date(startDate)
  let totalKm = 0
  let totalMin = 0
  let price = 0
  let co2 = 0

  for (const stop of stops) {
    const key = legKey(from.name, stop.name)
    const opt = OPTIONS.find((o) => o.id === fares[key]) ?? option
    const km = haversineKm(from, stop) * RAIL_DETOUR
    const minutes = Math.round(((km / opt.speed) * 60 + 15 * (1 + opt.changes)) / 5) * 5
    const depart = new Date(day)
    const picked = departures[key]
    const [h, m] = picked ? picked.split(':').map(Number) : opt.departAt
    depart.setHours(h, m, 0, 0)
    let arrive = addMinutes(depart, minutes)
    const night = h >= 19 && km >= NIGHT_TRAIN.minKm
    if (night) {
      // Sleepers run slowly on purpose: you get in after breakfast time, not at 4 in the morning.
      const morning = addDays(depart, 1)
      morning.setHours(...NIGHT_TRAIN.arrivesBy, 0, 0)
      if (arrive < morning) arrive = morning
    }
    const ride = Math.round((arrive - depart) / 60000)
    const legPrice = Math.max(5, Math.round((km * opt.eurPerKm * timeFactor(h)) / 5) * 5)
    legs.push({ from: from.name, to: stop.name, km, minutes: ride, depart, arrive, night, option: opt.id, price: legPrice, co2Kg: trainKg(km, opt.id) })
    totalKm += km
    totalMin += ride
    price += legPrice
    co2 += trainKg(km, opt.id)
    day = addDays(arrive, stop.days) // leave after N nights
    from = stop
  }

  const flightKg = (totalKm / RAIL_DETOUR) * FLIGHT_KG_PER_KM
  return { ...option, legs, totalKm, totalMin, price, co2Kg: co2, savedKg: flightKg - co2 }
}

export function planAll(stops, startDate, start, departures, fares) {
  const plans = OPTIONS.map((o) => planTrip(stops, o, startDate, start, departures, fares))
  const maxPrice = Math.max(...plans.map((p) => p.price))
  const maxMin = Math.max(...plans.map((p) => p.totalMin))
  return plans.map((p) => ({
    ...p,
    headline:
      p.id === 'sustainable'
        ? `Save ${formatKg(p.savedKg)} of CO₂`
        : p.id === 'cheapest'
          ? `Save €${maxPrice - p.price}`
          : `Save ${formatDuration(maxMin - p.totalMin)} of travel`,
  }))
}

// --- Train versus plane, door to door ---------------------------------------------------
// Flight times on a booking site leave out most of the journey. These are the parts people
// forget, so the comparison is between city centre and city centre, not runway and runway.
export const FLIGHT_STEPS = {
  airportBeforeMin: 120, // be at the airport 2 hours before: bag drop, security, walk to the gate, boarding
  taxiMin: 30, // taxiing, take-off and landing on top of the time in the air
  cruiseKmh: 750,
  arrivalMin: 30, // getting off the plane and waiting for your bag
}
export const TRAIN_STEPS = { stationBeforeMin: 15, intoTownMin: 10 } // stations are in the city centre
const SHORT_HOP_KM = 300 // below this (as the crow flies) there are few or no direct flights

// One leg, door to door by train and by plane, split into the steps that make up each.
export function legVersusFlight(leg) {
  const crowKm = leg.km / RAIL_DETOUR
  const fromAirport = AIRPORTS[leg.from] ?? { code: '', transferMin: 40 }
  const toAirport = AIRPORTS[leg.to] ?? { code: '', transferMin: 40 }
  const airMin = Math.round((FLIGHT_STEPS.taxiMin + (crowKm / FLIGHT_STEPS.cruiseKmh) * 60) / 5) * 5
  const plane = [
    { id: 'transfer', label: `Into town to the airport (${fromAirport.code})`, min: fromAirport.transferMin },
    { id: 'airport', label: 'At the airport 2h early: bag drop, security, boarding', min: FLIGHT_STEPS.airportBeforeMin },
    { id: 'air', label: 'The flight itself', min: airMin },
    { id: 'bags', label: 'Off the plane, waiting for bags', min: FLIGHT_STEPS.arrivalMin },
    { id: 'transfer', label: `From ${toAirport.code} into town`, min: toAirport.transferMin },
  ]
  const train = [
    { id: 'station', label: 'At the station 15 min early', min: TRAIN_STEPS.stationBeforeMin },
    { id: leg.night ? 'sleep' : 'ride', label: leg.night ? 'Night train: you sleep on board' : 'On the train', min: leg.minutes },
    { id: 'station', label: 'Station to your hotel', min: TRAIN_STEPS.intoTownMin },
  ]
  const sum = (steps) => steps.reduce((n, s) => n + s.min, 0)
  const trainMin = sum(train)
  const planeMin = sum(plane)
  // What the journey takes out of your day. On a night train you are asleep for the ride,
  // so only the time at the stations counts.
  const trainDayMin = leg.night ? TRAIN_STEPS.stationBeforeMin + TRAIN_STEPS.intoTownMin : trainMin
  return {
    from: leg.from,
    to: leg.to,
    night: leg.night,
    shortHop: crowKm < SHORT_HOP_KM,
    train,
    plane,
    trainMin,
    planeMin,
    trainDayMin,
    savedMin: planeMin - trainDayMin, // > 0: the train takes less of your day than flying
    // Time you can actually use: a seat, a table and wifi the whole ride, versus the part of
    // the flight when the seatbelt sign is off.
    usableTrainMin: leg.night ? 0 : leg.minutes,
    usablePlaneMin: Math.max(0, airMin - 40),
    // A night train is also your bed: one less hotel night to pay for.
    hotelEur: leg.night ? (HOTEL_EUR[leg.to] ?? 130) : 0,
  }
}

// The whole trip versus flying it. Totals only count legs where flying is a real option;
// on short hops there are no direct flights, so the train is the only way to go.
export function compareWithFlying(plan, travellers = 1) {
  const legs = plan.legs.map(legVersusFlight)
  const flyable = legs.filter((l) => !l.shortHop)
  const sum = (list, k) => list.reduce((n, l) => n + l[k], 0)
  const rooms = Math.ceil(Math.max(1, travellers) / 2)
  return {
    legs,
    flyableLegs: flyable.length,
    trainMin: sum(flyable, 'trainDayMin'),
    planeMin: sum(flyable, 'planeMin'),
    savedMin: sum(flyable, 'savedMin'),
    usableTrainMin: sum(legs, 'usableTrainMin'),
    usablePlaneMin: sum(flyable, 'usablePlaneMin'),
    nightLegs: legs.filter((l) => l.night),
    hotelSavedEur: sum(legs, 'hotelEur') * rooms,
    co2SavedKg: plan.savedKg,
  }
}

export function formatKg(kg) {
  if (kg >= 1000) return `${(kg / 1000).toFixed(1)} t`
  // Small amounts (one leg, one swap) to the kg, so a real difference never shows as "0 kg".
  return kg < 100 ? `${Math.max(1, Math.round(kg))} kg` : `${Math.round(kg / 10) * 10} kg`
}

export function formatDuration(min) {
  const h = Math.floor(min / 60)
  const m = min % 60
  return h ? `${h}h${m ? ` ${String(m).padStart(2, '0')}m` : ''}` : `${m}m`
}

export const fmtDate = (d) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })
export const fmtTime = (d) => `${d.getHours()}h${String(d.getMinutes()).padStart(2, '0')}`

// "10 Dec – 19 Dec" for a trip of `days` days starting on an ISO date.
export function fmtShortRange(isoDate, days) {
  const a = new Date(`${isoDate}T00:00:00`)
  const b = new Date(a)
  b.setDate(b.getDate() + days)
  const f = (d) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  return `${f(a)} – ${f(b)}`
}
