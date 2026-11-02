const DEG = Math.PI / 180
const R = 6378137

function point(value) {
  if (!Array.isArray(value) || !Number.isFinite(value[0]) || !Number.isFinite(value[1])
    || value[0] < -180 || value[0] > 180 || Math.abs(value[1]) >= 89
    || (value[2] != null && !Number.isFinite(value[2]))) throw new TypeError('WaterFlowLayer coordinates must be finite [longitude, latitude, height?] values.')
  return value.slice(0, 3)
}

export function normalizeWaterPolygons(geometry) {
  const polygons = geometry?.type === 'Polygon' ? [geometry.coordinates]
    : geometry?.type === 'MultiPolygon' ? geometry.coordinates : null
  if (!Array.isArray(polygons) || !polygons.length) throw new TypeError('WaterFlowLayer expects Polygon or MultiPolygon geometry.')
  return polygons.map((rings) => {
    if (!Array.isArray(rings) || !rings.length) throw new TypeError('WaterFlowLayer polygon rings are required.')
    return rings.map((ring) => {
      if (!Array.isArray(ring)) throw new TypeError('WaterFlowLayer rings must be coordinate arrays.')
      const normalized = []
      for (const source of ring) {
        const p = point(source), previous = normalized.at(-1)
        if (!previous || p[0] !== previous[0] || p[1] !== previous[1]) normalized.push(p)
      }
      if (normalized.length > 1 && normalized[0][0] === normalized.at(-1)[0] && normalized[0][1] === normalized.at(-1)[1]) normalized.pop()
      if (new Set(normalized.map((p) => `${p[0]},${p[1]}`)).size < 3) throw new RangeError('WaterFlowLayer rings need at least three distinct points.')
      let twiceArea = 0
      const origin = normalized[0]
      for (let i = 0; i < normalized.length; i++) {
        const a = normalized[i], b = normalized[(i + 1) % normalized.length]
        twiceArea += (a[0] - origin[0]) * (b[1] - origin[1]) - (b[0] - origin[0]) * (a[1] - origin[1])
      }
      if (Math.abs(twiceArea) < 1e-14) throw new RangeError('WaterFlowLayer rings must enclose an area.')
      normalized.push([...normalized[0]])
      return normalized
    })
  })
}

export function normalizeCenterline(input) {
  if (input == null) return []
  const geometry = input.geometry || (Array.isArray(input) ? { type: 'LineString', coordinates: input } : input)
  const lines = geometry.type === 'LineString' ? [geometry.coordinates]
    : geometry.type === 'MultiLineString' ? geometry.coordinates : null
  if (!Array.isArray(lines) || !lines.length) throw new TypeError('WaterFlowLayer centerline must be LineString or MultiLineString geometry.')
  return lines.map((line) => {
    if (!Array.isArray(line)) throw new TypeError('WaterFlowLayer centerline coordinates must be arrays.')
    const result = []
    for (const source of line) {
      const p = point(source), previous = result.at(-1)
      if (!previous || p[0] !== previous[0] || p[1] !== previous[1]) result.push(p)
    }
    if (result.length < 2) throw new RangeError('WaterFlowLayer centerline needs two distinct positions.')
    return result
  })
}

export function waterBounds(rings) {
  let west = Infinity, east = -Infinity, south = Infinity, north = -Infinity
  for (const p of rings[0]) {
    west = Math.min(west, p[0]); east = Math.max(east, p[0])
    south = Math.min(south, p[1]); north = Math.max(north, p[1])
  }
  if (east - west > 180) throw new RangeError('WaterFlowLayer polygons crossing the antimeridian must be split first.')
  const padX = (east - west) * 0.015, padY = (north - south) * 0.015
  west -= padX; east += padX; south -= padY; north += padY
  const metersX = R * DEG * Math.cos((north + south) / 2 * DEG), metersY = R * DEG
  const widthMeters = (east - west) * metersX, heightMeters = (north - south) * metersY
  if (widthMeters < 0.01 || heightMeters < 0.01) throw new RangeError('WaterFlowLayer water bounds are too small.')
  return { west, east, south, north, widthMeters, heightMeters, metersX, metersY }
}

function waterMask(rings, bounds, size) {
  const pixelRings = rings.map((ring) => ring.map((p) => [
    (p[0] - bounds.west) / (bounds.east - bounds.west) * size,
    (bounds.north - p[1]) / (bounds.north - bounds.south) * size,
  ]))
  const mask = new Uint8Array(size * size)
  for (let y = 0; y < size; y++) {
    const scan = y + 0.5, crossings = []
    for (const ring of pixelRings) for (let i = 0; i < ring.length - 1; i++) {
      const a = ring[i], b = ring[i + 1]
      if ((a[1] > scan) !== (b[1] > scan)) crossings.push(a[0] + (scan - a[1]) / (b[1] - a[1]) * (b[0] - a[0]))
    }
    crossings.sort((a, b) => a - b)
    for (let i = 0; i + 1 < crossings.length; i += 2) {
      const start = Math.max(0, Math.ceil(crossings[i] - 0.5)), end = Math.min(size, Math.ceil(crossings[i + 1] - 0.5))
      if (end > start) mask.fill(1, y * size + start, y * size + end)
    }
  }
  return mask
}

function distanceToShore(mask, size) {
  const distance = new Float32Array(mask.length), diagonal = Math.SQRT2
  for (let i = 0; i < mask.length; i++) distance[i] = mask[i] ? size * 2 : 0
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = y * size + x
    if (x > 0) distance[i] = Math.min(distance[i], distance[i - 1] + 1)
    if (y > 0) {
      distance[i] = Math.min(distance[i], distance[i - size] + 1)
      if (x > 0) distance[i] = Math.min(distance[i], distance[i - size - 1] + diagonal)
      if (x + 1 < size) distance[i] = Math.min(distance[i], distance[i - size + 1] + diagonal)
    }
  }
  for (let y = size - 1; y >= 0; y--) for (let x = size - 1; x >= 0; x--) {
    const i = y * size + x
    if (x + 1 < size) distance[i] = Math.min(distance[i], distance[i + 1] + 1)
    if (y + 1 < size) {
      distance[i] = Math.min(distance[i], distance[i + size] + 1)
      if (x > 0) distance[i] = Math.min(distance[i], distance[i + size - 1] + diagonal)
      if (x + 1 < size) distance[i] = Math.min(distance[i], distance[i + size + 1] + diagonal)
    }
  }
  return distance
}

function flowSegments(lines, bounds) {
  const segments = []
  for (const line of lines) for (let i = 0; i + 1 < line.length; i++) {
    const a = line[i], b = line[i + 1]
    const x = (a[0] - bounds.west) * bounds.metersX, y = (a[1] - bounds.south) * bounds.metersY
    const dx = (b[0] - a[0]) * bounds.metersX, dy = (b[1] - a[1]) * bounds.metersY
    const length = Math.hypot(dx, dy)
    let curvature = 0
    if (i + 2 < line.length) {
      const c = line[i + 2], angle = Math.atan2((c[1] - b[1]) * bounds.metersY, (c[0] - b[0]) * bounds.metersX) - Math.atan2(dy, dx)
      curvature = Math.atan2(Math.sin(angle), Math.cos(angle))
    }
    segments.push({ x, y, dx, dy, length, length2: length * length, nx: dx / length, ny: dy / length, curvature })
  }
  return segments
}

/** 生成流向、弯道流速与岸线距离贴图；纯数据函数，不依赖 DOM 或 WebGL。 */
export function bakeWaterFlow(rings, centerlines, size, flowDirection) {
  const bounds = waterBounds(rings), mask = waterMask(rings, bounds, size), distance = distanceToShore(mask, size)
  const flow = new Uint8ClampedArray(size * size * 4), shore = new Uint8ClampedArray(flow.length)
  const segments = flowSegments(centerlines, bounds)
  const fallbackX = Math.sin(flowDirection * DEG), fallbackY = Math.cos(flowDirection * DEG)
  const blendRadius = Math.min(bounds.widthMeters, bounds.heightMeters) * 24 / size
  const shorePixels = Math.max(2, size / 64)
  for (let py = 0; py < size; py++) for (let px = 0; px < size; px++) {
    const pixel = py * size + px, index = pixel * 4
    let vx = fallbackX, vy = fallbackY, velocity = 1
    if (mask[pixel] && segments.length) {
      const x = (px + 0.5) / size * bounds.widthMeters, y = (1 - (py + 0.5) / size) * bounds.heightMeters
      let first = null, second = null, d1 = Infinity, d2 = Infinity
      for (const segment of segments) {
        const t = Math.max(0, Math.min(1, ((x - segment.x) * segment.dx + (y - segment.y) * segment.dy) / segment.length2))
        const d = (x - segment.x - t * segment.dx) ** 2 + (y - segment.y - t * segment.dy) ** 2
        if (d < d1) { second = first; d2 = d1; first = segment; d1 = d }
        else if (d < d2) { second = segment; d2 = d }
      }
      vx = first.nx; vy = first.ny
      let curvature = first.curvature
      if (second && first.nx * second.nx + first.ny * second.ny > -0.5) {
        const t = Math.min(1, (Math.sqrt(d2) - Math.sqrt(d1)) / blendRadius), weight = 0.5 + 0.5 * t * t * (3 - 2 * t)
        vx = second.nx * (1 - weight) + first.nx * weight
        vy = second.ny * (1 - weight) + first.ny * weight
        curvature = second.curvature * (1 - weight) + first.curvature * weight
      }
      const magnitude = Math.hypot(vx, vy)
      if (magnitude > 1e-6) { vx /= magnitude; vy /= magnitude }
      const side = (first.dx * (y - first.y) - first.dy * (x - first.x)) / first.length
      const crossProfile = Math.max(-1, Math.min(1, side * Math.sign(curvature) / Math.max(1, blendRadius * 7.5)))
      velocity = 1 + 0.35 * Math.sin(crossProfile * Math.PI / 2)
    }
    flow[index] = mask[pixel] ? Math.round((vx * 0.5 + 0.5) * 255) : 128
    flow[index + 1] = mask[pixel] ? Math.round((vy * 0.5 + 0.5) * 255) : 128
    flow[index + 2] = mask[pixel] ? Math.round(velocity * 127) : 128
    flow[index + 3] = 255
    const edge = Math.round(Math.exp(-distance[pixel] / shorePixels) * 255)
    shore[index] = shore[index + 1] = shore[index + 2] = edge
    shore[index + 3] = 255
  }
  return { bounds, mask, flow, shore, size }
}
