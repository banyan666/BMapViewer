import * as Cesium from 'cesium'
import { LINE_LIGHTING_TRAIL_IMAGE, LineLightingTrailMaterialProperty, registerLineLightingTrailMaterial } from './material/lineLightingTrail.js'

const DEFAULTS = {
  color: '#ffcc33', opacity: 0.8, width: 20, speed: 5, height: 0,
  direction: 'forward', clampToGround: false, autoStart: true, image: LINE_LIGHTING_TRAIL_IMAGE,
}

function normalize(config) {
  const value = { ...DEFAULTS, ...config }
  for (const key of ['opacity', 'width', 'speed', 'height']) {
    if (!Number.isFinite(value[key])) throw new TypeError(`LineLightingTrailLayer ${key} must be a finite number.`)
  }
  if (value.width <= 0 || value.speed < 0) throw new RangeError('LineLightingTrailLayer width must be positive and speed must not be negative.')
  if (value.opacity < 0 || value.opacity > 1) throw new RangeError('LineLightingTrailLayer opacity must be from 0 to 1.')
  if (!['forward', 'reverse'].includes(value.direction)) throw new RangeError('LineLightingTrailLayer direction must be forward or reverse.')
  if (typeof value.clampToGround !== 'boolean' || typeof value.autoStart !== 'boolean') throw new TypeError('LineLightingTrailLayer clampToGround and autoStart must be boolean.')
  if (typeof value.image !== 'string' || !value.image.trim()) throw new TypeError('LineLightingTrailLayer image must be a non-empty image URL.')
  const color = value.color instanceof Cesium.Color ? Cesium.Color.clone(value.color)
    : typeof value.color === 'string' ? Cesium.Color.fromCssColorString(value.color) : null
  if (!color || ![color.red, color.green, color.blue, color.alpha].every(Number.isFinite)) throw new TypeError('LineLightingTrailLayer color must be a CSS color or Cesium.Color.')
  if (value.color instanceof Cesium.Color) value.color = Cesium.Color.clone(value.color)
  return value
}

function linesFromGeometry(geometry, height) {
  const type = geometry?.type || 'LineString'
  const lines = type === 'LineString' ? [geometry?.coordinates] : type === 'MultiLineString' ? geometry.coordinates : null
  if (!Array.isArray(lines) || !lines.length) throw new TypeError('LineLightingTrailLayer supports LineString and MultiLineString data.')
  return lines.map((line) => {
    if (!Array.isArray(line)) throw new TypeError('LineLightingTrailLayer coordinates must be line coordinate arrays.')
    const positions = []
    for (const point of line) {
      if (!Array.isArray(point) || !Number.isFinite(point[0]) || !Number.isFinite(point[1])
        || point[0] < -180 || point[0] > 180 || point[1] < -90 || point[1] > 90
        || (point[2] != null && !Number.isFinite(point[2]))) throw new TypeError('LineLightingTrailLayer coordinates must be [longitude, latitude, height?].')
      const position = Cesium.Cartesian3.fromDegrees(point[0], point[1], point[2] ?? height)
      if (!positions.length || !Cesium.Cartesian3.equals(positions.at(-1), position)) positions.push(position)
    }
    if (positions.length < 2) throw new RangeError('LineLightingTrailLayer needs at least two distinct positions per line.')
    return positions
  })
}

/** 使用 SDK LineString / MultiLineString 数据展示穿梭线。 */
export default class LineLightingTrailLayer {
  constructor(viewer, config = {}) {
    if (!viewer?.entities || !viewer?.scene || !viewer?.clock?.onTick || viewer.isDestroyed?.()) throw new Error('A usable Cesium Viewer is required.')
    this.config = normalize(config)
    registerLineLightingTrailMaterial()
    this.viewer = viewer
    this.data = []; this.entities = []
    this._records = new Map()
    this._visible = true; this._running = this.config.autoStart; this._destroyed = false
    this._elapsed = 0; this._startedAt = null; this._removeTick = null
  }
  _assertAlive() {
    if (this._destroyed || this.viewer?.isDestroyed?.()) throw new Error('LineLightingTrailLayer or Viewer has been destroyed.')
  }
  _requestRender() { if (this.viewer && !this.viewer.isDestroyed?.()) this.viewer.scene.requestRender() }
  _time() { return this._elapsed + (this._startedAt == null ? 0 : Math.max(0, performance.now() - this._startedAt) / 1000) }
  _isAnimating(record) { return this._running && this._visible && record.options.speed > 0 }

  _prepare(item, config = this.config) {
    if (!item?.geometry) throw new TypeError('LineLightingTrailLayer expects SDK { geometry, properties } data.')
    const properties = { ...item.properties, id: item.properties?.id ?? Cesium.createGuid() }
    if (typeof properties.id !== 'string' && !(typeof properties.id === 'number' && Number.isFinite(properties.id))) throw new TypeError('LineLightingTrailLayer id must be a string or finite number.')
    if (properties.color instanceof Cesium.Color) properties.color = Cesium.Color.clone(properties.color)
    const options = normalize({ ...config, ...properties })
    options.color = options.color instanceof Cesium.Color ? Cesium.Color.clone(options.color) : Cesium.Color.fromCssColorString(options.color)
    options.color.alpha *= options.opacity
    const lines = linesFromGeometry(item.geometry, options.height)
    return {
      feature: { geometry: { type: item.geometry.type || 'LineString', coordinates: structuredClone(item.geometry.coordinates) }, properties },
      options, lines, entities: [], material: null,
    }
  }
  _add(record) {
    record.material = new LineLightingTrailMaterialProperty(() => record.options, () => this._time(), () => this._isAnimating(record))
    record.entities = record.lines.map((positions) => this.viewer.entities.add({
      id: `bmap-viewer-line-lighting-trail:${Cesium.createGuid()}`,
      name: record.feature.properties.name || '穿梭线', show: this._visible,
      properties: new Cesium.PropertyBag(record.feature.properties),
      polyline: { positions, width: record.options.width, clampToGround: record.options.clampToGround, material: record.material },
    }))
    this._records.set(String(record.feature.properties.id), record)
    this.entities.push(...record.entities); this.data.push(record.feature)
    return record.entities.length === 1 ? record.entities[0] : [...record.entities]
  }
  setData(data = []) {
    this._assertAlive()
    if (!Array.isArray(data)) throw new TypeError('LineLightingTrailLayer data must be an array.')
    const records = data.map((item) => this._prepare(item))
    if (new Set(records.map((record) => String(record.feature.properties.id))).size !== records.length) throw new Error('LineLightingTrailLayer IDs must be unique.')
    this.clearLayer()
    records.forEach((record) => this._add(record))
    this._syncAnimation(); this._requestRender()
    return this
  }
  addLayer(item) {
    this._assertAlive()
    const record = this._prepare(item)
    if (this._records.has(String(record.feature.properties.id))) throw new Error('LineLightingTrailLayer IDs must be unique.')
    const entity = this._add(record)
    this._syncAnimation(); this._requestRender()
    return entity
  }
  setOptions(patch = {}) {
    this._assertAlive()
    const config = normalize({ ...this.config, ...patch })
    const updates = this.data.map((item) => this._prepare(item, config))
    this.config = config
    for (const next of updates) {
      const record = this._records.get(String(next.feature.properties.id))
      record.options = next.options; record.lines = next.lines
      record.entities.forEach((entity, index) => Object.assign(entity.polyline, {
        positions: next.lines[index], width: next.options.width, clampToGround: next.options.clampToGround,
      }))
    }
    if (patch.autoStart != null) this._running = patch.autoStart
    this._syncAnimation(); this._requestRender()
    return this
  }
  getOptions() { return { ...this.config, color: this.config.color instanceof Cesium.Color ? Cesium.Color.clone(this.config.color) : this.config.color } }
  getLayerById(id) { return this._records.get(String(id))?.entities[0] || null }
  getLayersById(id) { return [...(this._records.get(String(id))?.entities || [])] }
  getLayerDataById(id) { return this._records.get(String(id))?.feature || null }
  isDestroyed() { return this._destroyed }

  _syncAnimation() {
    this._removeTick?.(); this._removeTick = null
    const animated = !this._destroyed && [...this._records.values()].some((record) => this._isAnimating(record))
    if (animated && this._startedAt == null) this._startedAt = performance.now()
    if (!animated && this._startedAt != null) { this._elapsed = this._time(); this._startedAt = null }
    if (animated) this._removeTick = this.viewer.clock.onTick.addEventListener(() => {
      if (this.viewer?.isDestroyed?.()) this.destroy()
      else this._requestRender()
    })
    for (const record of this._records.values()) record.material.definitionChanged.raiseEvent(record.material)
  }
  start() {
    this._assertAlive(); this._running = true
    this._syncAnimation(); this._requestRender()
    return this
  }
  stop() {
    this._running = false
    this._syncAnimation(); this._requestRender()
    return this
  }
  resetTime() {
    this._assertAlive(); this._elapsed = 0
    if (this._startedAt != null) this._startedAt = performance.now()
    this._syncAnimation(); this._requestRender()
    return this
  }
  show() {
    this._assertAlive(); this._visible = true
    this.entities.forEach((entity) => { entity.show = true })
    this._syncAnimation(); this._requestRender()
    return this
  }
  hide() {
    this._visible = false
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
    this._records.delete(String(id)); this._syncAnimation()
    if (!this.entities.length) { this._elapsed = 0; this._startedAt = null }
    this._requestRender()
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
