import { useEffect, useMemo, useState } from 'react'
import MapView from './MapView.jsx'
import Explore from './Explore.jsx'
import Overview from './Overview.jsx'
import Checkout from './Checkout.jsx'
import Confirmation from './Confirmation.jsx'
import { STATIONS, DEFAULT_START } from './data.js'
import { LENGTH, windowMonths, bestMonth, destinations, spreadDays } from './explore.js'

const bookingFromUrl = () => new URLSearchParams(window.location.search).get('booking')

export default function App() {
  const [startName, setStartName] = useState(DEFAULT_START)
  // Explore: roughly when you leave and how long you are away.
  const [when, setWhen] = useState('month')
  const [lengthId, setLengthId] = useState('week')
  // A date picked by hand on the overview wins over the one we suggest.
  const [dateOverride, setDateOverride] = useState(null)
  const [selected, setSelected] = useState(null)
  const [hovered, setHovered] = useState(null)
  // Stations found near the drawn line. `enabled` = the route goes through it.
  const [candidates, setCandidates] = useState([])
  // How the route is being built: 'draw' (dragged a line) or 'click' (added stations one by one).
  const [mode, setMode] = useState(null)
  const [resetKey, setResetKey] = useState(0)
  const [page, setPage] = useState(bookingFromUrl() ? 'confirmation' : 'plan') // plan | overview | checkout | confirmation
  const [chosen, setChosen] = useState('sustainable')
  // Trains the traveller picked per leg on the overview: { 'Paris>Geneva': '09:30' }
  const [departures, setDepartures] = useState({})
  const pickTrain = (key, time) => setDepartures((d) => ({ ...d, [key]: time }))
  const [bookingId, setBookingId] = useState(bookingFromUrl)
  // Rail passes and discount cards the traveller already holds (ids from passes.js).
  const [passes, setPasses] = useState([])

  const start = STATIONS.find((s) => s.name === startName)

  const length = LENGTH.find((l) => l.id === lengthId)
  const active = candidates.filter((s) => s.enabled)
  const activeKey = active.map((s) => s.name).join('>')

  const months = useMemo(() => windowMonths(when), [when])
  const startDate = dateOverride ?? bestMonth(months, active.map((s) => s.name)).date

  // Where you'd go next: from the last stop of the trip so far, or from home.
  const dests = useMemo(
    () => destinations({ from: active[active.length - 1] ?? start, exclude: new Set(active.map((s) => s.name)), length, months }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activeKey, startName, lengthId, months],
  )
  const explore = useMemo(() => Object.fromEntries(dests.map((d) => [d.name, d])), [dests])

  // The trip length is shared out across the stops; the overview can fine-tune it.
  useEffect(() => {
    const days = spreadDays(active.length, length.nights)
    let i = 0
    setCandidates((prev) => prev.map((s) => (s.enabled ? { ...s, days: days[i++] } : s)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeKey, lengthId])

  const handleRelease = (found) => {
    setCandidates(found.map((s) => ({ ...s, days: 1 })))
    setMode(found.length ? 'draw' : null)
    setSelected(null)
  }

  // "Add to trip" from the sidebar: the city becomes the next stop.
  const addStop = (name) => {
    const s = STATIONS.find((x) => x.name === name)
    setCandidates((prev) => [...prev.filter((c) => c.enabled), { ...s, enabled: true, days: 1 }])
    setMode('click')
    setSelected(null)
    setHovered(null)
  }

  const toggle = (name) => {
    if (mode === 'click') {
      // Tapped routes only hold the stops you picked, so "off" just means gone.
      const next = candidates.filter((s) => s.name !== name)
      setCandidates(next)
      if (next.length === 0) reset()
      return
    }
    setCandidates((prev) => prev.map((s) => (s.name === name ? { ...s, enabled: !s.enabled } : s)))
  }

  const changeWhen = (id) => {
    setWhen(id)
    setDateOverride(null)
  }

  const changeDays = (name, delta) => {
    setCandidates((prev) =>
      prev.map((s) => (s.name === name ? { ...s, days: Math.max(1, s.days + delta) } : s)),
    )
  }

  const reset = () => {
    setCandidates([])
    setMode(null)
    setDepartures({})
    setSelected(null)
    setResetKey((k) => k + 1)
  }

  // A new departure station means a new route.
  const changeStart = (name) => {
    if (name === startName) return
    reset()
    setStartName(name)
  }

  // The booking id lives in the URL so the confirmation page survives a reload or a bank redirect.
  const showBooking = (id) => {
    window.history.pushState(null, '', `/?booking=${encodeURIComponent(id)}`)
    setBookingId(id)
    setPage('confirmation')
  }

  const startOver = () => {
    window.history.pushState(null, '', '/')
    setBookingId(null)
    reset()
    setPage('plan')
  }


  return (
    <>
      {page === 'confirmation' && bookingId && (
        <Confirmation bookingId={bookingId} onDone={startOver} />
      )}
      {page === 'checkout' && active.length > 0 && (
        <Checkout
          start={start}
          startDate={startDate}
          stops={active}
          departures={departures}
          optionId={chosen}
          passes={passes}
          onBack={() => setPage('overview')}
          onPaid={showBooking}
        />
      )}
      {page === 'overview' && active.length > 0 && (
        <Overview
          start={start}
          startDate={startDate}
          onDateChange={setDateOverride}
          stops={active}
          onChange={changeDays}
          onBack={() => setPage('plan')}
          chosen={chosen}
          onChoose={setChosen}
          departures={departures}
          onPickTrain={pickTrain}
          passes={passes}
          onPasses={setPasses}
          onBook={() => setPage('checkout')}
        />
      )}
      {/* The map page stays mounted (just hidden) so your drawn route survives going back. */}
      <div className="app explore-page" style={page === 'plan' ? undefined : { display: 'none' }}>
        <Explore
          startName={startName}
          onStart={changeStart}
          when={when}
          onWhen={changeWhen}
          length={lengthId}
          onLength={setLengthId}
          trip={active}
          startDate={startDate}
          nights={length.nights}
          onRemove={toggle}
          onNext={() => setPage('overview')}
          dests={dests}
          selected={selected}
          onSelect={setSelected}
          onHover={setHovered}
          onAdd={addStop}
        />
        <div className="map-wrap">
          <MapView
            start={start}
            candidates={candidates}
            onRelease={handleRelease}
            onToggle={toggle}
            onSelect={setSelected}
            mode={mode}
            resetKey={resetKey}
            panelOpen={mode === 'draw'}
            explore={explore}
            selected={selected}
            hovered={hovered}
          />
        </div>
      </div>
    </>
  )
}
