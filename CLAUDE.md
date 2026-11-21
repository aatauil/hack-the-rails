# Eurailo

## The problem we solve

People skip the train in Europe because planning a multi-city rail trip is a pain. Every
country has its own rail company, its own website, its own tickets. Taking a trip like
Brussels → Paris → Geneva → Milan means working out which operator runs each leg, booking
each one on a different site, and checking yourself that the connections line up. A flight
is one search and one checkout, so people fly.

## The pitch

**Book your whole city-hopping trip in one go.**

Eurailo is for city hoppers: people visiting several European cities in one trip. You plan
the route on a map, pick your trains, and pay **once**. Behind the scenes the trip is still
made of separate tickets from different rail companies (Eurostar, SNCF, DB, SBB, Trenitalia,
…), but Eurailo works out which tickets you need and buys them for you. You never have to
choose operators or tickets yourself.

> Many providers and many tickets, but one plan and one checkout.

Every product decision should make this promise stronger. If a feature makes the traveller
think about operators, ticket types or separate payments, it is working against the pitch.

## Core flow

The app moves through four pages (`page` state in `src/App.jsx`):

1. **Plan** (`plan`): set where you start and when (`TripBar`), then build the route on the map
   (`MapView.jsx`). You can either **draw** a line across the map, which picks up stations it
   passes near, or **click** stations one by one. `TrackPanel.jsx` lists the stops and how
   many days you stay in each.
2. **Overview** (`overview`, `Overview.jsx`): compare trip options (most sustainable /
   cheapest / fastest, from `OPTIONS` in `src/trip.js`) with time, price and CO₂ against
   flying, and pick a departure time for each leg.
3. **Checkout** (`checkout`, `Checkout.jsx`): **one payment** for the whole trip via Stripe.
   The breakdown shows every underlying ticket and which operator it is from, so the
   customer can see exactly where the money goes.
4. **Confirmation** (`confirmation`, `Confirmation.jsx`, `Tickets.jsx`): the booking and the
   status of each operator ticket. Reached after payment via `?booking=<id>` in the URL.

## How the "one checkout, many tickets" idea is built

- `src/tickets.js` is the heart of the pitch. `buildQuote()` turns a planned trip into the
  actual tickets to buy, one per rail company per segment (splitting legs at a change
  station when no single operator runs it, with `CHANGE_MINUTES` of buffer between
  separately ticketed trains). `OPERATORS` describes each rail company and how its ticket
  is delivered.
- **The same code runs in the browser and on the server.** The browser uses it to show the
  breakdown; the server uses it to work out what to charge. Never let the client send a
  price: the server always reprices from the trip it receives, so what Stripe charges
  matches what the customer saw.
- `server/index.js` (Express): `POST /api/checkout` validates the trip, prices it, creates or
  updates the booking and its Stripe PaymentIntent. `GET /api/bookings/:id` returns the
  booking. `POST /api/stripe/webhook` updates the booking when payment status changes, and
  on success the operator tickets are requested (`requestTickets`).
- `server/store.js` keeps bookings in `server/data/bookings.json`. Fine for development;
  needs a real database before launch.

## Current state (demo / hackathon)

- Stations, trip maths, timetables and fares are **hard-coded or estimated** (`src/data.js`,
  `src/trip.js`). There is no real timetable or rail-pricing API yet.
- Buying the operator tickets is not wired to real operators; only the Stripe payment is real
  (in test mode).
- `BOOKING_FEE_CENTS` in `src/tickets.js` is Eurailo's own fee, shown as a separate line.

## Running it

- `npm run dev` starts the API (port 8787) and Vite (port 5173) together; Vite proxies `/api`
  to the API. In the Claude desktop app use the `eurailo` preview config in
  `.claude/launch.json`.
- Copy `.env.example` to `.env` and add Stripe **test** keys (`sk_test_` / `pk_test_`). Without
  them the app still runs, but checkout reports that payments are not set up.
- Webhooks locally: `stripe listen --forward-to localhost:5173/api/stripe/webhook`, then put the
  printed secret in `STRIPE_WEBHOOK_SECRET`.

## Stack

React 18 + Vite, MapLibre GL for the map, Express 5 API, Stripe (Payment Element) for
payment. Plain JS (ES modules), no TypeScript, no test suite yet.

## Guidelines for working on this

- Keep the traveller-facing language simple: trips, stops, trains. Operators appear only
  as information (who issues which ticket), never as something the traveller has to choose.
- Any change to pricing or ticket splitting goes in `src/tickets.js` / `src/trip.js` so the
  browser and server stay in sync.
- Use only Stripe test keys while developing.
