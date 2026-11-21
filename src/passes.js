// Rail passes and discount cards a traveller may already own. When they tell us, buildQuote()
// prices each ticket with the best card they hold, so the total they pay already reflects it.
// Shared by the browser and the server like the rest of the pricing.
//
// Rules and percentages are simplified from each card's public conditions (hackathon
// estimates, check before launch). `price` is only shown for information: Eurailo does not
// sell passes, it only takes the ones you have into account.
//
// Each pass has `covers(ticket)` returning how it changes the fare for one person:
//   { free: true }        the pass is the ticket (a pass-holder seat reservation may still apply)
//   { pct: 0.25 }         that share off the fare
//   null                  not valid on this train

import { PROVIDERS } from './providers.js'

// Trains that are never covered by Interrail / Eurail, whatever company runs them.
const NO_PASS_SERVICES = new Set(['OUIGO', 'Italo', 'Italo Low Cost', 'Avlo'])
// Long-distance DB trains (so not valid with regional-only tickets).
const DB_LONG_DISTANCE = new Set(['ICE', 'IC Sparpreis', 'InterCity'])

const domestic = (t, cc) => t.fromCountry === cc && t.toCountry === cc
const acceptsInterrail = (t) => PROVIDERS[t.operator]?.interrail !== 'no' && !NO_PASS_SERVICES.has(t.service)

const interrailGlobal = (t) => (acceptsInterrail(t) ? { free: true } : null)

// One Country Passes we list. Same rules as the Global Pass, inside one country only.
const ONE_COUNTRY = { FR: 'France', DE: 'Germany', IT: 'Italy', CH: 'Switzerland', AT: 'Austria', ES: 'Spain', CZ: 'Czechia' }

export const PASS_GROUPS = {
  pass: 'Rail passes',
  card: 'Discount cards',
  local: 'National travel passes',
}

const LIST = [
  {
    id: 'interrail-global', group: 'pass', name: 'Interrail Global Pass', issuer: 'Eurail B.V.', for: 'European residents',
    price: 'From about €283 (4 travel days in a month)',
    summary: 'Unlimited trains in 33 countries on your travel days. High-speed and night trains need a paid seat reservation; OUIGO, Italo, Avlo and most independent operators are not included.',
    covers: interrailGlobal,
  },
  {
    id: 'eurail-global', group: 'pass', name: 'Eurail Global Pass', issuer: 'Eurail B.V.', for: 'Visitors from outside Europe',
    price: 'From about €283 (4 travel days in a month)',
    summary: 'The same pass as Interrail, for people who live outside Europe. Same reservation rules.',
    covers: interrailGlobal,
  },
  ...Object.entries(ONE_COUNTRY).map(([cc, country]) => ({
    id: `interrail-${cc.toLowerCase()}`, group: 'pass', name: `Interrail ${country} Pass`, issuer: 'Eurail B.V.', for: 'European residents',
    price: 'From about €130 (3 travel days in a month)',
    summary: `Unlimited trains inside ${country} on your travel days. Reservations as for the Global Pass.`,
    covers: (t) => (domestic(t, cc) ? interrailGlobal(t) : null),
  })),
  {
    id: 'swiss-travel-pass', group: 'pass', name: 'Swiss Travel Pass', issuer: 'Swiss Travel System', for: 'Visitors to Switzerland',
    price: 'From about CHF 244 (3 days)',
    summary: 'Free trains, buses and boats across Switzerland, no reservations needed.',
    covers: (t) => (domestic(t, 'CH') ? { free: true, noReservation: true } : null),
  },
  {
    id: 'ga', group: 'local', name: 'GA Travelcard', issuer: 'SBB', for: 'Swiss residents',
    price: 'About CHF 3,995 a year (2nd class)',
    summary: 'Free trains across Switzerland, all year.',
    covers: (t) => (domestic(t, 'CH') ? { free: true, noReservation: true } : null),
  },
  {
    id: 'half-fare', group: 'card', name: 'Swiss Half Fare Card', issuer: 'SBB', for: 'Anyone',
    price: 'About CHF 190 a year',
    summary: '50% off trains inside Switzerland.',
    covers: (t) => (domestic(t, 'CH') ? { pct: 0.5 } : null),
  },
  {
    id: 'bahncard-25', group: 'card', name: 'BahnCard 25', issuer: 'Deutsche Bahn', for: 'Anyone',
    price: 'About €63 a year (2nd class)',
    summary: '25% off DB tickets, including Saver fares and DB-sold international tickets.',
    covers: (t) => (t.operator === 'db' ? { pct: 0.25 } : null),
  },
  {
    id: 'bahncard-50', group: 'card', name: 'BahnCard 50', issuer: 'Deutsche Bahn', for: 'Anyone',
    price: 'About €250 a year (2nd class)',
    summary: '50% off flexible DB fares and 25% off Saver fares.',
    covers: (t) => (t.operator === 'db' ? { pct: t.saver ? 0.25 : 0.5 } : null),
  },
  {
    id: 'bahncard-100', group: 'local', name: 'BahnCard 100', issuer: 'Deutsche Bahn', for: 'Anyone',
    price: 'About €4,900 a year (2nd class)',
    summary: 'Free trains inside Germany, all year, ICE included.',
    covers: (t) => (t.operator === 'db' && domestic(t, 'DE') ? { free: true, noReservation: true } : null),
  },
  {
    id: 'deutschlandticket', group: 'local', name: 'Deutschlandticket', issuer: 'German transport companies', for: 'Anyone',
    price: '€63 a month',
    summary: 'Free regional trains, buses and trams in Germany. Not valid on ICE, IC or other long-distance trains.',
    covers: (t) => (domestic(t, 'DE') && t.kind === 'regional' && !DB_LONG_DISTANCE.has(t.service) ? { free: true, noReservation: true } : null),
  },
  {
    id: 'carte-avantage', group: 'card', name: 'SNCF Carte Avantage', issuer: 'SNCF', for: 'Ages 12–27, 27–59 (with weekends) or 60+',
    price: '€49 a year',
    summary: '30% off TGV INOUI and Intercités inside France. Not valid on OUIGO.',
    covers: (t) => (t.operator === 'sncf' && domestic(t, 'FR') && t.service !== 'OUIGO' ? { pct: 0.3 } : null),
  },
  {
    id: 'vorteilscard', group: 'card', name: 'ÖBB Vorteilscard', issuer: 'ÖBB', for: 'Anyone',
    price: 'About €67 a year',
    summary: 'Discounted ÖBB fares inside Austria (about a third off standard fares).',
    covers: (t) => (t.operator === 'obb' && domestic(t, 'AT') ? { pct: 0.33 } : null),
  },
  {
    id: 'klimaticket', group: 'local', name: 'KlimaTicket Österreich', issuer: 'Austrian government', for: 'Anyone',
    price: 'About €1,180 a year',
    summary: 'Free trains and public transport across Austria, Railjet included.',
    covers: (t) => (domestic(t, 'AT') && t.kind !== 'night' ? { free: true, noReservation: true } : null),
  },
  {
    id: 'ns-dal-voordeel', group: 'card', name: 'NS Dal Voordeel', issuer: 'NS', for: 'Anyone',
    price: 'About €5.60 a month',
    summary: '40% off off-peak trains inside the Netherlands.',
    covers: (t) => (domestic(t, 'NL') ? { pct: 0.4 } : null),
  },
  {
    id: 'cartafreccia', group: 'card', name: 'Trenitalia CartaFreccia', issuer: 'Trenitalia', for: 'Anyone',
    price: 'Free',
    summary: 'Loyalty card with points on Frecce trains; no fixed discount, so it does not change your fare here.',
    covers: () => null,
  },
]

export const PASSES = Object.fromEntries(LIST.map((pass) => [pass.id, pass]))
export const PASS_LIST = LIST

// The best price one person pays for `ticket` with the passes they hold.
// `fullCents`: the normal fare; `reservationCents`: what a pass holder pays for a seat.
export function bestPassFare(ticket, fullCents, reservationCents, passIds = []) {
  let best = { cents: fullCents, pass: null, how: null }
  for (const id of passIds) {
    const pass = PASSES[id]
    const cover = pass?.covers(ticket)
    if (!cover) continue
    let cents, how
    if (cover.free) {
      cents = cover.noReservation ? 0 : reservationCents
      how = cents ? 'seat reservation only' : 'free with your pass'
    } else {
      cents = Math.round((fullCents * (1 - cover.pct)) / 10) * 10
      how = `${Math.round(cover.pct * 100)}% off`
    }
    if (cents < best.cents) best = { cents, pass: id, how }
  }
  return best
}

// Keep only known pass ids (used by the server to clean what the browser sends).
export const cleanPasses = (ids) =>
  Array.isArray(ids) ? [...new Set(ids.map(String).filter((id) => id in PASSES))].slice(0, 10) : []
