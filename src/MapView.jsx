import { useEffect, useRef, useState } from 'react'
import * as maplibregl from 'maplibre-gl'
import { STATIONS, MONUMENTS, RAIL_LINKS } from './data.js'
import { resample, smooth, closest, bend } from './geometry.js'
import { project, unproject, kmPerPx } from './mercator.js'

// Each limit is the smaller of a screen distance and a real-world distance, so
// zooming far out doesn't make faraway cities count as "near" the line.
const CANDIDATE_PX = 45 // stations this close to the line are offered as stops
const CANDIDATE_KM = 40
const AUTO_ON_PX = 30 // ...and the ones this close start switched on
const AUTO_ON_KM = 35
const STEP_PX = 6 // spacing of the smoothed line's points
const ANIM_MS = 350

const STYLE = 'https://tiles.openfreemap.org/styles/bright'
const HOME = { center: [6.8, 47.6], zoom: 5, pitch: 0, bearing: 0 }
const TEAL = '#3A21A3' // brand accent (deep violet)

const lineGeo = (coords) => ({
  type: 'Feature',
  geometry: { type: 'LineString', coordinates: coords },
  properties: {},
})

function pinEl(className, html) {
  const el = document.createElement('div')
  el.className = className
  el.innerHTML = html
  return el
}

export default function MapView({ start, candidates, mode, onRelease, onToggle, onSelect, resetKey, panelOpen, explore = {}, selected, hovered }) {
  const elRef = useRef(null)
  const mapRef = useRef(null)
  const stationEls = useRef({})
  const base = useRef(null) // { zoom, pts } smoothed drawn line in projected pixels
  const amounts = useRef({}) // station name -> current bend amount (0..1), animated
  const anim = useRef(null)
  const drawingRef = useRef(false)
  const savedCamera = useRef(null)
  const [touring, setTouring] = useState(null) // monument name while zoomed in on it

  const toggleRef = useRef(onToggle)
  toggleRef.current = onToggle
  const candRef = useRef(candidates)
  candRef.current = candidates
  const releaseRef = useRef(onRelease)
  releaseRef.current = onRelease
  const panelOpenRef = useRef(panelOpen)
  panelOpenRef.current = panelOpen
  const startRef = useRef(start)
  startRef.current = start
  const selectRef = useRef(onSelect)
  selectRef.current = onSelect
  const modeRef = useRef(mode)
  modeRef.current = mode
  const trainRef = useRef(null)

  const setLine = (id, pts, zoom) => {
    const src = mapRef.current?.getSource(id)
    if (src) src.setData(lineGeo(pts.length > 1 ? pts.map((p) => unproject(p, zoom)) : []))
  }

  const render = () => {
    const b = base.current
    if (!b) return
    const targets = candRef.current.map((c) => {
      const p = project([c.lng, c.lat], b.zoom)
      return { x: p.x, y: p.y, idx: c.idx, amount: amounts.current[c.name] || 0 }
    })
    setLine('route', bend(b.pts, targets), b.zoom)
  }

  useEffect(() => {
    const map = new maplibregl.Map({
      container: elRef.current,
      style: STYLE,
      ...HOME,
      trackResize: false, // we resize by hand so the view never shifts mid-drag
      maxPitch: 70,
    })
    mapRef.current = map
    if (import.meta.env.DEV) window.__map = map // handy for debugging in the console
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'top-right')
    map.touchZoomRotate.disableRotation()

    map.on('load', () => {
      // Keep the overview simple: our own station pins replace the city labels,
      // and region names / road shields only appear once you zoom in.
      const showFrom = {
        label_state: 9, label_town: 9, label_city: 9, label_city_capital: 9, label_other: 11, label_village: 11,
        'highway-shield-non-us': 11, poi_transit: 13, airport: 12,
      }
      for (const [id, z] of Object.entries(showFrom)) if (map.getLayer(id)) map.setLayerZoomRange(id, z, 24)

      // Roads, highways and their names/shields only show up when zoomed into a city.
      for (const layer of map.getStyle().layers) {
        const sl = layer['source-layer']
        if ((sl === 'transportation' || sl === 'transportation_name') && !layer.id.includes('rail')) {
          map.setLayerZoomRange(layer.id, 12, 24)
        }
      }

      // Rail lines from the base map itself, drawn as a quiet grey network at every zoom.
      for (const id of ['railway', 'bridge-railway', 'tunnel-railway']) {
        if (!map.getLayer(id)) continue
        map.setLayerZoomRange(id, 0, 24)
        map.setPaintProperty(id, 'line-color', '#8E82B0')
        map.setPaintProperty(id, 'line-width', ['interpolate', ['linear'], ['zoom'], 4, 0.6, 8, 1.2, 14, 2])
      }

      // Sketch of the main rail corridors for the zoomed-out view.
      const where = Object.fromEntries(STATIONS.map((c) => [c.name, [c.lng, c.lat]]))
      map.addSource('rail-links', {
        type: 'geojson',
        data: {
          type: 'FeatureCollection',
          features: RAIL_LINKS.map(([a, b]) => lineGeo([where[a], where[b]])),
        },
      })
      map.addLayer({
        id: 'rail-links',
        type: 'line',
        source: 'rail-links',
        layout: { 'line-cap': 'round' },
        paint: {
          'line-color': '#6E5FA0',
          'line-width': ['interpolate', ['linear'], ['zoom'], 4, 1.2, 8, 2],
          'line-opacity': ['interpolate', ['linear'], ['zoom'], 7, 0.45, 9, 0],
          'line-dasharray': [3, 2],
        },
      })

      // 3D buildings when zoomed into a city (this is what makes the Eiffel Tower stand up).
      map.addLayer({
        id: 'building-3d',
        type: 'fill-extrusion',
        source: 'openmaptiles',
        'source-layer': 'building',
        minzoom: 14,
        filter: ['!', ['has', 'hide_3d']],
        paint: {
          'fill-extrusion-color': [
            'interpolate', ['linear'], ['get', 'render_height'],
            0, '#e8e1d6', 40, '#d9cbb5', 120, '#c9a96e',
          ],
          'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 14, 0, 15, ['get', 'render_height']],
          'fill-extrusion-base': ['get', 'render_min_height'],
          'fill-extrusion-opacity': 0.9,
        },
      })

      // The original drawing (faint), and the actual route on top.
      map.addSource('ghost', { type: 'geojson', data: lineGeo([]) })
      map.addSource('route', { type: 'geojson', data: lineGeo([]) })
      map.addLayer({
        id: 'ghost',
        type: 'line',
        source: 'ghost',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': TEAL, 'line-width': 4, 'line-opacity': 0.3, 'line-dasharray': [0.5, 2.5] },
      })
      map.addLayer({
        id: 'route',
        type: 'line',
        source: 'route',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': TEAL, 'line-width': 9, 'line-opacity': 0.95 },
      })
    })

    STATIONS.forEach((s) => {
      const el = pinEl('station-pin', `<div class="dot"></div><div class="label">${s.name}<b class="price"></b></div>`)
      el.addEventListener('click', (e) => {
        e.stopPropagation()
        const cand = candRef.current.find((c) => c.name === s.name)
        // A drawn line: tap its nearby stations on and off.
        if (cand && modeRef.current === 'draw') toggleRef.current(s.name)
        // Otherwise tapping a city opens it in the sidebar.
        else if (!cand && s.name !== startRef.current.name) selectRef.current(s.name)
      })
      new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat([s.lng, s.lat]).addTo(map)
      stationEls.current[s.name] = el
    })

    // Monuments: click one to fly in and see it in 3D.
    MONUMENTS.forEach((mo) => {
      const el = pinEl('monument-pin', `<div class="bubble">${mo.emoji}</div><div class="mlabel">${mo.name}</div>`)
      el.title = `Fly to ${mo.name}`
      el.addEventListener('click', (e) => {
        e.stopPropagation()
        if (!savedCamera.current) {
          savedCamera.current = {
            center: map.getCenter(), zoom: map.getZoom(), pitch: map.getPitch(), bearing: map.getBearing(),
          }
        }
        setTouring(mo.name)
        map.flyTo({ center: [mo.lng, mo.lat], zoom: 15.3, pitch: 60, bearing: -25, duration: 3000, essential: true })
      })
      new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat([mo.lng, mo.lat]).addTo(map)
    })

    // Train at the start city: press on it and drag to draw the route.
    const trainEl = pinEl('train-pin', '<span>🚂</span>')
    trainRef.current = new maplibregl.Marker({ element: trainEl, anchor: 'bottom', offset: [0, 6] })
      .setLngLat([startRef.current.lng, startRef.current.lat])
      .addTo(map)

    let raw = []
    let zoom = HOME.zoom

    const drawn = () => smooth(resample(raw, STEP_PX), 2, 2)
    const eventLngLat = (e) => {
      const r = elRef.current.getBoundingClientRect()
      const ll = map.unproject([e.clientX - r.left, e.clientY - r.top])
      return [ll.lng, ll.lat]
    }

    const onMove = (e) => {
      if (!drawingRef.current) return
      const p = project(eventLngLat(e), zoom)
      const last = raw[raw.length - 1]
      if (Math.hypot(p.x - last.x, p.y - last.y) < 3) return
      raw.push(p)
      setLine('route', drawn(), zoom)
    }

    const onUp = () => {
      if (!drawingRef.current) return
      drawingRef.current = false
      map.dragPan.enable()
      document.body.classList.remove('is-drawing')
      map.resize() // the panel may have closed while drawing
      if (raw.length < 3) return
      const pts = drawn()
      base.current = { zoom, pts }
      setLine('ghost', pts, zoom)

      // Now that the line exists, look for stations close to it.
      const found = []
      for (const s of STATIONS) {
        if (s.name === startRef.current.name) continue
        const { idx, d } = closest(pts, project([s.lng, s.lat], zoom))
        const km = d * kmPerPx(s.lat, zoom)
        if (d <= CANDIDATE_PX && km <= CANDIDATE_KM) {
          found.push({ ...s, idx, enabled: d <= AUTO_ON_PX && km <= AUTO_ON_KM })
        }
      }
      found.sort((a, b) => a.idx - b.idx)
      amounts.current = {}
      releaseRef.current(found)
    }

    const onDown = (e) => {
      e.preventDefault()
      e.stopPropagation()
      drawingRef.current = true
      zoom = map.getZoom()
      map.dragPan.disable()
      document.body.classList.add('is-drawing')
      raw = [project([startRef.current.lng, startRef.current.lat], zoom)]
      base.current = null
      amounts.current = {}
      setLine('ghost', [], zoom)
      setLine('route', [], zoom)
      releaseRef.current([])
    }

    trainEl.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)

    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      map.remove()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Explore: each city shows what it costs to go there next; ones too far for the trip fade out.
  useEffect(() => {
    for (const [n, el] of Object.entries(stationEls.current)) {
      const d = explore[n]
      el.querySelector('.price').textContent = d?.fits ? `€${d.price}` : ''
      el.classList.toggle('far', !!d && !d.fits)
      el.classList.toggle('sel', n === selected)
      el.classList.toggle('hov', n === hovered)
    }
  }, [explore, selected, hovered])

  // A city picked from the list that is off screen: bring it into view.
  useEffect(() => {
    const map = mapRef.current
    const s = STATIONS.find((x) => x.name === selected)
    if (map && s && !map.getBounds().contains([s.lng, s.lat])) map.easeTo({ center: [s.lng, s.lat], duration: 800 })
  }, [selected])

  // Departure station changed: move the train there and mark that city as the start.
  useEffect(() => {
    trainRef.current?.setLngLat([start.lng, start.lat])
    for (const [n, el] of Object.entries(stationEls.current)) el.classList.toggle('start', n === start.name)
    const map = mapRef.current
    if (map && !map.getBounds().contains([start.lng, start.lat])) map.easeTo({ center: [start.lng, start.lat], duration: 800 })
  }, [start])

  // Candidates changed (release or a toggle): restyle pins and animate the line's bends.
  useEffect(() => {
    const byName = Object.fromEntries(candidates.map((c) => [c.name, c]))
    for (const [n, el] of Object.entries(stationEls.current)) {
      el.classList.toggle('cand', !!byName[n])
      el.classList.toggle('on', !!byName[n]?.enabled)
      // Only a drawn line narrows the map down to its nearby stations.
      el.classList.toggle('hidden', mode === 'draw' && !byName[n])
    }

    // Tapped route: a straight line from the train through each stop, in tap order.
    if (mode === 'click') {
      cancelAnimationFrame(anim.current)
      const zoom = mapRef.current.getZoom()
      const pts = [startRef.current, ...candidates].map((c) => project([c.lng, c.lat], zoom))
      base.current = { zoom, pts, tapped: true }
      amounts.current = {}
      setLine('ghost', [], zoom)
      setLine('route', pts, zoom)
      return
    }
    if (base.current?.tapped) base.current = null
    if (!base.current) return

    const from = { ...amounts.current }
    const to = Object.fromEntries(candidates.map((c) => [c.name, c.enabled ? 1 : 0]))
    const t0 = performance.now()
    cancelAnimationFrame(anim.current)
    const tick = (now) => {
      const k = Math.min(1, (now - t0) / ANIM_MS)
      const e = 1 - Math.pow(1 - k, 3) // ease-out
      for (const n of Object.keys(to)) amounts.current[n] = (from[n] || 0) + (to[n] - (from[n] || 0)) * e
      render()
      if (k < 1) anim.current = requestAnimationFrame(tick)
    }
    anim.current = requestAnimationFrame(tick)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidates, mode])

  // Reset: clear the line.
  useEffect(() => {
    if (!mapRef.current || resetKey === 0) return
    base.current = null
    amounts.current = {}
    setLine('route', [], 0)
    setLine('ghost', [], 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey])

  // Keep the map canvas matched to its box (the panel opening shrinks it). Skipped
  // mid-drag so the view never shifts under your finger; release resizes it.
  useEffect(() => {
    let t
    const ro = new ResizeObserver(() => {
      clearTimeout(t)
      t = setTimeout(() => {
        if (drawingRef.current) return
        mapRef.current?.resize()
        if (panelOpenRef.current && base.current && !base.current.tapped) fitRoute()
      }, 60)
    })
    ro.observe(elRef.current)
    return () => { ro.disconnect(); clearTimeout(t) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Panel opened while already sized (e.g. redraw): still frame the new route.
  useEffect(() => {
    if (!panelOpen) return
    const t = setTimeout(() => {
      mapRef.current?.resize()
      // A tapped route grows one stop at a time; don't yank the map around on every tap.
      if (base.current && !base.current.tapped) fitRoute()
    }, 450)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panelOpen, candidates.length])

  const fitRoute = () => {
    const b = base.current
    if (!b) return
    const bounds = new maplibregl.LngLatBounds()
    b.pts.forEach((p) => bounds.extend(unproject(p, b.zoom)))
    candRef.current.forEach((c) => bounds.extend([c.lng, c.lat]))
    mapRef.current.fitBounds(bounds, {
      padding: { top: 70, bottom: 60, left: 60, right: 60 },
      maxZoom: 7,
      pitch: 0,
      bearing: 0,
      duration: 900,
    })
  }

  const backFromTour = () => {
    setTouring(null)
    const cam = savedCamera.current
    savedCamera.current = null
    if (base.current) fitRoute()
    else mapRef.current.flyTo({ ...(cam || HOME), duration: 2000 })
  }

  return (
    <div className="map-holder">
      <div ref={elRef} className="map" />
      {touring && (
        <button className="tour-back" onClick={backFromTour}>
          ← Back to {base.current ? 'my route' : 'Europe'}
        </button>
      )}
    </div>
  )
}
