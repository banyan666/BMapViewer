import * as Cesium from 'cesium'
import { createDiffuseWallGeometry, createDiffuseWallMaterial } from './material/diffuseWall.js'

const DEFAULTS = {
  color: '#ff4455', opacity: 0.8, radius: 300, minRadius: 10,
  height: 300, minHeight: 30, heightChange: false, baseHeight: 0,
  duration: 3000, speed: 1, slices: 128, autoStart: true,
}

function normalize(config) {
  const value = { ...DEFAULTS, ...config }
  for (const key of ['radius', 'minRadius', 'height', 'minHeight', 'baseHeight', 'duration', 'speed', 'opacity', 'slices']) {
    if (!Number.isFinite(value[key])) throw new TypeError(`DiffuseWallLayer ${key} must be a finite number.`)
  }
  if (value.minRadius <= 0 || value.radius <= value.minRadius) throw new RangeError('DiffuseWallLayer radius must exceed minRadius, which must be positive.')
  if (value.height <= 0 || value.minHeight <= 0 || (value.heightChange && value.minHeight > value.height)) throw new RangeError('DiffuseWallLayer heights must be positive; minHeight must not exceed height when heightChange is enabled.')
  if (value.duration <= 0 || value.speed < 0) throw new RangeError('DiffuseWallLayer duration must be positive and speed must not be negative.')
  if (value.opacity < 0 || value.opacity > 1) throw new RangeError('DiffuseWallLayer opacity must be from 0 to 1.')
  if (!Number.isInteger(value.slices) || value.slices < 3 || value.slices > 4096) throw new RangeError('DiffuseWallLayer slices must be an integer from 3 to 4096.')
  if (typeof value.heightChange !== 'boolean' || typeof value.autoStart !== 'boolean') throw new TypeError('DiffuseWallLayer heightChange and autoStart must be boolean.')
  const color = value.color instanceof Cesium.Color ? Cesium.Color.clone(value.color)
    : typeof value.color === 'string' ? Cesium.Color.fromCssColorString(value.color) : null
  if (!color || ![color.red, color.green, color.blue, color.alpha].every(Number.isFinite)) throw new TypeError('DiffuseWallLayer color must be a CSS color or Cesium.Color.')
  if (value.color instanceof Cesium.Color) value.color = Cesium.Color.clone(value.color)
  return value
}

/** 以 SDK Point 数据定义中心点的环形扩散墙。 */
export default class DiffuseWallLayer {
  constructor(viewer, config = {}) {
    if (!viewer?.scene?.primitives || !viewer?.clock?.onTick || viewer.isDestroyed?.()) throw new Error('A usable Cesium Viewer is required.')
    this.config = normalize(config)
    this.viewer = viewer
    this.data = []
    this.resources = []
    this._records = new Map()
    this._visible = true
    this._running = this.config.autoStart
    this._destroyed = false
    this._elapsed = 0
    this._startedAt = null
    this._removeTick = null
  }

  _assertAlive() {
    if (this._destroyed || this.viewer?.isDestroyed?.()) throw new Error('DiffuseWallLayer or Viewer has been destroyed.')
  }
  _requestRender() { if (this.viewer && !this.viewer.isDestroyed?.()) this.viewer.scene.requestRender() }
  _time() { return this._elapsed + (this._startedAt == null ? 0 : Math.max(0, performance.now() - this._startedAt) / 1000) }

  _prepare(item, config = this.config) {
    const geometry = item?.geometry
    if (!geometry || (geometry.type != null && geometry.type !== 'Point')) throw new TypeError('DiffuseWallLayer expects SDK Point geometry.')
    const point = geometry.coordinates
    if (!Array.isArray(point) || !Number.isFinite(point[0]) || !Number.isFinite(point[1])
      || point[0] < -180 || point[0] > 180 || point[1] < -90 || point[1] > 90
      || (point[2] != null && !Number.isFinite(point[2]))) throw new TypeError('DiffuseWallLayer coordinates must be [longitude, latitude, height?].')
    const properties = { ...item.properties, id: item.properties?.id ?? Cesium.createGuid() }
    if (typeof properties.id !== 'string' && !(typeof properties.id === 'number' && Number.isFinite(properties.id))) throw new TypeError('DiffuseWallLayer id must be a string or finite number.')
    if (properties.color instanceof Cesium.Color) properties.color = Cesium.Color.clone(properties.color)
    const options = normalize({ ...config, baseHeight: point[2] ?? config.baseHeight, ...properties })
    const center = [point[0], point[1], options.baseHeight]
    const color = options.color instanceof Cesium.Color ? Cesium.Color.clone(options.color) : Cesium.Color.fromCssColorString(options.color)
    color.alpha *= options.opacity
    return {
      feature: { geometry: { type: 'Point', coordinates: point.slice(0, 3) }, properties },
      options, center, color,
      enu: Cesium.Transforms.eastNorthUpToFixedFrame(Cesium.Cartesian3.fromDegrees(...center)),
      scale: new Cesium.Cartesian3(), primitive: null,
    }
  }

  _create(record) {
    const material = createDiffuseWallMaterial(record.color)
    const primitive = new Cesium.Primitive({
      geometryInstances: new Cesium.GeometryInstance({
        id: { ...record.feature.properties },
        geometry: createDiffuseWallGeometry(record.options.slices),
      }),
      appearance: new Cesium.MaterialAppearance({ material, flat: true, translucent: true, closed: false }),
      asynchronous: false, allowPicking: true, show: this._visible,
      modelMatrix: new Cesium.Matrix4(),
    })
    record.primitive = this.viewer.scene.primitives.add(primitive)
    this._updateRecord(record, this._time())
    return record.primitive
  }

  _state(record, time) {
    const options = record.options
    const phase = (time * 1000 * options.speed / options.duration) % 1
    return {
      id: record.feature.properties.id, center: [...record.center], phase,
      radius: options.minRadius + (options.radius - options.minRadius) * phase,
      height: options.heightChange ? options.height + (options.minHeight - options.height) * phase : options.height,
    }
  }

  _updateRecord(record, time) {
    const state = this._state(record, time)
    record.scale.x = record.scale.y = state.radius
    record.scale.z = state.height
    Cesium.Matrix4.multiplyByScale(record.enu, record.scale, record.primitive.modelMatrix)
  }
  _update() {
    const time = this._time()
    for (const record of this._records.values()) this._updateRecord(record, time)
    this._requestRender()
  }

  setData(data = []) {
    this._assertAlive()
    if (!Array.isArray(data)) throw new TypeError('DiffuseWallLayer data must be an array.')
    const records = data.map((item) => this._prepare(item))
    if (new Set(records.map((record) => String(record.feature.properties.id))).size !== records.length) throw new Error('DiffuseWallLayer IDs must be unique.')
    this.clearLayer()
    records.forEach((record) => this._add(record))
    this._syncAnimation(); this._requestRender()
    return this
  }

  _add(record) {
    const primitive = this._create(record)
    this._records.set(String(record.feature.properties.id), record)
    this.resources.push(primitive)
    this.data.push(record.feature)
    if (this._startedAt == null && this._running && this._visible) this._startedAt = performance.now()
    return primitive
  }

  addLayer(item) {
    this._assertAlive()
    const record = this._prepare(item)
    if (this._records.has(String(record.feature.properties.id))) throw new Error('DiffuseWallLayer IDs must be unique.')
    const primitive = this._add(record)
    this._syncAnimation(); this._requestRender()
    return primitive
  }

  setOptions(patch = {}) {
    this._assertAlive()
    const config = normalize({ ...this.config, ...patch })
    const updates = this.data.map((item) => this._prepare(item, config))
    this.config = config
    for (const next of updates) {
      const record = this._records.get(String(next.feature.properties.id))
      if (record.options.slices !== next.options.slices) {
        this._create(next)
        const index = this.resources.indexOf(record.primitive)
        this._disposePrimitive(record.primitive)
        this.resources[index] = next.primitive
        this._records.set(String(next.feature.properties.id), next)
      } else {
        record.options = next.options; record.enu = next.enu; record.center = next.center; record.color = next.color
        record.primitive.appearance.material.uniforms.color = Cesium.Color.clone(next.color)
      }
    }
    if (patch.autoStart != null) { if (patch.autoStart) this.start(); else this.stop() }
    else { this._syncAnimation(); this._update() }
    return this
  }

  getOptions() { return { ...this.config, color: this.config.color instanceof Cesium.Color ? Cesium.Color.clone(this.config.color) : this.config.color } }
  getLayerById(id) { return this._records.get(String(id))?.primitive || null }
  getLayersById(id) { const primitive = this.getLayerById(id); return primitive ? [primitive] : [] }
  getLayerDataById(id) { return this._records.get(String(id))?.feature || null }
  getState(id) { const record = this._records.get(String(id)); return record ? this._state(record, this._time()) : null }
  isDestroyed() { return this._destroyed }

  _syncAnimation() {
    this._removeTick?.(); this._removeTick = null
    if (this._destroyed || !this._running || !this._visible || ![...this._records.values()].some((record) => record.options.speed > 0)) return
    this._removeTick = this.viewer.clock.onTick.addEventListener(() => {
      if (this.viewer?.isDestroyed?.()) this.destroy()
      else this._update()
    })
  }
  start() {
    this._assertAlive()
    this._running = true
    if (this._visible && this.resources.length && this._startedAt == null) this._startedAt = performance.now()
    this._syncAnimation(); this._update()
    return this
  }
  stop() {
    this._elapsed = this._time(); this._startedAt = null; this._running = false
    this._syncAnimation(); this._update()
    return this
  }
  resetTime() {
    this._assertAlive()
    this._elapsed = 0
    this._startedAt = this._running && this._visible && this.resources.length ? performance.now() : null
    this._update()
    return this
  }
  show() {
    this._assertAlive()
    this._visible = true
    this.resources.forEach((primitive) => { primitive.show = true })
    if (this._running && this.resources.length && this._startedAt == null) this._startedAt = performance.now()
    this._syncAnimation(); this._update()
    return this
  }
  hide() {
    this._elapsed = this._time(); this._startedAt = null; this._visible = false
    this.resources.forEach((primitive) => { primitive.show = false })
    this._syncAnimation(); this._update()
    return this
  }

  _disposePrimitive(primitive) {
    const material = primitive.appearance.material
    if (this.viewer && !this.viewer.isDestroyed?.() && !this.viewer.scene.primitives.isDestroyed?.()) this.viewer.scene.primitives.remove(primitive)
    if (!primitive.isDestroyed()) primitive.destroy()
    if (!material.isDestroyed()) material.destroy()
  }
  removeLayerById(id) {
    this._assertAlive()
    const record = this._records.get(String(id))
    if (!record) return 0
    this._disposePrimitive(record.primitive)
    this.resources = this.resources.filter((primitive) => primitive !== record.primitive)
    this.data = this.data.filter((item) => String(item.properties.id) !== String(id))
    this._records.delete(String(id))
    if (!this.resources.length) { this._elapsed = 0; this._startedAt = null }
    this._syncAnimation(); this._requestRender()
    return 1
  }
  removeLayer(primitive) {
    const record = [...this._records.values()].find((item) => item.primitive === primitive)
    return record ? this.removeLayerById(record.feature.properties.id) > 0 : false
  }
  clearLayer() {
    this._removeTick?.(); this._removeTick = null
    this.resources.forEach((primitive) => this._disposePrimitive(primitive))
    this.resources = []; this.data = []; this._records.clear()
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
