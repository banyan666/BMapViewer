import * as Cesium from 'cesium'
import { CircleBlurMaterialProperty, registerCircleBlurMaterial } from './material/circleBlur.js'

const DEFAULTS = {
  color: '#ff4d4f', opacity: 1, radius: 1500, height: 0,
  breathing: false, speed: 3, blur: 10, brightness: 3, autoStart: true,
}

function normalize(config) {
  const value = { ...DEFAULTS, ...config }
  for (const key of ['opacity', 'radius', 'height', 'speed', 'blur', 'brightness']) {
    if (!Number.isFinite(value[key])) throw new TypeError(`CircleBlurLayer ${key} must be a finite number.`)
  }
  if (value.radius <= 0 || value.blur <= 0 || value.speed < 0 || value.brightness < 0) throw new RangeError('CircleBlurLayer radius and blur must be positive; speed and brightness must not be negative.')
  if (value.opacity < 0 || value.opacity > 1) throw new RangeError('CircleBlurLayer opacity must be from 0 to 1.')
  if (typeof value.breathing !== 'boolean' || typeof value.autoStart !== 'boolean') throw new TypeError('CircleBlurLayer breathing and autoStart must be boolean.')
  const color = value.color instanceof Cesium.Color ? Cesium.Color.clone(value.color)
    : typeof value.color === 'string' ? Cesium.Color.fromCssColorString(value.color) : null
  if (!color || ![color.red, color.green, color.blue, color.alpha].every(Number.isFinite)) throw new TypeError('CircleBlurLayer color must be a CSS color or Cesium.Color.')
  if (value.color instanceof Cesium.Color) value.color = Cesium.Color.clone(value.color)
  return value
}

/** 使用 SDK Point 数据管理模糊圆。 */
export default class CircleBlurLayer {
  constructor(viewer, config = {}) {
    if (!viewer?.entities || !viewer?.scene || !viewer?.clock?.onTick || viewer.isDestroyed?.()) throw new Error('A usable Cesium Viewer is required.')
    this.config = normalize(config)
    registerCircleBlurMaterial()
    this.viewer = viewer
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
    if (this._destroyed || this.viewer?.isDestroyed?.()) throw new Error('CircleBlurLayer or Viewer has been destroyed.')
  }
  _requestRender() { if (this.viewer && !this.viewer.isDestroyed?.()) this.viewer.scene.requestRender() }
  _time() { return this._elapsed + (this._startedAt == null ? 0 : Math.max(0, performance.now() - this._startedAt) / 1000) }
  _isAnimating(record) { return this._running && this._visible && record.options.breathing && record.options.speed > 0 }

  _prepare(item, config = this.config) {
    const geometry = item?.geometry, point = geometry?.coordinates
    if (!geometry || (geometry.type != null && geometry.type !== 'Point')) throw new TypeError('CircleBlurLayer expects SDK Point geometry.')
    if (!Array.isArray(point) || !Number.isFinite(point[0]) || !Number.isFinite(point[1])
      || point[0] < -180 || point[0] > 180 || point[1] < -90 || point[1] > 90
      || (point[2] != null && !Number.isFinite(point[2]))) throw new TypeError('CircleBlurLayer coordinates must be [longitude, latitude, height?].')
    const properties = { ...item.properties, id: item.properties?.id ?? Cesium.createGuid() }
    if (typeof properties.id !== 'string' && !(typeof properties.id === 'number' && Number.isFinite(properties.id))) throw new TypeError('CircleBlurLayer id must be a string or finite number.')
    if (properties.color instanceof Cesium.Color) properties.color = Cesium.Color.clone(properties.color)
    const options = normalize({ ...config, height: point[2] ?? config.height, ...properties })
    options.color = options.color instanceof Cesium.Color ? Cesium.Color.clone(options.color) : Cesium.Color.fromCssColorString(options.color)
    options.color.alpha *= options.opacity
    return {
      feature: { geometry: { type: 'Point', coordinates: point.slice(0, 3) }, properties },
      center: [point[0], point[1], options.height], options, entity: null, material: null,
    }
  }

  _add(record) {
    record.material = new CircleBlurMaterialProperty(() => record.options, () => this._time(), () => this._isAnimating(record))
    record.entity = this.viewer.entities.add({
      id: `bmap-viewer-circle-blur:${Cesium.createGuid()}`,
      name: record.feature.properties.name || '模糊圆', show: this._visible,
      position: Cesium.Cartesian3.fromDegrees(...record.center),
      properties: new Cesium.PropertyBag(record.feature.properties),
      ellipse: {
        semiMajorAxis: record.options.radius, semiMinorAxis: record.options.radius,
        height: record.options.height, material: record.material, outline: false,
      },
    })
    this._records.set(String(record.feature.properties.id), record)
    this.entities.push(record.entity)
    this.data.push(record.feature)
    return record.entity
  }

  setData(data = []) {
    this._assertAlive()
    if (!Array.isArray(data)) throw new TypeError('CircleBlurLayer data must be an array.')
    const records = data.map((item) => this._prepare(item))
    if (new Set(records.map((record) => String(record.feature.properties.id))).size !== records.length) throw new Error('CircleBlurLayer IDs must be unique.')
    this.clearLayer()
    records.forEach((record) => this._add(record))
    this._syncAnimation(); this._requestRender()
    return this
  }
  addLayer(item) {
    this._assertAlive()
    const record = this._prepare(item)
    if (this._records.has(String(record.feature.properties.id))) throw new Error('CircleBlurLayer IDs must be unique.')
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
      record.options = next.options; record.center = next.center
      record.entity.position = Cesium.Cartesian3.fromDegrees(...next.center)
      record.entity.ellipse.semiMajorAxis = record.entity.ellipse.semiMinorAxis = next.options.radius
      record.entity.ellipse.height = next.options.height
    }
    if (patch.autoStart != null) this._running = patch.autoStart
    this._syncAnimation(); this._requestRender()
    return this
  }

  getOptions() { return { ...this.config, color: this.config.color instanceof Cesium.Color ? Cesium.Color.clone(this.config.color) : this.config.color } }
  getLayerById(id) { return this._records.get(String(id))?.entity || null }
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
    this._assertAlive()
    this._elapsed = 0
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
    this.viewer.entities.remove(record.entity)
    this.entities = this.entities.filter((entity) => entity !== record.entity)
    this.data = this.data.filter((item) => String(item.properties.id) !== String(id))
    this._records.delete(String(id))
    this._syncAnimation()
    if (!this.entities.length) { this._elapsed = 0; this._startedAt = null }
    this._requestRender()
    return 1
  }
  removeLayer(entity) {
    const record = [...this._records.values()].find((item) => item.entity === entity)
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
