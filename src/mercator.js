// Web Mercator at a fixed zoom (MapLibre uses 512px tiles). Lets us keep the drawn
// line in stable pixel coordinates no matter how the camera moves afterwards.
const TILE = 512

export function project([lng, lat], zoom) {
  const scale = TILE * Math.pow(2, zoom)
  const s = Math.sin((lat * Math.PI) / 180)
  return {
    x: ((lng + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * scale,
  }
}

export function unproject({ x, y }, zoom) {
  const scale = TILE * Math.pow(2, zoom)
  const lng = (x / scale) * 360 - 180
  const n = Math.PI - (2 * Math.PI * y) / scale
  const lat = (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)))
  return [lng, lat]
}

// Kilometres covered by one pixel at this spot and zoom.
export function kmPerPx(lat, zoom) {
  return (40075 * Math.cos((lat * Math.PI) / 180)) / (TILE * Math.pow(2, zoom))
}
