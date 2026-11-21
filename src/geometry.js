// Path helpers. All math runs on plain {x, y} points in projected pixel space.

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)

// Re-sample a polyline so points are evenly spaced (removes hand jitter clumps).
export function resample(pts, step) {
  if (pts.length < 2) return pts.slice()
  const out = [pts[0]]
  let carry = 0
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1]
    const b = pts[i]
    const seg = dist(a, b)
    let t = step - carry
    while (t <= seg) {
      out.push({ x: a.x + ((b.x - a.x) * t) / seg, y: a.y + ((b.y - a.y) * t) / seg })
      t += step
    }
    carry = seg - (t - step)
  }
  const last = pts[pts.length - 1]
  if (dist(out[out.length - 1], last) > step * 0.3) out.push(last)
  return out
}

// Moving-average smoothing; endpoints stay put so the line still starts at the train.
export function smooth(pts, radius = 3, passes = 3) {
  let cur = pts
  for (let p = 0; p < passes; p++) {
    cur = cur.map((pt, i) => {
      if (i === 0 || i === cur.length - 1) return pt
      const r = Math.min(radius, i, cur.length - 1 - i)
      let sx = 0
      let sy = 0
      for (let k = -r; k <= r; k++) { sx += cur[i + k].x; sy += cur[i + k].y }
      return { x: sx / (2 * r + 1), y: sy / (2 * r + 1) }
    })
  }
  return cur
}

// Closest point index on the path, and its distance.
export function closest(pts, p) {
  let best = Infinity
  let idx = 0
  pts.forEach((q, i) => {
    const d = dist(p, q)
    if (d < best) { best = d; idx = i }
  })
  return { idx, d: best }
}

// Bend the path so it passes exactly through each target, then eases back to the
// original line. `amount` (0..1) per target lets us animate the bend in/out.
export function bend(pts, targets) {
  const out = pts.map((p) => ({ ...p }))
  // cumulative arc length, to measure the falloff window along the line
  const arc = [0]
  for (let i = 1; i < pts.length; i++) arc.push(arc[i - 1] + dist(pts[i - 1], pts[i]))

  for (const t of targets) {
    if (!t.amount) continue
    const anchor = pts[t.idx]
    const dx = (t.x - anchor.x) * t.amount
    const dy = (t.y - anchor.y) * t.amount
    const window = Math.max(50, Math.hypot(t.x - anchor.x, t.y - anchor.y) * 3.5)
    for (let i = 1; i < pts.length; i++) {
      const s = Math.abs(arc[i] - arc[t.idx])
      if (s > window) continue
      const w = 0.5 * (1 + Math.cos((Math.PI * s) / window)) // cosine falloff: 1 at station, 0 at edge
      out[i].x += dx * w
      out[i].y += dy * w
    }
  }
  return out
}
