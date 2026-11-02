import { area, booleanPointInPolygon, booleanPointOnLine, buffer, difference, distance, featureCollection, intersect, lineIntersect, lineString, nearestPointOnLine, point, union } from '@turf/turf'
import { AREA_FACTORS, UNIT_OPTIONS } from '../analysisConfig.js'
import { areaResult, boundaryOption, clone, coordinate, lineFeature, pointCoordinate, pointRecords, polygonFeature, polygonList, same } from './geometry.js'

const units = (config) => ({ units: UNIT_OPTIONS[config.unit].turfUnit })
const combine = (features) => features.length === 0 ? null : features.length === 1 ? features[0] : union(featureCollection(features))
const positive = (radius) => {
  if (!Number.isFinite(radius) || radius <= 0) throw new RangeError('Radius must be a finite positive number in the configured unit.')
}

export function getBuffer(input, radius, config) {
  positive(radius)
  const steps = config.steps ?? 64
  if (!Number.isInteger(steps) || steps < 8 || steps > 256) throw new RangeError('steps must be an integer from 8 to 256.')
  const geometry = input?.geometry || input
  const type = Array.isArray(input) ? (typeof input[0] === 'number' ? 'Point' : config.type || 'LineString') : geometry?.type
  let source
  if (type === 'Point') source = point(pointCoordinate(input))
  else if (type === 'LineString') source = lineFeature(input)
  else if (type === 'Polygon' || type === 'MultiPolygon') source = polygonFeature(input)
  else throw new TypeError('Buffer input must be Point, LineString, Polygon or MultiPolygon.')
  const result = buffer(source, radius, { ...units(config), steps })
  if (result) polygonFeature(result) // 禁止将跨日期变更线或无效结果静默交给地图。
  return { ...areaResult(result, config), radius, radiusUnit: config.unit, sourceGeometry: clone(source.geometry) }
}

export function getPointsInPolygon(points, region, config) {
  const shape = polygonFeature(region)
  const records = pointRecords(points)
  const includeBoundary = boundaryOption(config)
  const insidePoints = [], outsidePoints = [], boundaryPoints = []
  for (const record of records) {
    const coords = record.geometry.coordinates
    const covered = booleanPointInPolygon(coords, shape)
    const interior = covered && booleanPointInPolygon(coords, shape, { ignoreBoundary: true })
    if (covered && !interior) boundaryPoints.push(clone(record))
    ;(interior || (includeBoundary && covered) ? insidePoints : outsidePoints).push(record)
  }
  return { count: insidePoints.length, totalCount: records.length, includeBoundary, insidePoints, outsidePoints, boundaryPoints, geometry: shape.geometry }
}

export function getNearestPointOnLine(inputPoint, inputLine, config) {
  const source = pointCoordinate(inputPoint)
  const line = lineFeature(inputLine)
  const nearest = nearestPointOnLine(line, source, units(config))
  const properties = nearest.properties
  return {
    unit: config.unit, point: source, center: [...nearest.geometry.coordinates],
    distance: properties.pointDistance ?? properties.dist,
    distanceAlongLine: properties.totalDistance ?? properties.location,
    segmentIndex: Math.min(line.geometry.coordinates.length - 2, properties.segmentIndex ?? properties.index),
    geometry: clone(nearest.geometry),
    connection: { type: 'LineString', coordinates: [source, [...nearest.geometry.coordinates]] },
  }
}

export function getNearbyFeatures(center, radius, features, config) {
  positive(radius)
  const origin = pointCoordinate(center)
  const records = pointRecords(features)
  const tolerance = Number.EPSILON * Math.max(1, radius) * 8
  const selected = records.map((record) => ({ ...record, distance: distance(origin, record.geometry.coordinates, units(config)) }))
    .filter((record) => record.distance <= radius + tolerance)
    .sort((a, b) => a.distance - b.distance || a.index - b.index)
  return { center: origin, radius, unit: config.unit, count: selected.length, totalCount: records.length, features: selected, nearest: selected.length ? clone(selected[0]) : null }
}

export function getDifferenceArea(first, second, config) {
  const a = polygonFeature(first), b = polygonFeature(second)
  const result = areaResult(difference(featureCollection([a, b])), config)
  const firstArea = area(a) / AREA_FACTORS[config.areaUnit]
  return { ...result, firstArea, secondArea: area(b) / AREA_FACTORS[config.areaUnit], removedArea: Math.max(0, firstArea - result.area) }
}

export function getUnionArea(input, config) {
  const features = polygonList(input)
  const result = areaResult(combine(features), config)
  const sourceArea = features.reduce((sum, shape) => sum + area(shape), 0) / AREA_FACTORS[config.areaUnit]
  return { ...result, sourceCount: features.length, sourceArea, duplicateArea: Math.max(0, sourceArea - result.area) }
}

export function getCoverage(target, coverageRegions, config) {
  const region = polygonFeature(target)
  const covers = polygonList(coverageRegions, true)
  const merged = combine(covers)
  const covered = areaResult(merged ? intersect(featureCollection([region, merged])) : null, config)
  const uncovered = areaResult(merged ? difference(featureCollection([region, merged])) : region, config)
  const targetArea = area(region) / AREA_FACTORS[config.areaUnit]
  return {
    unit: config.areaUnit, targetArea, coveredArea: covered.area, uncoveredArea: uncovered.area,
    coverageRatio: Math.min(1, covered.area / targetArea), fullyCovered: !uncovered.hasArea, sourceCount: covers.length,
    center: covered.center, coveredGeometry: covered.geometry, uncoveredGeometry: uncovered.geometry,
    coveredParts: covered.parts, uncoveredParts: uncovered.parts,
  }
}

export function getLineInPolygon(inputLine, inputPolygon, config) {
  const line = lineFeature(inputLine)
  const region = polygonFeature(inputPolygon)
  const includeBoundary = boundaryOption(config)
  const rings = region.geometry.type === 'Polygon' ? region.geometry.coordinates : region.geometry.coordinates.flat()
  const vertices = rings.flat()
  const insideSegments = [], outsideSegments = [], boundarySegments = [], intersections = []
  const coords = line.geometry.coordinates
  for (let index = 0; index < coords.length - 1; index += 1) {
    const start = coords[index], end = coords[index + 1]
    const segment = lineString([start, end])
    const axis = Math.abs(end[0] - start[0]) >= Math.abs(end[1] - start[1]) ? 0 : 1
    const ratio = (position) => (position[axis] - start[axis]) / (end[axis] - start[axis])
    const hits = lineIntersect(segment, region).features.map((item) => coordinate(item.geometry.coordinates))
    for (const vertex of vertices) {
      if (booleanPointOnLine(vertex, segment, { epsilon: 1e-12 })) hits.push([...vertex])
    }
    for (const hit of hits) if (!intersections.some((existing) => same(existing, hit))) intersections.push([...hit])
    const cuts = [0, 1, ...hits.map(ratio)].filter((value) => value >= -1e-12 && value <= 1 + 1e-12)
      .map((value) => Math.min(1, Math.max(0, value))).sort((a, b) => a - b)
      .filter((value, position, source) => position === 0 || value - source[position - 1] > 1e-12)
    const interpolate = (value) => [start[0] + (end[0] - start[0]) * value, start[1] + (end[1] - start[1]) * value]
    for (let cut = 0; cut < cuts.length - 1; cut += 1) {
      const a = interpolate(cuts[cut]), b = interpolate(cuts[cut + 1])
      const center = interpolate((cuts[cut] + cuts[cut + 1]) / 2)
      const covered = booleanPointInPolygon(center, region)
      const interior = covered && booleanPointInPolygon(center, region, { ignoreBoundary: true })
      const item = { segmentIndex: index, distance: distance(a, b, units(config)), geometry: { type: 'LineString', coordinates: [a, b] } }
      if (covered && !interior) boundarySegments.push(clone(item))
      ;(interior || (includeBoundary && covered) ? insideSegments : outsideSegments).push(item)
    }
  }
  const sum = (segments) => segments.reduce((total, segment) => total + segment.distance, 0)
  const geometry = (segments) => segments.length ? { type: 'MultiLineString', coordinates: segments.map((item) => clone(item.geometry.coordinates)) } : null
  const insideDistance = sum(insideSegments), outsideDistance = sum(outsideSegments)
  return {
    unit: config.unit, includeBoundary, hasInside: insideSegments.length > 0,
    totalDistance: insideDistance + outsideDistance, insideDistance, outsideDistance, boundaryDistance: sum(boundarySegments),
    intersections, insideSegments, outsideSegments, boundarySegments,
    insideGeometry: geometry(insideSegments), outsideGeometry: geometry(outsideSegments),
  }
}
