// Every rail company we know of that sells long-distance or cross-border train tickets in
// Europe. This is a hand-made catalogue (hackathon): there is no public, universal list or
// API of operators. Facts like pass acceptance and booking horizons are best-effort
// estimates from the operators' public information and must be checked before launch.
//
// `routed: true` means our demo trip planner already sends traffic to this company
// (see `directOperator` in tickets.js). The others are listed so the catalogue is
// complete, and are the integration backlog.
//
// interrail: how an Interrail / Eurail pass works on this company's trains
//   'yes'          the pass is your ticket, no reservation needed on most trains
//   'reservation'  the pass is valid but some or all trains need a paid seat reservation
//   'no'           the pass is not accepted, buy a normal ticket

export const COUNTRY_NAMES = {
  AT: 'Austria', BE: 'Belgium', BG: 'Bulgaria', CH: 'Switzerland', CZ: 'Czechia', DE: 'Germany',
  DK: 'Denmark', ES: 'Spain', FI: 'Finland', FR: 'France', GB: 'United Kingdom', GR: 'Greece',
  HR: 'Croatia', HU: 'Hungary', IE: 'Ireland', IT: 'Italy', LT: 'Lithuania', LU: 'Luxembourg',
  NL: 'Netherlands', NO: 'Norway', PL: 'Poland', PT: 'Portugal', RO: 'Romania', RS: 'Serbia',
  SE: 'Sweden', SI: 'Slovenia', SK: 'Slovakia', EU: 'Several countries',
}

export const KINDS = {
  national: 'National rail company',
  open: 'Independent operator',
  highspeed: 'Cross-border high-speed',
  night: 'Night trains',
}

const p = (id, o) => ({ id, salesOpenDays: 90, delivery: 'E-ticket (PDF)', routed: false, ...o })

const LIST = [
  // ---- Cross-border brands ----
  p('eurostar', { name: 'Eurostar', short: 'ES', color: '#1b2a6b', country: 'EU', kind: 'highspeed', routed: true,
    network: 'London, Paris, Brussels, Amsterdam, Cologne (including the former Thalys)', delivery: 'E-ticket with QR code, also in the Eurostar app', salesOpenDays: 330, interrail: 'reservation', site: 'eurostar.com' }),
  p('lyria', { name: 'TGV Lyria', short: 'Lyria', color: '#a3123a', country: 'EU', kind: 'highspeed',
    network: 'Paris and the south of France to Geneva, Lausanne, Basel, Zurich', delivery: 'E-ticket (PDF) and SNCF Connect app', salesOpenDays: 120, interrail: 'reservation', site: 'tgv-lyria.com' }),
  p('european-sleeper', { name: 'European Sleeper', short: 'ESL', color: '#1f3b57', country: 'EU', kind: 'night',
    network: 'Brussels, Amsterdam, Berlin, Dresden, Prague', delivery: 'E-ticket (PDF)', salesOpenDays: 180, interrail: 'reservation', site: 'europeansleeper.eu' }),
  p('nightjet', { name: 'ÖBB Nightjet', short: 'NJ', color: '#14244b', country: 'EU', kind: 'night',
    network: 'Vienna, Munich, Zurich, Hamburg, Berlin, Amsterdam, Brussels, Paris, Rome, Milan, Venice', delivery: 'E-ticket (PDF) and ÖBB app', salesOpenDays: 180, interrail: 'reservation', site: 'nightjet.com' }),
  p('caledonian', { name: 'Caledonian Sleeper', short: 'CS', color: '#1d3c34', country: 'GB', kind: 'night',
    network: 'London to Edinburgh, Glasgow, Inverness, Aberdeen, Fort William', delivery: 'E-ticket with QR code', salesOpenDays: 365, interrail: 'reservation', site: 'sleeper.scot' }),

  // ---- National rail companies ----
  p('sncf', { name: 'SNCF Voyageurs', short: 'SNCF', color: '#8c1d40', country: 'FR', kind: 'national', routed: true,
    network: 'TGV INOUI, OUIGO, Intercités, TER across France and to Germany, Italy, Spain', delivery: 'E-ticket (PDF) and SNCF Connect app', salesOpenDays: 120, interrail: 'reservation', site: 'sncf-connect.com' }),
  p('sncb', { name: 'SNCB / NMBS', short: 'SNCB', color: '#0069b4', country: 'BE', kind: 'national', routed: true,
    network: 'All of Belgium, plus Luxembourg and Lille', delivery: 'E-ticket (PDF) and SNCB app', salesOpenDays: 90, interrail: 'yes', site: 'belgiantrain.be' }),
  p('ns', { name: 'NS International', short: 'NS', color: '#f4b000', country: 'NL', kind: 'national', routed: true,
    network: 'The Netherlands, plus Brussels and Germany', delivery: 'E-ticket (PDF) and NS app', salesOpenDays: 120, interrail: 'yes', site: 'nsinternational.com' }),
  p('db', { name: 'Deutsche Bahn', short: 'DB', color: '#ec0016', country: 'DE', kind: 'national', routed: true,
    network: 'ICE, IC and regional trains across Germany and to its neighbours', delivery: 'E-ticket (PDF) and DB Navigator app', salesOpenDays: 180, interrail: 'yes', site: 'bahn.de' }),
  p('cfl', { name: 'CFL', short: 'CFL', color: '#c8102e', country: 'LU', kind: 'national', routed: true,
    network: 'Luxembourg (domestic trains are free)', salesOpenDays: 90, interrail: 'yes', site: 'cfl.lu' }),
  p('sbb', { name: 'SBB CFF FFS', short: 'SBB', color: '#d5001c', country: 'CH', kind: 'national', routed: true,
    network: 'All of Switzerland, plus EuroCity to Milan', delivery: 'E-ticket (PDF) and SBB Mobile app', salesOpenDays: 60, interrail: 'yes', site: 'sbb.ch' }),
  p('bls', { name: 'BLS', short: 'BLS', color: '#5a8f29', country: 'CH', kind: 'national',
    network: 'Bern, Lötschberg, Interlaken, Lucerne', delivery: 'E-ticket (PDF) and SBB Mobile app', salesOpenDays: 60, interrail: 'yes', site: 'bls.ch' }),
  p('trenitalia', { name: 'Trenitalia', short: 'FS', color: '#006a4d', country: 'IT', kind: 'national', routed: true,
    network: 'Frecciarossa, Intercity and regional trains across Italy, plus Paris–Milan', delivery: 'E-ticket (PDF) with PNR code', salesOpenDays: 120, interrail: 'reservation', site: 'trenitalia.com' }),
  p('obb', { name: 'ÖBB', short: 'ÖBB', color: '#e2002a', country: 'AT', kind: 'national', routed: true,
    network: 'Railjet across Austria and to Germany, Italy, Switzerland, Czechia, Hungary', delivery: 'E-ticket (PDF) and ÖBB app', salesOpenDays: 180, interrail: 'yes', site: 'oebb.at' }),
  p('cd', { name: 'České dráhy', short: 'ČD', color: '#00579c', country: 'CZ', kind: 'national', routed: true,
    network: 'Czechia, plus Railjet and EuroCity to Berlin, Vienna, Budapest', salesOpenDays: 90, interrail: 'yes', site: 'cd.cz' }),
  p('renfe', { name: 'Renfe', short: 'Renfe', color: '#6e2a8d', country: 'ES', kind: 'national', routed: true,
    network: 'AVE, Avlo and Alvia across Spain, plus Barcelona–Lyon/Marseille', delivery: 'E-ticket (PDF) and Renfe app', salesOpenDays: 90, interrail: 'reservation', site: 'renfe.com' }),
  p('cp', { name: 'CP Comboios de Portugal', short: 'CP', color: '#2f9e44', country: 'PT', kind: 'national',
    network: 'Alfa Pendular and Intercidades across Portugal', salesOpenDays: 60, interrail: 'reservation', site: 'cp.pt' }),
  p('nationalrail', { name: 'National Rail (GB)', short: 'NR', color: '#c8102e', country: 'GB', kind: 'national',
    network: 'All train companies in Great Britain (LNER, Avanti, GWR, …), one shared ticketing system', delivery: 'E-ticket with barcode', salesOpenDays: 84, interrail: 'yes', site: 'nationalrail.co.uk' }),
  p('irishrail', { name: 'Iarnród Éireann (Irish Rail)', short: 'IÉ', color: '#00843d', country: 'IE', kind: 'national',
    network: 'Ireland, plus the Dublin–Belfast Enterprise', salesOpenDays: 90, interrail: 'yes', site: 'irishrail.ie' }),
  p('pkp', { name: 'PKP Intercity', short: 'PKP', color: '#1a4b9b', country: 'PL', kind: 'national',
    network: 'Express InterCity Premium and IC across Poland, plus Berlin, Prague, Vienna', salesOpenDays: 30, interrail: 'reservation', site: 'intercity.pl' }),
  p('mav', { name: 'MÁV-START', short: 'MÁV', color: '#1c3f94', country: 'HU', kind: 'national',
    network: 'Hungary, plus Railjet to Vienna and EuroCity to Prague', salesOpenDays: 60, interrail: 'yes', site: 'mavcsoport.hu' }),
  p('zssk', { name: 'ZSSK', short: 'ZSSK', color: '#e2001a', country: 'SK', kind: 'national',
    network: 'Slovakia', salesOpenDays: 30, interrail: 'yes', site: 'zssk.sk' }),
  p('sz', { name: 'Slovenske železnice', short: 'SŽ', color: '#004b93', country: 'SI', kind: 'national',
    network: 'Slovenia, plus Vienna, Zagreb, Trieste', salesOpenDays: 60, interrail: 'yes', site: 'potniski.sz.si' }),
  p('hzpp', { name: 'HŽ Putnički prijevoz', short: 'HŽ', color: '#003b7e', country: 'HR', kind: 'national',
    network: 'Croatia', salesOpenDays: 60, interrail: 'yes', site: 'hzpp.hr' }),
  p('cfr', { name: 'CFR Călători', short: 'CFR', color: '#00428a', country: 'RO', kind: 'national',
    network: 'Romania, plus Budapest and Vienna', salesOpenDays: 30, interrail: 'yes', site: 'cfrcalatori.ro' }),
  p('bdz', { name: 'BDŽ', short: 'BDŽ', color: '#008c45', country: 'BG', kind: 'national',
    network: 'Bulgaria', salesOpenDays: 30, interrail: 'yes', site: 'bdz.bg' }),
  p('srbijavoz', { name: 'Srbijavoz', short: 'SV', color: '#0c4da2', country: 'RS', kind: 'national',
    network: 'Serbia, including the Belgrade–Novi Sad high-speed line', salesOpenDays: 30, interrail: 'yes', site: 'srbvoz.rs' }),
  p('hellenic', { name: 'Hellenic Train', short: 'HT', color: '#003da5', country: 'GR', kind: 'national',
    network: 'Greece, including Athens–Thessaloniki', salesOpenDays: 60, interrail: 'reservation', site: 'hellenictrain.gr' }),
  p('dsb', { name: 'DSB', short: 'DSB', color: '#b41730', country: 'DK', kind: 'national',
    network: 'Denmark, plus Hamburg and Malmö', delivery: 'E-ticket and DSB app', salesOpenDays: 60, interrail: 'yes', site: 'dsb.dk' }),
  p('sj', { name: 'SJ', short: 'SJ', color: '#1d1d1b', country: 'SE', kind: 'national',
    network: 'Sweden, plus Oslo, Copenhagen and night trains to Narvik', delivery: 'E-ticket and SJ app', salesOpenDays: 90, interrail: 'reservation', site: 'sj.se' }),
  p('vy', { name: 'Vy', short: 'Vy', color: '#00865c', country: 'NO', kind: 'national',
    network: 'Norway, including the Bergen and Dovre lines', delivery: 'E-ticket and Vy app', salesOpenDays: 90, interrail: 'reservation', site: 'vy.no' }),
  p('vr', { name: 'VR', short: 'VR', color: '#00a039', country: 'FI', kind: 'national',
    network: 'Finland, including night trains to Lapland', delivery: 'E-ticket and VR app', salesOpenDays: 90, interrail: 'reservation', site: 'vr.fi' }),
  p('ltg', { name: 'LTG Link', short: 'LTG', color: '#d71920', country: 'LT', kind: 'national',
    network: 'Lithuania, plus Vilnius–Riga and Vilnius–Warsaw', salesOpenDays: 60, interrail: 'yes', site: 'ltglink.lt' }),

  // ---- Independent operators ----
  p('ouigo', { name: 'OUIGO (SNCF low-cost)', short: 'OUIGO', color: '#e6007e', country: 'FR', kind: 'open',
    network: 'Low-cost high-speed trains across France', delivery: 'E-ticket and OUIGO app', salesOpenDays: 120, interrail: 'no', site: 'ouigo.com' }),
  p('italo', { name: 'Italo', short: 'Italo', color: '#9b1b30', country: 'IT', kind: 'open',
    network: 'High-speed trains across Italy', delivery: 'E-ticket (PDF) and Italo app', salesOpenDays: 300, interrail: 'no', site: 'italotreno.com' }),
  p('iryo', { name: 'iryo', short: 'iryo', color: '#c8102e', country: 'ES', kind: 'open',
    network: 'High-speed trains: Madrid, Barcelona, Valencia, Seville, Málaga', delivery: 'E-ticket and iryo app', salesOpenDays: 180, interrail: 'no', site: 'iryo.eu' }),
  p('ouigo-es', { name: 'OUIGO España', short: 'OUIGO', color: '#e6007e', country: 'ES', kind: 'open',
    network: 'Low-cost high-speed trains: Madrid, Barcelona, Valencia, Alicante, Andalusia', delivery: 'E-ticket and OUIGO app', salesOpenDays: 180, interrail: 'no', site: 'ouigo.com/es' }),
  p('flixtrain', { name: 'FlixTrain', short: 'FLIX', color: '#73d700', country: 'DE', kind: 'open',
    network: 'Low-cost long-distance trains across Germany', delivery: 'E-ticket and Flix app', salesOpenDays: 180, interrail: 'no', site: 'flixtrain.com' }),
  p('westbahn', { name: 'WESTbahn', short: 'WB', color: '#43a047', country: 'AT', kind: 'open',
    network: 'Vienna – Salzburg – Munich', delivery: 'E-ticket and WESTbahn app', salesOpenDays: 90, interrail: 'yes', site: 'westbahn.at' }),
  p('regiojet', { name: 'RegioJet', short: 'RJ', color: '#f9b000', country: 'CZ', kind: 'open',
    network: 'Prague, Vienna, Budapest, Bratislava, Kraków, plus night trains to Croatia', delivery: 'E-ticket and RegioJet app', salesOpenDays: 90, interrail: 'no', site: 'regiojet.com' }),
  p('leoexpress', { name: 'Leo Express', short: 'LE', color: '#1d1d1b', country: 'CZ', kind: 'open',
    network: 'Prague, Ostrava, Kraków, Košice', delivery: 'E-ticket and Leo Express app', salesOpenDays: 90, interrail: 'no', site: 'leoexpress.com' }),
  p('snalltaget', { name: 'Snälltåget', short: 'SNÄ', color: '#00a0a0', country: 'SE', kind: 'open',
    network: 'Stockholm – Malmö, plus night trains to Berlin and the Swedish mountains', delivery: 'E-ticket', salesOpenDays: 180, interrail: 'no', site: 'snalltaget.se' }),
  p('lumo', { name: 'Lumo', short: 'Lumo', color: '#2b62f6', country: 'GB', kind: 'open',
    network: 'London – Edinburgh', delivery: 'E-ticket with barcode', salesOpenDays: 180, interrail: 'no', site: 'lumo.co.uk' }),
]

export const PROVIDERS = Object.fromEntries(LIST.map((o) => [o.id, o]))
export const PROVIDER_LIST = LIST
