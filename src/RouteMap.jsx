import { useEffect, useRef } from 'react'
import maplibregl from 'maplibre-gl'

// The planned trip on a map: numbered stops joined by train lines, one style per kind of
// train. `hover` ({ type: 'stop' | 'leg', i }) is shared with the timeline and leg cards.

const STYLE = 'https://tiles.openfreemap.org/styles/bright'
const TEAL = '#3A21A3' // brand accent (deep violet)
const NIGHT = '#22124A' // brand midnight

export const KIND_LABEL = { highspeed: 'High-speed', regional: 'Regional', night: 'Night train' }

const empty = { type: 'FeatureCollection', features: [] }

function pin(i, point, label) {
  const el = document.createElement('div')
  el.className = `rm-pin ${i === 0 ? 'start' : ''}`
  const name = document.createElement('span')
  name.className = 'rm-name'
  name.textContent = point.name
  if (label) {
    const sub = document.createElement('b')
    sub.textContent = label
    name.append(sub)
  }
  el.innerHTML = `<span class="rm-num">${i === 0 ? '🚂' : i}</span>`
  el.append(name)
  return el
}

export default function RouteMap({ points, segments, labels = [], hover, onHover, cooperative = true }) {
  const elRef = useRef(null)
  const mapRef = useRef(null)
  const markers = useRef([])
  const ready = useRef(false)
  const hoverRef = useRef(onHover)
  hoverRef.current = onHover
  const data = useRef({ points, segments, labels })
  data.current = { points, segments, labels }

  // Draw (or redraw) the route and fit the camera to it.
  const draw = () => {
    const map = mapRef.current
    if (!map || !ready.current) return
    const { points, segments, labels } = data.current
    map.getSource('route').setData({
      type: 'FeatureCollection',
      features: segments.map((s) => ({
        type: 'Feature',
        properties: { leg: s.leg, kind: s.kind },
        geometry: { type: 'LineString', coordinates: s.coords },
      })),
    })
    markers.current.forEach((m) => m.remove())
    markers.current = points.map((p, i) => {
      const el = pin(i, p, labels[i])
      el.addEventListener('mouseenter', () => hoverRef.current({ type: 'stop', i }))
      el.addEventListener('mouseleave', () => hoverRef.current(null))
      return new maplibregl.Marker({ element: el }).setLngLat([p.lng, p.lat]).addTo(map)
    })
    fit()
  }

  // Keep the whole route in view, also when the map box grows or shrinks.
  const fit = () => {
    const map = mapRef.current
    const { points } = data.current
    if (!map || !points.length) return
    const b = new maplibregl.LngLatBounds()
    points.forEach((p) => b.extend([p.lng, p.lat]))
    const small = map.getContainer().clientHeight < 250
    const pad = small ? 24 : 70
    map.fitBounds(b, { padding: { top: pad, bottom: small ? 16 : 100, left: pad, right: pad }, maxZoom: 8, duration: 0 })
  }

  useEffect(() => {
    const map = new maplibregl.Map({
      container: elRef.current,
      style: STYLE,
      center: [8, 47],
      zoom: 4.5,
      attributionControl: { compact: true },
      dragRotate: false,
      pitchWithRotate: false,
      cooperativeGestures: cooperative,
    })
    if (!cooperative) map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right')
    mapRef.current = map
    map.on('load', () => {
      map.addSource('route', { type: 'geojson', data: empty })
      const base = { type: 'line', source: 'route', layout: { 'line-cap': 'round', 'line-join': 'round' } }
      map.addLayer({ ...base, id: 'route-casing', paint: { 'line-color': '#FFF5E6', 'line-width': 9 } })
      map.addLayer({ ...base, id: 'route-hover', filter: ['==', ['get', 'leg'], -1], paint: { 'line-color': TEAL, 'line-width': 16, 'line-opacity': 0.25 } })
      map.addLayer({ ...base, id: 'route-highspeed', filter: ['==', ['get', 'kind'], 'highspeed'], paint: { 'line-color': TEAL, 'line-width': 5 } })
      map.addLayer({
        ...base, id: 'route-regional', filter: ['==', ['get', 'kind'], 'regional'],
        layout: { ...base.layout, 'line-cap': 'butt' },
        paint: { 'line-color': TEAL, 'line-width': 4, 'line-dasharray': [2, 1.5] },
      })
      map.addLayer({ ...base, id: 'route-night', filter: ['==', ['get', 'kind'], 'night'], paint: { 'line-color': NIGHT, 'line-width': 5, 'line-dasharray': [0.1, 2] } })
      // Wide invisible line so legs are easy to point at.
      map.addLayer({ ...base, id: 'route-hit', paint: { 'line-color': '#000', 'line-width': 22, 'line-opacity': 0 } })
      map.on('mousemove', 'route-hit', (e) => {
        map.getCanvas().style.cursor = 'pointer'
        hoverRef.current({ type: 'leg', i: e.features[0].properties.leg })
      })
      map.on('mouseleave', 'route-hit', () => {
        map.getCanvas().style.cursor = ''
        hoverRef.current(null)
      })
      ready.current = true
      draw()
      map.on('resize', fit)
    })
    return () => {
      ready.current = false
      map.remove()
    }
  }, [])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(draw, [points, segments, labels.join('|')])

  // Reflect the shared hover on the map.
  useEffect(() => {
    const map = mapRef.current
    if (map && ready.current) {
      map.setFilter('route-hover', ['==', ['get', 'leg'], hover?.type === 'leg' ? hover.i : -1])
    }
    markers.current.forEach((m, i) => {
      const lit = (hover?.type === 'stop' && hover.i === i) || (hover?.type === 'leg' && (hover.i === i || hover.i + 1 === i))
      m.getElement().classList.toggle('hl', lit)
    })
  }, [hover])

  return (
    <div className="rm">
      <div ref={elRef} className="rm-map" />
      <div className="rm-legend" aria-label="Map legend">
        <span><i className="ln highspeed" /> High-speed</span>
        <span><i className="ln regional" /> Regional</span>
        <span><i className="ln night" /> Night train</span>
      </div>
    </div>
  )
}
