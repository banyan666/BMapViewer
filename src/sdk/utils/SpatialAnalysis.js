import { area as turfArea, booleanPointInPolygon, centerOfMass, distance as turfDistance, earthRadius, featureCollection, intersect, kinks, lengthToRadians, midpoint as turfMidpoint, pointOnFeature, polygon } from '@turf/turf'
import { DEFAULT_CONFIG, AREA_FACTORS, UNIT_OPTIONS, normalizeConfig, normalizeOptions } from './analysisConfig.js'
import * as operations from './spatial/operations.js'

function normalizeCoordinate(coordinate, label) {
  if (!Array.isArray(coordinate) || coordinate.length < 2) {
    throw new TypeError(`${label} must be [longitude, latitude].`)
  }
  const [longitude, latitude] = coordinate
  if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
    throw new TypeError(`${label} must contain finite numbers.`)
  }
  if (longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) {
    throw new RangeError(`${label} is outside the WGS84 longitude/latitude range.`)
  }
  // 空间分析使用经纬度；不修改调用者的数组，也不计入第三维高度。
  return [longitude, latitude]
}

function normalizeCoordinates(coordinates) {
  if (!Array.isArray(coordinates) || coordinates.length < 2) {
    throw new RangeError('Distance analysis requires at least two coordinates.')
  }
  return coordinates.map((coordinate, index) => normalizeCoordinate(coordinate, `coordinates[${index}]`))
}

function sameCoordinate(first, second) {
  return first[0] === second[0] && first[1] === second[1]
}

function normalizeAreaCoordinates(coordinates) {
  if (!Array.isArray(coordinates) || coordinates.length < 3) {
    throw new RangeError('Area analysis requires at least three distinct vertices.')
  }
  const points = normalizeCoordinates(coordinates).filter((point, index, source) =>
    index === 0 || !sameCoordinate(point, source[index - 1]))
  if (points.length > 1 && sameCoordinate(points[0], points.at(-1))) points.pop()
  const distinctCount = new Set(points.map((point) => `${point[0]},${point[1]}`)).size
  if (distinctCount < 3 || distinctCount !== points.length) {
    throw new RangeError('Area analysis requires at least three distinct, non-repeating vertices.')
  }
  return [...points, [...points[0]]]
}

// 展开经度后计算局部多边形，避免跨越 ±180° 时被当作横跨全球的区域。
function unwrapRing(coordinates) {
  const ring = []
  for (const [longitude, latitude] of coordinates.slice(0, -1)) {
    let unwrapped = longitude
    if (ring.length) {
      while (unwrapped - ring.at(-1)[0] > 180) unwrapped -= 360
      while (unwrapped - ring.at(-1)[0] < -180) unwrapped += 360
    }
    ring.push([unwrapped, latitude])
  }
  if (Math.abs(ring.at(-1)[0] - ring[0][0]) > 180) {
    throw new RangeError('Area analysis expects a local polygon that does not surround a pole.')
  }
  return [...ring, [...ring[0]]]
}

function hasArea(ring) {
  const [originX, originY] = ring[0]
  let signedArea = 0
  let scale = 0
  for (let index = 0; index < ring.length - 1; index += 1) {
    const x = ring[index][0] - originX
    const y = ring[index][1] - originY
    const nextX = ring[index + 1][0] - originX
    const nextY = ring[index + 1][1] - originY
    signedArea += x * nextY - nextX * y
    scale = Math.max(scale, Math.abs(x), Math.abs(y))
  }
  return Math.abs(signedArea) > Number.EPSILON * scale * scale * ring.length
}

function overlapPolygon(coordinates) {
  // Turf 裁剪使用经纬度平面拓扑；此方法仅接受不跨日期变更线的局部外环。
  if (coordinates.some((point, index) => index > 0 && Math.abs(point[0] - coordinates[index - 1][0]) > 180)) {
    throw new RangeError('Overlap analysis does not support polygons crossing the antimeridian.')
  }
  return polygon([coordinates])
}

function polygonLabelCenter(feature) {
  const center = centerOfMass(feature)
  return booleanPointInPolygon(center, feature)
    ? [...center.geometry.coordinates]
    : [...pointOnFeature(feature).geometry.coordinates]
}

/**
 * 空间分析工具。无需 Viewer，使用 WGS84 经纬度进行计算。
 * @param {object} [config] 默认分析配置
 * @param {'m'|'km'|'meters'|'kilometers'} [config.unit='m'] 距离单位
 * @param {'m2'|'km2'|'ha'} [config.areaUnit='m2'] 面积单位
 */
class SpatialAnalysis {
  constructor(config = {}) {
    this.config = normalizeConfig({ ...DEFAULT_CONFIG, ...normalizeOptions(config) })
  }

  /** 更新后续分析的默认配置。 */
  updateConfig(config = {}) {
    this.config = normalizeConfig({ ...this.config, ...normalizeOptions(config) })
    return this
  }

  /** 点、线、面缓冲区；原始面坐标需指定 options.type: 'Polygon'。 */
  getBuffer(input, radius, options = {}) {
    return operations.getBuffer(input, radius, normalizeConfig({ ...this.config, ...normalizeOptions(options) }))
  }

  /** 批量点面判断，includeBoundary 默认为 true。 */
  getPointsInPolygon(points, region, options = {}) {
    return operations.getPointsInPolygon(points, region, normalizeConfig({ ...this.config, ...normalizeOptions(options) }))
  }

  /** 查询点在折线上的最近位置、最近距离及沿线累计距离。 */
  getNearestPointOnLine(point, line, options = {}) {
    return operations.getNearestPointOnLine(point, line, normalizeConfig({ ...this.config, ...normalizeOptions(options) }))
  }

  /** 半径内的点位查询，按距离升序返回，保留业务属性与原始索引。 */
  getNearbyFeatures(center, radius, features, options = {}) {
    return operations.getNearbyFeatures(center, radius, features, normalizeConfig({ ...this.config, ...normalizeOptions(options) }))
  }

  /** 第一组面减去第二组面，返回剩余面积和几何。 */
  getDifferenceArea(first, second, options = {}) {
    return operations.getDifferenceArea(first, second, normalizeConfig({ ...this.config, ...normalizeOptions(options) }))
  }

  /** 合并多个面，重叠部分不重复计入总面积。 */
  getUnionArea(polygons, options = {}) {
    return operations.getUnionArea(polygons, normalizeConfig({ ...this.config, ...normalizeOptions(options) }))
  }

  /** 按区域边界切分折线，统计区域内外的距离，边界归属由 includeBoundary 控制。 */
  getLineInPolygon(line, region, options = {}) {
    return operations.getLineInPolygon(line, region, normalizeConfig({ ...this.config, ...normalizeOptions(options) }))
  }

  /** 目标区域的几何覆盖分析；多个覆盖面先合并，再计算覆盖率及未覆盖部分。 */
  getCoverage(target, coverageRegions, options = {}) {
    return operations.getCoverage(target, coverageRegions, normalizeConfig({ ...this.config, ...normalizeOptions(options) }))
  }

  /**
   * 按顺序计算相邻坐标间的球面距离，返回分段距离、累计距离和总距离。
   * 不自动闭合路径，不包含地形起伏或高度差。
   * @param {number[][]} coordinates 至少两个 [经度, 纬度] 坐标
   * @param {object} [options] 仅对本次分析生效的配置
   * @returns {{unit: string, distances: number[], segments: object[], totalDistance: number}}
   */
  getDistance(coordinates, options = {}) {
    const config = normalizeConfig({ ...this.config, ...normalizeOptions(options) })
    const points = normalizeCoordinates(coordinates)
    const segments = []
    let totalDistance = 0

    for (let index = 0; index < points.length - 1; index += 1) {
      const start = points[index]
      const end = points[index + 1]
      const distance = turfDistance(start, end, { units: UNIT_OPTIONS[config.unit].turfUnit })
      totalDistance += distance
      segments.push({
        index,
        start: [...start],
        end: [...end],
        center: turfMidpoint(start, end).geometry.coordinates,
        distance,
        cumulativeDistance: totalDistance,
      })
    }

    return {
      unit: config.unit,
      distances: segments.map((segment) => segment.distance),
      segments,
      totalDistance,
    }
  }

  /**
   * 分析单个多边形外环，自动闭合，忽略第三维高度。
   * @param {number[][]} coordinates 至少三个不共线的 WGS84 顶点
   * @param {object} [options] areaUnit 为面积单位，unit 为周长的距离单位
   * @returns {{area: number, unit: string, perimeter: number, perimeterUnit: string, center: number[], vertexCount: number, coordinates: number[][]}}
   */
  getArea(coordinates, options = {}) {
    const config = normalizeConfig({ ...this.config, ...normalizeOptions(options) })
    const closedCoordinates = normalizeAreaCoordinates(coordinates)
    const ring = unwrapRing(closedCoordinates)
    const feature = polygon([ring])
    if (!hasArea(ring) || kinks(feature).features.length) {
      throw new RangeError('Area analysis requires a non-degenerate polygon without self-intersections.')
    }
    const squareMeters = turfArea(feature)
    if (!Number.isFinite(squareMeters) || squareMeters <= 0) {
      throw new RangeError('Area analysis requires a polygon with a positive area.')
    }
    const [longitude, latitude] = centerOfMass(feature).geometry.coordinates
    return {
      area: squareMeters / AREA_FACTORS[config.areaUnit],
      unit: config.areaUnit,
      perimeter: this.getDistance(closedCoordinates, { unit: config.unit }).totalDistance,
      perimeterUnit: config.unit,
      center: [((longitude + 180) % 360 + 360) % 360 - 180, latitude],
      vertexCount: closedCoordinates.length - 1,
      coordinates: closedCoordinates,
    }
  }

  /**
   * 计算两个局部多边形外环的交集及球面面积；无面积交集时返回 0 与空几何。
   * @param {number[][]} firstCoordinates 第一组 WGS84 多边形顶点
   * @param {number[][]} secondCoordinates 第二组 WGS84 多边形顶点
   * @param {object} [options] areaUnit 为所有返回面积的单位
   * @returns {{area: number, unit: string, hasOverlap: boolean, firstArea: number, secondArea: number, firstRatio: number, secondRatio: number, center: number[]|null, geometry: object|null, parts: object[]}}
   */
  getOverlapArea(firstCoordinates, secondCoordinates, options = {}) {
    const config = normalizeConfig({ ...this.config, ...normalizeOptions(options) })
    const first = this.getArea(firstCoordinates, config)
    const second = this.getArea(secondCoordinates, config)
    const intersection = intersect(featureCollection([
      overlapPolygon(first.coordinates),
      overlapPolygon(second.coordinates),
    ]))
    const squareMeters = intersection ? turfArea(intersection) : 0
    if (!Number.isFinite(squareMeters)) {
      throw new RangeError('Overlap analysis could not calculate a finite area.')
    }
    const hasOverlap = squareMeters > 0
    const area = hasOverlap ? squareMeters / AREA_FACTORS[config.areaUnit] : 0
    const geometry = hasOverlap ? intersection.geometry : null
    const parts = geometry
      ? (geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates).map((rings) => {
        const feature = polygon(rings.map((ring) => ring.map((point) => [...point])))
        return {
          area: turfArea(feature) / AREA_FACTORS[config.areaUnit],
          center: polygonLabelCenter(feature),
          geometry: feature.geometry,
        }
      })
      : []
    const largestPart = parts.reduce((largest, part) => !largest || part.area > largest.area ? part : largest, null)
    return {
      area,
      unit: config.areaUnit,
      hasOverlap,
      firstArea: first.area,
      secondArea: second.area,
      firstRatio: hasOverlap ? Math.min(1, area / first.area) : 0,
      secondRatio: hasOverlap ? Math.min(1, area / second.area) : 0,
      center: largestPart ? [...largestPart.center] : null,
      geometry,
      parts,
    }
  }

  /**
   * 根据圆心和地表半径计算球面圆的面积、周长与直径，不包含地形起伏。
   * @param {number[]} center WGS84 圆心 [经度, 纬度]，忽略第三维高度
   * @param {number} radius 正数半径，单位由 unit 指定，默认为米
   * @param {object} [options] areaUnit 为面积单位，unit 为半径、直径及周长单位
   * @returns {{area: number, unit: string, perimeter: number, perimeterUnit: string, center: number[], radius: number, radiusUnit: string, diameter: number}}
   */
  getCircleArea(center, radius, options = {}) {
    const config = normalizeConfig({ ...this.config, ...normalizeOptions(options) })
    const point = normalizeCoordinate(center, 'center')
    if (!Number.isFinite(radius) || radius <= 0) {
      throw new RangeError('Circle area analysis requires a finite, positive radius.')
    }
    const angle = lengthToRadians(radius, UNIT_OPTIONS[config.unit].turfUnit)
    if (angle >= Math.PI) {
      throw new RangeError('Circle radius must be smaller than half the Earth circumference.')
    }
    // 解析球冠公式，避免将圆离散为多边形引入步数误差。
    // 使用 sin²(angle / 2) 代替 1 - cos(angle)，保留小半径的精度。
    const capRadius = earthRadius * Math.sin(angle / 2)
    const squareMeters = 4 * Math.PI * capRadius * capRadius
    if (!Number.isFinite(squareMeters) || squareMeters <= 0) {
      throw new RangeError('Circle radius is too small to calculate a positive area.')
    }
    return {
      area: squareMeters / AREA_FACTORS[config.areaUnit],
      unit: config.areaUnit,
      perimeter: 2 * Math.PI * radius * (Math.sin(angle) / angle),
      perimeterUnit: config.unit,
      center: point,
      radius,
      radiusUnit: config.unit,
      diameter: radius * 2,
    }
  }
}

export default SpatialAnalysis
