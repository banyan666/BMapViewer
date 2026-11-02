import * as Cesium from 'cesium'
import { normalizeOptions } from './analysisConfig.js'
import { lineFeature, pointCoordinate, pointRecords } from './spatial/geometry.js'
import { terrainConfig, context, routeSamples, finite, abortError } from './terrain/sampling.js'
import { terrainMesh, geometry, clipHeight, integrate } from './terrain/mesh.js'

/**
 * 基于真实 TerrainProvider 的异步地形分析；只返回数据，不创建图层或修改 Viewer。
 * @param {object|null} [viewer=null] Cesium Viewer，也可通过 config.terrainProvider 独立提供地形
 * @param {object} [config] unit、areaUnit、volumeUnit、sampleSpacing、cellSize 等采样配置
 */
export default class TerrainAnalysis {
  constructor(viewer = null, config = {}) {
    this.viewer = viewer
    this.config = terrainConfig(config)
    this._destroyed = false
    this._version = 0
    this._abort = new AbortController()
  }

  updateConfig(config = {}) {
    this._assertAlive()
    this.config = terrainConfig({ ...this.config, ...normalizeOptions(config) })
    return this
  }

  _assertAlive() {
    if (this._destroyed) throw new Error('TerrainAnalysis has been destroyed.')
  }

  /** 单点或批量高程；高度始终为米（椭球高），不受距离 unit 影响。 */
  async getElevation(input, options = {}) {
    const ctx = context(this, options)
    const single = (Array.isArray(input) && typeof input[0] === 'number') || (input?.geometry || input)?.type === 'Point'
    const records = pointRecords(single ? [input] : input)
    if (!records.length) throw new RangeError('At least one point is required.')
    const sampled = await ctx.sample(records.map((record) => record.geometry.coordinates))
    const samples = sampled.map((point, index) => ({ ...records[index], ...point, geometry: { type: 'Point', coordinates: [...point.center, point.height] } }))
    return { ...ctx.metadata(samples.length), samples, minHeight: Math.min(...samples.map((p) => p.height)), maxHeight: Math.max(...samples.map((p) => p.height)) }
  }

  /** 沿椭球测地线加密后采样，返回剖面、累计贴地距离及升降统计。 */
  async getProfile(input, options = {}) {
    const ctx = context(this, options)
    const route = routeSamples(lineFeature(input).geometry.coordinates, ctx)
    const sampled = await ctx.sample(route.points)
    let surfaceDistance = 0, ascent = 0, descent = 0
    const samples = sampled.map((point, index) => {
      const heightDifference = index ? point.height - sampled[index - 1].height : 0
      if (index) surfaceDistance += Math.hypot(route.distances[index] - route.distances[index - 1], heightDifference)
      ascent += Math.max(0, heightDifference); descent += Math.max(0, -heightDifference)
      return { ...point, index, segmentIndex: route.segments[index], distance: ctx.distance(route.distances[index]), surfaceDistance: ctx.distance(surfaceDistance) }
    })
    return {
      ...ctx.metadata(samples.length), unit: ctx.config.unit, sampleSpacing: ctx.config.sampleSpacing,
      samples, totalDistance: ctx.distance(surfaceDistance), horizontalDistance: ctx.distance(route.distances.at(-1)),
      ascent, descent, minHeight: Math.min(...sampled.map((p) => p.height)), maxHeight: Math.max(...sampled.map((p) => p.height)),
      geometry: { type: 'LineString', coordinates: sampled.map((p) => [...p.center, p.height]) },
    }
  }

  async getSurfaceDistance(input, options = {}) { return this.getProfile(input, options) }

  async _mesh(input, options) {
    const ctx = context(this, options)
    const mesh = await terrainMesh(input, ctx)
    const projectedArea = mesh.cells.reduce((sum, cell) => sum + cell.projectedArea, 0)
    const surfaceArea = mesh.cells.reduce((sum, cell) => sum + cell.surfaceArea, 0)
    const result = {
      ...ctx.metadata(mesh.vertices.length), unit: ctx.config.areaUnit, cellSize: ctx.config.cellSize,
      projectedArea: ctx.area(projectedArea), surfaceArea: ctx.area(surfaceArea), center: mesh.center,
      minHeight: Math.min(...mesh.vertices.map((point) => point.height)), maxHeight: Math.max(...mesh.vertices.map((point) => point.height)),
      cells: mesh.cells.map((cell) => ({ index: cell.index, center: cell.center, height: cell.height, slope: cell.slope, aspect: cell.aspect, projectedArea: ctx.area(cell.projectedArea), surfaceArea: ctx.area(cell.surfaceArea), geometry: geometry(cell.points) })),
    }
    return { ctx, mesh, result }
  }

  async getSurfaceArea(input, options = {}) { return (await this._mesh(input, options)).result }

  async getSlopeAspect(input, options = {}) {
    const { result } = await this._mesh(input, options)
    return { ...result, angleUnit: 'degrees', minSlope: Math.min(...result.cells.map((cell) => cell.slope)), maxSlope: Math.max(...result.cells.map((cell) => cell.slope)), averageSlope: result.cells.reduce((sum, cell) => sum + cell.slope * cell.projectedArea, 0) / result.projectedArea }
  }

  /** 地形通视：真实 ECEF 直线，包含地球曲率，不包含建筑或 3D Tiles。 */
  async getVisibility(first, second, options = {}) {
    const ctx = context(this, options)
    const ends = [pointCoordinate(first), pointCoordinate(second)]
    if (ends[0][0] === ends[1][0] && ends[0][1] === ends[1][1]) throw new RangeError('通视分析需要两个不同的点。')
    const initial = routeSamples(ends, ctx)
    const endpointHeights = await ctx.sample(ends)
    const observerHeight = finite(ctx.config.observerHeight ?? 2, 'observerHeight')
    const targetHeight = finite(ctx.config.targetHeight ?? 2, 'targetHeight')
    const tolerance = finite(ctx.config.tolerance ?? 0.5, 'tolerance')
    if (observerHeight < 0 || targetHeight < 0 || tolerance < 0) throw new RangeError('Observer/target heights and tolerance must not be negative.')
    const positions = ends.map((p, i) => Cesium.Cartesian3.fromDegrees(...p, endpointHeights[i].height + (i ? targetHeight : observerHeight)))
    const rays = initial.points.map((_, index) => Cesium.Cartographic.fromCartesian(Cesium.Cartesian3.lerp(...positions, index / (initial.points.length - 1), new Cesium.Cartesian3())))
    const sampled = await ctx.sample(rays.map((point) => [Cesium.Math.toDegrees(point.longitude), Cesium.Math.toDegrees(point.latitude)]))
    const samples = sampled.map((point, index) => ({ ...point, rayHeight: rays[index].height, clearance: rays[index].height - point.height, distance: ctx.distance(initial.distances[index]) }))
    const obstructionIndex = samples.findIndex((p, index) => index > 0 && index < samples.length - 1 && p.clearance < -tolerance)
    return {
      ...ctx.metadata(samples.length + 2), unit: ctx.config.unit, observerHeight, targetHeight, tolerance,
      isVisible: obstructionIndex < 0, obstruction: obstructionIndex < 0 ? null : { ...samples[obstructionIndex], index: obstructionIndex },
      minClearance: Math.min(...samples.map((p) => p.clearance)),
      distance: ctx.distance(Cesium.Cartesian3.distance(...positions)), samples,
      geometry: { type: 'LineString', coordinates: samples.map((p) => [...p.center, p.rayHeight]) },
    }
  }

  async getCutFill(input, baseHeight, options = {}) {
    finite(baseHeight, 'baseHeight')
    const { ctx, mesh, result } = await this._mesh(input, options)
    let cutVolume = 0, fillVolume = 0
    const parts = []
    for (const cell of mesh.cells) {
      for (const kind of ['cut', 'fill']) {
        const points = clipHeight(cell.points, baseHeight, kind === 'cut')
        const integral = integrate(points, baseHeight)
        if (integral.area <= 1e-8 || integral.volume <= 1e-8) continue
        if (kind === 'cut') cutVolume += integral.volume
        else fillVolume += integral.volume
        parts.push({ kind, area: ctx.area(integral.area), volume: ctx.volume(integral.volume), geometry: geometry(points) })
      }
    }
    return { ...result, baseHeight, volumeUnit: ctx.config.volumeUnit, cutVolume: ctx.volume(cutVolume), fillVolume: ctx.volume(fillVolume), netVolume: ctx.volume(cutVolume - fillVolume), parts }
  }

  async getFlood(input, waterHeight, options = {}) {
    finite(waterHeight, 'waterHeight')
    const prepared = await this.prepareFlood(input, options)
    return prepared.getFlood(waterHeight)
  }

  /** 一次采样后复用三角网，供动态水位同步计算；不创建水体或计时器。 */
  async prepareFlood(input, options = {}) {
    const { ctx, mesh, result } = await this._mesh(input, options)
    ctx.check()
    return Object.freeze({
      minHeight: result.minHeight, maxHeight: result.maxHeight,
      geometry: structuredClone(mesh.geometry),
      getFlood: (waterHeight) => {
        this._assertAlive()
        if (ctx.config.signal?.aborted) throw abortError()
        finite(waterHeight, 'waterHeight')
        let floodedArea = 0, volume = 0
        const floodedParts = []
        for (const cell of mesh.cells) {
          const points = clipHeight(cell.points, waterHeight, false)
          const integral = integrate(points, waterHeight)
          if (integral.area <= 1e-8 || integral.volume <= 1e-8) continue
          floodedArea += integral.area; volume += integral.volume
          floodedParts.push({ area: ctx.area(integral.area), volume: ctx.volume(integral.volume), geometry: geometry(points, waterHeight) })
        }
        // 不向外暴露内部网格；调用者修改返回数据不会影响后续水位计算。
        return { ...structuredClone(result), waterHeight, floodedArea: ctx.area(floodedArea), dryArea: Math.max(0, result.projectedArea - ctx.area(floodedArea)), floodedRatio: Math.min(1, ctx.area(floodedArea) / result.projectedArea), volume: ctx.volume(volume), volumeUnit: ctx.config.volumeUnit, floodedParts }
      },
    })
  }

  isDestroyed() { return this._destroyed }

  destroy() {
    this.viewer = null
    this._destroyed = true
    this._version += 1
    this._abort.abort()
  }
}
