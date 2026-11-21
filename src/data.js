// Hard-coded demo data. Good enough for the hackathon.

// Where the trip starts unless the user picks another station.
export const DEFAULT_START = 'Brussels'
export const DEFAULT_DATE = '2026-12-10'

// Major train stations (city level). The drawn path "picks up" the ones it passes near.
export const STATIONS = [
  { name: 'Brussels', lat: 50.8452, lng: 4.3571 },
  { name: 'Paris', lat: 48.8566, lng: 2.3522 },
  { name: 'Lille', lat: 50.6292, lng: 3.0573 },
  { name: 'Amsterdam', lat: 52.3676, lng: 4.9041 },
  { name: 'Rotterdam', lat: 51.9244, lng: 4.4777 },
  { name: 'Cologne', lat: 50.9375, lng: 6.9603 },
  { name: 'Luxembourg', lat: 49.6116, lng: 6.1319 },
  { name: 'Frankfurt', lat: 50.1109, lng: 8.6821 },
  { name: 'Strasbourg', lat: 48.5734, lng: 7.7521 },
  { name: 'Basel', lat: 47.5596, lng: 7.5886 },
  { name: 'Zurich', lat: 47.3769, lng: 8.5417 },
  { name: 'Bern', lat: 46.948, lng: 7.4474 },
  { name: 'Lausanne', lat: 46.5197, lng: 6.6323 },
  { name: 'Geneva', lat: 46.2044, lng: 6.1432 },
  { name: 'Lyon', lat: 45.764, lng: 4.8357 },
  { name: 'Marseille', lat: 43.2965, lng: 5.3698 },
  { name: 'Nice', lat: 43.7102, lng: 7.262 },
  { name: 'Turin', lat: 45.0703, lng: 7.6869 },
  { name: 'Milan', lat: 45.4642, lng: 9.19 },
  { name: 'Venice', lat: 45.4408, lng: 12.3155 },
  { name: 'Florence', lat: 43.7696, lng: 11.2558 },
  { name: 'Rome', lat: 41.9028, lng: 12.4964 },
  { name: 'Munich', lat: 48.1351, lng: 11.582 },
  { name: 'Innsbruck', lat: 47.2692, lng: 11.4041 },
  { name: 'Salzburg', lat: 47.8095, lng: 13.055 },
  { name: 'Vienna', lat: 48.2082, lng: 16.3738 },
  { name: 'Prague', lat: 50.0755, lng: 14.4378 },
  { name: 'Berlin', lat: 52.52, lng: 13.405 },
  { name: 'Hamburg', lat: 53.5511, lng: 9.9937 },
  { name: 'London', lat: 51.5072, lng: -0.1276 },
  { name: 'Barcelona', lat: 41.3851, lng: 2.1734 },
  { name: 'Bordeaux', lat: 44.8378, lng: -0.5792 },
  { name: 'Toulouse', lat: 43.6047, lng: 1.4442 },
]

// Major monuments, shown as emoji pins on the map.
export const MONUMENTS = [
  { name: 'Atomium', emoji: '⚛️', lat: 50.8949, lng: 4.3415 },
  { name: 'Eiffel Tower', emoji: '🗼', lat: 48.8584, lng: 2.2945 },
  { name: 'Big Ben', emoji: '🕰️', lat: 51.5007, lng: -0.1246 },
  { name: 'Cologne Cathedral', emoji: '⛪', lat: 50.9413, lng: 6.9583 },
  { name: 'Brandenburg Gate', emoji: '🏛️', lat: 52.5163, lng: 13.3777 },
  { name: 'Jet d’Eau', emoji: '⛲', lat: 46.2073, lng: 6.1557 },
  { name: 'Mont Blanc', emoji: '🏔️', lat: 45.8326, lng: 6.8652 },
  { name: 'Matterhorn', emoji: '🗻', lat: 45.9763, lng: 7.6586 },
  { name: 'Duomo di Milano', emoji: '⛪', lat: 45.4642, lng: 9.1916 },
  { name: 'Grand Canal', emoji: '🛶', lat: 45.438, lng: 12.3359 },
  { name: 'Leaning Tower', emoji: '🏛️', lat: 43.723, lng: 10.3966 },
  { name: 'Colosseum', emoji: '🏟️', lat: 41.8902, lng: 12.4922 },
  { name: 'Neuschwanstein', emoji: '🏰', lat: 47.5576, lng: 10.7498 },
  { name: 'Schönbrunn', emoji: '👑', lat: 48.1845, lng: 16.3122 },
  { name: 'Charles Bridge', emoji: '🌉', lat: 50.0865, lng: 14.4114 },
  { name: 'Sagrada Família', emoji: '⛪', lat: 41.4036, lng: 2.1744 },
  { name: 'Canals', emoji: '🚲', lat: 52.3731, lng: 4.8926 },
]

export const DEFAULT_DAYS = 2

// Main rail corridors between our stations, drawn as a quiet background network on
// the zoomed-out map (the base map only has real track geometry from zoom 8 in).
// Straight lines between cities: a sketch of the network, not exact track routes.
export const RAIL_LINKS = [
  ['London', 'Lille'], ['Lille', 'Paris'], ['Lille', 'Brussels'], ['Brussels', 'Rotterdam'],
  ['Rotterdam', 'Amsterdam'], ['Brussels', 'Cologne'], ['Amsterdam', 'Cologne'], ['Cologne', 'Frankfurt'],
  ['Cologne', 'Hamburg'], ['Hamburg', 'Berlin'], ['Berlin', 'Prague'], ['Frankfurt', 'Berlin'],
  ['Brussels', 'Luxembourg'], ['Luxembourg', 'Strasbourg'], ['Paris', 'Strasbourg'], ['Strasbourg', 'Basel'],
  ['Frankfurt', 'Basel'], ['Frankfurt', 'Munich'], ['Munich', 'Salzburg'], ['Salzburg', 'Vienna'],
  ['Prague', 'Vienna'], ['Munich', 'Innsbruck'], ['Innsbruck', 'Venice'], ['Munich', 'Zurich'],
  ['Zurich', 'Innsbruck'], ['Basel', 'Zurich'], ['Basel', 'Bern'], ['Zurich', 'Bern'], ['Bern', 'Lausanne'],
  ['Lausanne', 'Geneva'], ['Paris', 'Geneva'], ['Paris', 'Lyon'], ['Lyon', 'Geneva'], ['Lyon', 'Marseille'],
  ['Marseille', 'Nice'], ['Nice', 'Milan'], ['Paris', 'Bordeaux'], ['Bordeaux', 'Toulouse'],
  ['Toulouse', 'Barcelona'], ['Marseille', 'Barcelona'], ['Lyon', 'Turin'], ['Turin', 'Milan'],
  ['Milan', 'Venice'], ['Milan', 'Florence'], ['Florence', 'Rome'], ['Zurich', 'Milan'], ['Lausanne', 'Milan'],
]

// Nearest airport with regular flights for each city, and the usual time from the city
// centre to it by public transport or taxi (minutes). Cities without a useful airport of
// their own use the nearest big one (Lausanne → Geneva, Bern → Zurich, ...).
export const AIRPORTS = {
  Brussels: { code: 'BRU', transferMin: 30 }, Paris: { code: 'CDG', transferMin: 50 },
  Lille: { code: 'LIL', transferMin: 30 }, Amsterdam: { code: 'AMS', transferMin: 25 },
  Rotterdam: { code: 'AMS', transferMin: 50 }, Cologne: { code: 'CGN', transferMin: 25 },
  Luxembourg: { code: 'LUX', transferMin: 25 }, Frankfurt: { code: 'FRA', transferMin: 25 },
  Strasbourg: { code: 'SXB', transferMin: 30 }, Basel: { code: 'BSL', transferMin: 25 },
  Zurich: { code: 'ZRH', transferMin: 20 }, Bern: { code: 'ZRH', transferMin: 75 },
  Lausanne: { code: 'GVA', transferMin: 50 }, Geneva: { code: 'GVA', transferMin: 20 },
  Lyon: { code: 'LYS', transferMin: 35 }, Marseille: { code: 'MRS', transferMin: 40 },
  Nice: { code: 'NCE', transferMin: 25 }, Turin: { code: 'TRN', transferMin: 45 },
  Milan: { code: 'MXP', transferMin: 55 }, Venice: { code: 'VCE', transferMin: 40 },
  Florence: { code: 'FLR', transferMin: 25 }, Rome: { code: 'FCO', transferMin: 45 },
  Munich: { code: 'MUC', transferMin: 45 }, Innsbruck: { code: 'INN', transferMin: 20 },
  Salzburg: { code: 'SZG', transferMin: 25 }, Vienna: { code: 'VIE', transferMin: 30 },
  Prague: { code: 'PRG', transferMin: 40 }, Berlin: { code: 'BER', transferMin: 45 },
  Hamburg: { code: 'HAM', transferMin: 30 }, London: { code: 'LHR', transferMin: 55 },
  Barcelona: { code: 'BCN', transferMin: 35 }, Bordeaux: { code: 'BOD', transferMin: 35 },
  Toulouse: { code: 'TLS', transferMin: 30 },
}

// Rough price of one night in a mid-range double room, per city (euros). Used to show what
// a night train saves you: the night on board replaces a hotel night.
export const HOTEL_EUR = {
  Brussels: 130, Paris: 190, Lille: 110, Amsterdam: 200, Rotterdam: 130, Cologne: 120,
  Luxembourg: 150, Frankfurt: 140, Strasbourg: 120, Basel: 170, Zurich: 220, Bern: 170,
  Lausanne: 180, Geneva: 220, Lyon: 120, Marseille: 120, Nice: 150, Turin: 110, Milan: 170,
  Venice: 200, Florence: 160, Rome: 170, Munich: 150, Innsbruck: 130, Salzburg: 140,
  Vienna: 140, Prague: 110, Berlin: 130, Hamburg: 140, London: 210, Barcelona: 160,
  Bordeaux: 120, Toulouse: 110,
}
