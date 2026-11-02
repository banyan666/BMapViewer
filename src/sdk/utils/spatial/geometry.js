import { area, booleanPointInPolygon, centerOfMass, feature, intersect, featureCollection, kinks, lineIntersect, lineString, pointOnFeature, polygon } from '@turf/turf'
import { AREA_FACTORS } from '../analysisConfig.js'

export function coordinate(value, label = 'coordinate') {
  if (!Array.isArray(value) || value.length < 2 || !Number.isFinite(value[0]) || !Number.isFinite(value[1])) {
    throw new TypeError(`${label} must contain finite WGS84 longitude and latitude.`)
  }
  if (Math.abs(value[0]) > 180 || Math.abs(value[1]) > 90) throw new RangeError(`${label} is outside WGS84 bounds.`)
  return value.slice(0, 2)
}

export const same = (a, b) => a[0] === b[0] && a[1] === b[1]
export const clone = (value) => structuredClone(value)
export function local(points) {
  if (points.some((point, index) => index > 0 && Math.abs(point[0] - points[index - 1][0]) > 180)) {
    throw new RangeError('This operation does not support antimeridian-crossing geometries.')
  }
  return points
}

function ring(value) {
  if (!Array.isArray(value)) throw new TypeError('Polygon rings must be coordinate arrays.')
  const points = value.map((point) => coordinate(point)).filter((point, index, source) => index === 0 || !same(point, source[index - 1]))
  if (points.length > 1 && same(points[0], points.at(-1))) points.pop()
  if (points.length < 3 || new Set(points.map((point) => point.join(','))).size !== points.length) {
    throw new RangeError('Polygon requires three distinct non-repeating vertices.')
  }
  const closed = local([...points, [...points[0]]])
  const origin = closed[0]
  let signed = 0, scale = 0
  for (let index = 0; index < closed.length - 1; index += 1) {
    const x = closed[index][0] - origin[0], y = closed[index][1] - origin[1]
    const nextX = closed[index + 1][0] - origin[0], nextY = closed[index + 1][1] - origin[1]
    signed += x * nextY - nextX * y
    scale = Math.max(scale, Math.abs(x), Math.abs(y))
  }
  if (Math.abs(signed) <= Number.EPSILON * scale * scale * closed.length) throw new RangeError('Polygon ring is collinear or degenerate.')
  const result = polygon([closed])
  if (!(area(result) > 0) || kinks(result).features.length) throw new RangeError('Polygon is degenerate or self-intersecting.')
  return closed
}

function polygonRings(input) {
  if (!Array.isArray(input) || !input.length) throw new TypeError('Polygon needs an outer ring.')
  const rings = input.map(ring)
  const outer = polygon([rings[0]])
  for (let index = 1; index < rings.length; index += 1) {
    const hole = polygon([rings[index]])
    if (lineIntersect(outer, hole).features.length || !rings[index].every((point) => booleanPointInPolygon(point, outer, { ignoreBoundary: true }))) {
      throw new RangeError('Polygon holes must lie strictly inside the outer ring.')
    }
    for (let previous = 1; previous < index; previous += 1) {
      if (lineIntersect(hole, polygon([rings[previous]])).features.length
        || intersect(featureCollection([hole, polygon([rings[previous]])]))) {
        throw new RangeError('Polygon holes must not overlap or touch.')
      }
    }
  }
  return rings
}

export function polygonFeature(input) {
  const geometry = Array.isArray(input) ? { type: 'Polygon', coordinates: [input] } : input?.geometry || input
  if (!geometry || !['Polygon', 'MultiPolygon'].includes(geometry.type)) throw new TypeError('Expected polygon coordinates or a Polygon/MultiPolygon geometry.')
  const coordinates = geometry.type === 'Polygon' ? polygonRings(geometry.coordinates) : geometry.coordinates?.map(polygonRings)
  if (!coordinates?.length) throw new RangeError('Polygon geometry must not be empty.')
  if (geometry.type === 'MultiPolygon') {
    for (let i = 0; i < coordinates.length; i += 1) {
      for (let j = 0; j < i; j += 1) {
        if (intersect(featureCollection([polygon(coordinates[i]), polygon(coordinates[j])]))) {
          throw new RangeError('MultiPolygon parts must not have overlapping interiors.')
        }
      }
    }
  }
  return feature({ type: geometry.type, coordinates })
}

export function lineFeature(input) {
  const geometry = Array.isArray(input) ? { type: 'LineString', coordinates: input } : input?.geometry || input
  if (geometry?.type !== 'LineString' || !Array.isArray(geometry.coordinates)) throw new TypeError('Expected LineString coordinates.')
  const points = local(geometry.coordinates.map((point) => coordinate(point)).filter((point, index, source) => index === 0 || !same(point, source[index - 1])))
  if (points.length < 2) throw new RangeError('LineString requires at least two distinct coordinates.')
  return lineString(points)
}

export function pointCoordinate(input) {
  if (Array.isArray(input)) return coordinate(input)
  const geometry = input?.geometry || input
  if (geometry?.type !== 'Point') throw new TypeError('Expected a Point geometry or coordinate.')
  return coordinate(geometry.coordinates)
}

export function pointRecords(input) {
  const list = input?.type === 'FeatureCollection' ? input.features : input
  if (!Array.isArray(list)) throw new TypeError('Points must be an SDK data array or FeatureCollection.')
  return list.map((item, index) => ({
    index,
    geometry: { type: 'Point', coordinates: pointCoordinate(item) },
    properties: clone(item.properties || {}),
    ...(item.id !== undefined ? { id: item.id } : {}),
  }))
}

export function polygonList(input, allowEmpty = false) {
  const list = input?.type === 'FeatureCollection' ? input.features : input
  if (!Array.isArray(list) || (!allowEmpty && !list.length)) throw new TypeError('Expected a non-empty polygon array or FeatureCollection.')
  return list.map(polygonFeature)
}

export function boundaryOption(config) {
  const value = config.includeBoundary ?? true
  if (typeof value !== 'boolean') throw new TypeError('includeBoundary must be a boolean.')
  return value
}

export function labelCenter(shape) {
  const center = centerOfMass(shape)
  return [...(booleanPointInPolygon(center, shape) ? center : pointOnFeature(shape)).geometry.coordinates]
}

export function areaResult(shape, config) {
  const squareMeters = shape ? area(shape) : 0
  if (!Number.isFinite(squareMeters)) throw new RangeError('The computed area is not finite.')
  const geometry = squareMeters > 0 ? clone(shape.geometry || shape) : null
  const parts = geometry ? (geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates).map((rings) => {
    const part = polygon(clone(rings))
    return { area: area(part) / AREA_FACTORS[config.areaUnit], center: labelCenter(part), geometry: part.geometry }
  }) : []
  const largest = parts.reduce((best, part) => !best || part.area > best.area ? part : best, null)
  return { area: squareMeters / AREA_FACTORS[config.areaUnit], unit: config.areaUnit, hasArea: !!geometry, geometry, center: largest ? [...largest.center] : null, parts }
}
