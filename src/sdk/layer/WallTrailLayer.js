import * as Cesium from 'cesium'
import { registerWallTrailMaterial, WallTrailMaterialProperty, WALL_TRAIL_IMAGE } from './material/wallTrail.js'

const DEFAULTS = {
  color: '#33cc66', opacity: 0.7, height: 250, baseHeight: 0,
  speed: 3, direction: 'up', repeat: 1, brightness: 3,
  image: WALL_TRAIL_IMAGE, closed: false, autoStart: true,
}

function options(config) {
  const value = { ...DEFAULTS, ...config }
  for (const key of ['opacity', 'height', 'baseHeight', 'speed', 'repeat', 'brightness']) {
    if (!Number.isFinite(value[key])) throw new TypeError(`WallTrailLayer ${key} must be a finite number.`)
  }
  if (value.height <= 0 || value.speed < 0 || value.brightness < 0) throw new RangeError('WallTrailLayer height must be positive; speed and brightness must not be negative.')
  if (!Number.isInteger(value.repeat) || value.repeat < 1) throw new RangeError('WallTrailLayer repeat must be a positive integer.')
  if (value.opacity < 0 || value.opacity > 1) throw new RangeError('WallTrailLayer opacity must be from 0 to 1.')
  if (typeof value.image !== 'string' || !value.image.trim()) throw new TypeError('WallTrailLayer image must be a non-empty image URL.')
  if (!['up', 'down'].includes(value.direction)) throw new RangeError('WallTrailLayer direction must be up or down.')
  if (typeof value.closed !== 'boolean' || typeof value.autoStart !== 'boolean') throw new TypeError('WallTrailLayer closed and autoStart must be boolean.')
  const color = value.color instanceof Cesium.Color ? Cesium.Color.clone(value.color)
    : typeof value.color === 'string' ? Cesium.Color.fromCssColorString(value.color) : null
  if (!color || ![color.red, color.green, color.blue, color.alpha].every(Number.isFinite)) throw new TypeError('WallTrailLayer color must be a CSS color or Cesium.Color.')
  value.color = color
  return value
}

function coordinateSets(geometry) {
  const { type, coordinates } = geometry || {}
  if (!Array.isArray(coordinates) || !coordinates.length) throw new TypeError('WallTrailLayer geometry coordinates are required.')
  let sets
  if (type === 'LineString') sets = [coordinates]
  else if (type === 'MultiLineString' || type === 'Polygon') sets = coordinates
  else if (type === 'MultiPolygon') {
    if (coordinates.some((polygon) => !Array.isArray(polygon) || !polygon.length)) throw new TypeError('WallTrailLayer polygon rings are required.')
    sets = coordinates.flat()
  } else throw new TypeError('WallTrailLayer supports LineString, MultiLineString, Polygon and MultiPolygon.')
  return { sets, polygon: type === 'Polygon' || type === 'MultiPolygon' }
}

function normalizeLine(line, closed, config) {
  if (!Array.isArray(line)) throw new TypeError('WallTrailLayer line must be a coordinate array.')
  const points = []
  for (const point of line) {
    if (!Array.isArray(point) || !Number.isFinite(point[0]) || !Number.isFinite(point[1])
      || point[0] < -180 || point[0] > 180 || point[1] < -90 || point[1] > 90
      || (point[2] != null && !Number.isFinite(point[2]))) throw new TypeError('WallTrailLayer coordinates must be finite [longitude, latitude, height?] values.')
    if (point[2] != null && point[2] <= config.baseHeight) throw new RangeError('WallTrailLayer vertex top height must exceed baseHeight.')
    const previous = points.at(-1)
    if (!previous || previous[0] !== point[0] || previous[1] !== point[1]) points.push(point.slice(0, 3))
  }
  const unique = new Set(points.map((p) => `${p[0]},${p[1]}`)).size
  if (unique < (closed ? 3 : 2)) throw new RangeError('WallTrailLayer needs at least two distinct points, or three for a closed ring.')
  if (closed) {
    const first = points[0], last = points.at(-1)
    if (first[0] !== last[0] || first[1] !== last[1]) points.push([...first])
    else points[points.length - 1] = [...first]
  }
  return points
}

/** 流动墙体图层；遵循 SDK geometry/properties 数据格式，不创建任何线框。 */
export default class WallTrailLayer {
  constructor(viewer, config = {}) {
    if (!viewer?.entities || !viewer?.scene || !viewer?.clock?.onTick || viewer.isDestroyed?.()) throw new Error('A usable Cesium Viewer is required.')
    options(config)
    registerWallTrailMaterial()
    this.viewer = viewer
    this.config = { ...DEFAULTS, ...config }
    if (config.color instanceof Cesium.Color) this.config.color = Cesium.Color.clone(config.color)
    this.data = []
    this.entities = []
    this._records = new Map()
    this._visible = true
    this._running = this.config.autoStart
    this._destroyed = false
    this._elapsed = 0
    this._startedAt = null
    this._removeTick = null
  }

  _assertAlive() {
    if (this._destroyed || this.viewer?.isDestroyed?.()) throw new Error('WallTrailLayer or Viewer has been destroyed.')
  }
  _requestRender() { if (this.viewer && !this.viewer.isDestroyed?.()) this.viewer.scene.requestRender() }
  _time() { return this._elapsed + (this._startedAt == null ? 0 : Math.max(0, performance.now() - this._startedAt) / 1000) }

  _prepare(item, config = this.config) {
    if (!item?.geometry) throw new TypeError('WallTrailLayer expects SDK { geometry, properties } data.')
    const properties = { ...item.properties, id: item.properties?.id ?? Cesium.createGuid() }
    if (typeof properties.id !== 'string' && !(typeof properties.id === 'number' && Number.isFinite(properties.id))) throw new TypeError('WallTrailLayer id must be a string or finite number.')
    if (properties.color instanceof Cesium.Color) properties.color = Cesium.Color.clone(properties.color)
    const resolved = options({ ...config, ...properties })
    resolved.color.alpha *= resolved.opacity
    const { sets, polygon } = coordinateSets(item.geometry)
    const lines = sets.map((line) => normalizeLine(line, polygon || resolved.closed, resolved))
    const feature = { geometry: { type: item.geometry.type, coordinates: structuredClone(item.geometry.coordinates) }, properties }
    return { feature, options: resolved, lines, entities: [] }
  }

  setData(data = []) {
    this._assertAlive()
    if (!Array.isArray(data)) throw new TypeError('WallTrailLayer data must be an array.')
    const records = data.map((item) => this._prepare(item))
    if (new Set(records.map((record) => String(record.feature.properties.id))).size !== records.length) throw new Error('WallTrailLayer IDs must be unique.')
    this.clearLayer()
    records.forEach((record) => this._add(record))
    this._syncAnimation()
    this._requestRender()
    return this
  }

  _add(record) {
    const properties = record.feature.properties
    const material = new WallTrailMaterialProperty(() => record.options, () => this._time())
    record.entities = record.lines.map((line) => this.viewer.entities.add({
      id: `bmap-viewer-wall-trail:${Cesium.createGuid()}`,
      name: properties.name || '流动墙体', show: this._visible,
      properties: new Cesium.PropertyBag(properties),
      wall: { ...this._wallGeometry(line, record.options), material, outline: false },
    }))
    this._records.set(String(properties.id), record)
    this.entities.push(...record.entities)
    this.data.push(record.feature)
    if (this._startedAt == null && this._running && this._visible) this._startedAt = performance.now()
    return record.entities.length === 1 ? record.entities[0] : [...record.entities]
  }

  _wallGeometry(line, config) {
    return {
      positions: Cesium.Cartesian3.fromDegreesArray(line.flatMap((point) => point.slice(0, 2))),
      minimumHeights: line.map(() => config.baseHeight),
      maximumHeights: line.map((point) => point[2] ?? config.baseHeight + config.height),
    }
  }

  addLayer(item) {
    this._assertAlive()
    const record = this._prepare(item)
    if (this._records.has(String(record.feature.properties.id))) throw new Error('WallTrailLayer IDs must be unique.')
    const result = this._add(record)
    this._syncAnimation(); this._requestRender()
    return result
  }

  setOptions(patch = {}) {
    this._assertAlive()
    const config = { ...this.config, ...patch }
    if (config.color instanceof Cesium.Color) config.color = Cesium.Color.clone(config.color)
    options(config)
    const updates = this.data.map((item) => this._prepare(item, config))
    this.config = config
    for (const update of updates) {
      const record = this._records.get(String(update.feature.properties.id))
      // 同样的几何类型和数据更新现有 Entity，避免替换材质造成闪烁。
      record.options = update.options
      record.lines = update.lines
      record.entities.forEach((entity, index) => Object.assign(entity.wall, this._wallGeometry(record.lines[index], record.options)))
    }
    if (patch.autoStart != null) { if (patch.autoStart) this.start(); else this.stop() }
    else this._syncAnimation()
    this._requestRender()
    return this
  }

  getOptions() { return { ...this.config, color: this.config.color instanceof Cesium.Color ? Cesium.Color.clone(this.config.color) : this.config.color } }
  getLayerById(id) { return this._records.get(String(id))?.entities[0] || null }
  getLayersById(id) { return [...(this._records.get(String(id))?.entities || [])] }
  getLayerDataById(id) { return this._records.get(String(id))?.feature || null }
  isDestroyed() { return this._destroyed }

  _syncAnimation() {
    this._removeTick?.(); this._removeTick = null
    if (this._destroyed || !this._running || !this._visible || ![...this._records.values()].some((record) => record.options.speed > 0)) return
    this._removeTick = this.viewer.clock.onTick.addEventListener(() => {
      if (this.viewer?.isDestroyed?.()) this.destroy()
      else this._requestRender()
    })
  }

  start() {
    this._assertAlive()
    this._running = true
    if (this._visible && this.entities.length && this._startedAt == null) this._startedAt = performance.now()
    this._syncAnimation(); this._requestRender()
    return this
  }
  stop() {
    this._elapsed = this._time(); this._startedAt = null; this._running = false
    this._syncAnimation(); this._requestRender()
    return this
  }
  resetTime() {
    this._assertAlive()
    this._elapsed = 0
    this._startedAt = this._running && this._visible && this.entities.length ? performance.now() : null
    this._requestRender()
    return this
  }
  show() {
    this._assertAlive()
    this._visible = true
    this.entities.forEach((entity) => { entity.show = true })
    if (this._running && this.entities.length && this._startedAt == null) this._startedAt = performance.now()
    this._syncAnimation(); this._requestRender()
    return this
  }
  hide() {
    this._elapsed = this._time(); this._startedAt = null; this._visible = false
    this.entities.forEach((entity) => { entity.show = false })
    this._syncAnimation(); this._requestRender()
    return this
  }

  removeLayerById(id) {
    this._assertAlive()
    const record = this._records.get(String(id))
    if (!record) return 0
    record.entities.forEach((entity) => this.viewer.entities.remove(entity))
    this.entities = this.entities.filter((entity) => !record.entities.includes(entity))
    this.data = this.data.filter((item) => String(item.properties.id) !== String(id))
    this._records.delete(String(id))
    if (!this.entities.length) { this._elapsed = 0; this._startedAt = null }
    this._syncAnimation(); this._requestRender()
    return record.entities.length
  }
  removeLayer(entity) {
    const record = [...this._records.values()].find((item) => item.entities.includes(entity))
    return record ? this.removeLayerById(record.feature.properties.id) > 0 : false
  }
  clearLayer() {
    this._removeTick?.(); this._removeTick = null
    if (this.viewer && !this.viewer.isDestroyed?.()) this.entities.forEach((entity) => this.viewer.entities.remove(entity))
    this.entities = []; this.data = []; this._records.clear()
    this._elapsed = 0; this._startedAt = null
    this._requestRender()
    return this
  }
  destroy() {
    if (this._destroyed) return
    this.clearLayer()
    this._running = false; this._destroyed = true; this.viewer = null
  }
}
