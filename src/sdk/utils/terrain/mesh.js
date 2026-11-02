import { tesselate } from '@turf/turf'
import { polygonFeature } from '../spatial/geometry.js'

const middle = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
const key = (point) => point.map((value) => value.toFixed(12)).join(',')
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y)
export const triangleArea = (a, b, c) => Math.abs((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)) / 2

// 局部 WGS84 椭球等距近似投影。所有网格复用同一平面，避免把地球曲率误算成坡度。
function projector(center) {
  const latitude = center[1] * Math.PI / 180
  const e2 = 6.69437999014e-3, a = 6378137
  const denominator = 1 - e2 * Math.sin(latitude) ** 2
  const eastScale = a / Math.sqrt(denominator) * Math.cos(latitude) * Math.PI / 180
  const northScale = a * (1 - e2) / denominator ** 1.5 * Math.PI / 180
  return ([lon, lat]) => ({ x: (lon - center[0]) * eastScale, y: (lat - center[1]) * northScale })
}

export async function terrainMesh(input, ctx) {
  const shape = polygonFeature(input)
  const polygons = shape.geometry.type === 'Polygon' ? [shape.geometry.coordinates] : shape.geometry.coordinates
  const raw = polygons.flat(2)
  if (raw.length > 512) throw new RangeError('地形区域边界最多包含 512 个坐标，请先简化边界。')
  const west = Math.min(...raw.map((p) => p[0])), east = Math.max(...raw.map((p) => p[0]))
  const south = Math.min(...raw.map((p) => p[1])), north = Math.max(...raw.map((p) => p[1]))
  const center = [(west + east) / 2, (south + north) / 2]
  if (Math.abs(center[1]) > 85 || east - west > 2 || north - south > 2) throw new RangeError('地形面分析仅支持非极区、跨度不超过 2° 的局部区域。')
  const project = projector(center)
  const seeds = polygons.flatMap((coordinates) => tesselate({ type: 'Feature', geometry: { type: 'Polygon', coordinates }, properties: {} }).features.map((item) => item.geometry.coordinates[0].slice(0, 3)))
  let maxEdge = 0
  for (const triangle of seeds) for (let i = 0; i < 3; i += 1) maxEdge = Math.max(maxEdge, distance(project(triangle[i]), project(triangle[(i + 1) % 3])))
  const depth = Math.max(0, Math.ceil(Math.log2(maxEdge / ctx.config.cellSize)))
  if (seeds.length * 4 ** depth > ctx.config.maxSamples * 2) throw new RangeError('区域网格超过 maxSamples，请增大 cellSize 或缩小区域。')
  const triangles = [], coordinates = [], indices = new Map()
  const add = (point) => {
    const id = key(point)
    if (!indices.has(id)) { indices.set(id, coordinates.length); coordinates.push(point) }
    return indices.get(id)
  }
  const split = (a, b, c, remaining) => {
    if (!remaining) { triangles.push([add(a), add(b), add(c)]); return }
    const ab = middle(a, b), bc = middle(b, c), ca = middle(c, a)
    split(a, ab, ca, remaining - 1); split(ab, b, bc, remaining - 1)
    split(ca, bc, c, remaining - 1); split(ab, bc, ca, remaining - 1)
  }
  seeds.forEach((triangle) => split(...triangle, depth))
  const samples = await ctx.sample(coordinates)
  const vertices = samples.map((sample) => ({ ...sample, ...project(sample.center) }))
  const cells = triangles.map((indices, index) => {
    const points = indices.map((id) => vertices[id])
    const [a, b, c] = points
    const determinant = (b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y)
    const dx = ((b.height - a.height) * (c.y - a.y) - (c.height - a.height) * (b.y - a.y)) / determinant
    const dy = ((b.x - a.x) * (c.height - a.height) - (c.x - a.x) * (b.height - a.height)) / determinant
    const gradient = Math.hypot(dx, dy)
    const projectedArea = Math.abs(determinant) / 2
    return {
      index, points, projectedArea, surfaceArea: projectedArea * Math.sqrt(1 + gradient ** 2),
      slope: Math.atan(gradient) * 180 / Math.PI,
      aspect: gradient < 1e-8 ? null : (Math.atan2(-dx, -dy) * 180 / Math.PI + 360) % 360,
      center: [0, 1].map((axis) => points.reduce((sum, p) => sum + p.center[axis], 0) / 3),
      height: points.reduce((sum, p) => sum + p.height, 0) / 3,
    }
  }).filter((cell) => cell.projectedArea > 1e-8)
  if (!cells.length) throw new RangeError('区域过小或退化，无法建立地形网格。')
  return { cells, vertices, center, geometry: shape.geometry }
}

export function geometry(points, fixedHeight) {
  const coordinates = points.map((point) => [...point.center, fixedHeight ?? point.height])
  return { type: 'Polygon', coordinates: [[...coordinates, [...coordinates[0]]]] }
}

// 在线性三角网内沿等高线裁剪，再积分，正确处理跨越基准面的三角形。
export function clipHeight(points, level, above) {
  const output = []
  const inside = (p) => above ? p.height >= level : p.height <= level
  for (let i = 0; i < points.length; i += 1) {
    const a = points[i], b = points[(i + 1) % points.length]
    if (inside(a)) output.push(a)
    if (inside(a) !== inside(b)) {
      const t = (level - a.height) / (b.height - a.height)
      output.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, height: level, center: [0, 1].map((axis) => a.center[axis] + (b.center[axis] - a.center[axis]) * t) })
    }
  }
  return output
}

export function integrate(points, level) {
  let area = 0, volume = 0
  for (let i = 1; i < points.length - 1; i += 1) {
    const triangle = [points[0], points[i], points[i + 1]]
    const size = triangleArea(...triangle)
    area += size
    volume += size * triangle.reduce((sum, point) => sum + Math.abs(point.height - level), 0) / 3
  }
  return { area, volume }
}
