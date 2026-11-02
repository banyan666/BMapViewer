import * as Cesium from 'cesium'
import { polygonFeature } from '../utils/spatial/geometry.js'

const DEFAULTS = {
  startHeight: 0, targetHeight: 100, waterHeight: null, baseHeight: null,
  speed: 10, direction: 'up', color: '#409dfd', opacity: 0.6,
  autoStart: false, callbackInterval: 200, onChange: null, onComplete: null,
}

function color(value, opacity) {
  const parsed = value instanceof Cesium.Color ? Cesium.Color.clone(value) : typeof value === 'string' ? Cesium.Color.fromCssColorString(value) : null
  if (!parsed || ![parsed.red, parsed.green, parsed.blue, parsed.alpha].every(Number.isFinite)) throw new TypeError('FloodLayer color must be a CSS color or Cesium.Color.')
  parsed.alpha *= opacity
  return parsed
}

function normalize(config) {
  const value = { ...DEFAULTS, ...config }
  value.waterHeight ??= value.startHeight
  for (const key of ['startHeight', 'targetHeight', 'waterHeight', 'speed', 'opacity', 'callbackInterval']) {
    if (!Number.isFinite(value[key])) throw new TypeError(`FloodLayer ${key} must be a finite number.`)
  }
  if (value.speed <= 0 || value.callbackInterval < 0) throw new RangeError('FloodLayer speed must be positive and callbackInterval must not be negative.')
  if (value.opacity < 0 || value.opacity > 1) throw new RangeError('FloodLayer opacity must be from 0 to 1.')
  if (!['up', 'down'].includes(value.direction)) throw new RangeError('FloodLayer direction must be up or down.')
  if (value.baseHeight != null && (!Number.isFinite(value.baseHeight) || value.baseHeight > Math.min(value.startHeight, value.targetHeight, value.waterHeight))) {
    throw new RangeError('FloodLayer baseHeight must not exceed any configured water level.')
  }
  for (const key of ['onChange', 'onComplete']) if (value[key] != null && typeof value[key] !== 'function') throw new TypeError(`FloodLayer ${key} must be a function.`)
  color(value.color, value.opacity)
  if (value.color instanceof Cesium.Color) value.color = Cesium.Color.clone(value.color)
  return value
}

/**
 * 动态等水位水体。SDK Polygon / MultiPolygon 数据控制水平范围，
 * 高程统一由 waterHeight 控制（WGS84 椭球高，米），不使用顶点第三维。
 * 需开启 viewer.scene.globe.depthTestAgainstTerrain，让真实地形遮挡水下部分。
 */
export default class FloodLayer {
  constructor(viewer, config = {}) {
    if (!viewer || viewer.isDestroyed?.()) throw new Error('Viewer is required.')
    this.config = normalize(config)
    this.viewer = viewer
    this.data = []
    this.entities = []
    this._records = new Map()
    this._visible = true
    this._destroyed = false
    this._removeTick = null
    this._status = 'idle'
    this._generation = 0
    this._waterHeight = this.config.waterHeight
  }

  _assertAlive() {
    if (this._destroyed || this.viewer?.isDestroyed?.()) throw new Error('FloodLayer or Viewer has been destroyed.')
  }

  _requestRender() { if (!this.viewer?.isDestroyed?.()) this.viewer?.scene?.requestRender() }
  _baseHeight() { return this.config.baseHeight ?? Math.min(0, this.config.startHeight, this.config.targetHeight, this._waterHeight) }
  _refresh() {
    for (const entity of this.entities) entity.show = this._visible && this._waterHeight > this._baseHeight()
    this._requestRender()
  }

  _feature(item) {
    if (!item?.geometry) throw new TypeError('FloodLayer expects SDK { geometry, properties } data.')
    const geometry = polygonFeature(item).geometry
    const properties = { ...item.properties, id: item.properties?.id ?? Cesium.createGuid() }
    const opacity = properties.opacity ?? this.config.opacity
    if (!Number.isFinite(opacity) || opacity < 0 || opacity > 1) throw new RangeError('FloodLayer feature opacity must be from 0 to 1.')
    color(properties.color ?? this.config.color, opacity)
    return { geometry, properties }
  }

  setData(data = []) {
    this._assertAlive()
    if (!Array.isArray(data)) throw new TypeError('FloodLayer data must be an array.')
    const features = data.map((item) => this._feature(item))
    if (new Set(features.map((item) => String(item.properties.id))).size !== features.length) throw new Error('FloodLayer feature IDs must be unique.')
    this.clearLayer()
    for (const feature of features) this._add(feature)
    if (this.config.autoStart && this.entities.length) this.start()
    return this
  }

  _add(feature) {
    const { properties, geometry } = feature
    const polygons = geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
    const positions = (ring) => ring.slice(0, -1).map(([lon, lat]) => Cesium.Cartesian3.fromDegrees(lon, lat))
    const created = polygons.map((rings) => this.viewer.entities.add({
      id: `bmap-viewer-flood-${Cesium.createGuid()}`,
      name: properties.name || '动态淹没水体',
      properties: new Cesium.PropertyBag(properties),
      polygon: {
        hierarchy: new Cesium.PolygonHierarchy(positions(rings[0]), rings.slice(1).map((ring) => new Cesium.PolygonHierarchy(positions(ring)))),
        height: new Cesium.CallbackProperty(() => this._baseHeight(), false),
        extrudedHeight: new Cesium.CallbackProperty(() => this._waterHeight, false),
        perPositionHeight: false, closeTop: true, closeBottom: false,
        material: color(properties.color ?? this.config.color, properties.opacity ?? this.config.opacity),
        outline: false,
      },
    }))
    this.data.push(feature)
    this.entities.push(...created)
    this._records.set(String(properties.id), created)
    this._refresh()
    return created.length === 1 ? created[0] : created
  }

  addLayer(item) {
    this._assertAlive()
    const feature = this._feature(item)
    if (this._records.has(String(feature.properties.id))) throw new Error('FloodLayer feature IDs must be unique.')
    return this._add(feature)
  }

  setOptions(options = {}) {
    this._assertAlive()
    const config = normalize({ ...this.config, waterHeight: this._waterHeight, ...options,
      ...(options.startHeight !== undefined && options.waterHeight === undefined ? { waterHeight: options.startHeight } : {}),
    })
    this.pause()
    this.config = config
    this._waterHeight = config.waterHeight
    for (const feature of this.data) {
      const props = feature.properties
      for (const entity of this._records.get(String(props.id))) entity.polygon.material = color(props.color ?? config.color, props.opacity ?? config.opacity)
    }
    this._status = 'idle'
    this._refresh()
    return this
  }

  getOptions() { return { ...this.config, waterHeight: this._waterHeight, color: this.config.color instanceof Cesium.Color ? Cesium.Color.clone(this.config.color) : this.config.color } }
  getWaterHeight() { return this._waterHeight }
  getState() { return { status: this._status, waterHeight: this._waterHeight, startHeight: this.config.startHeight, targetHeight: this.config.targetHeight, speed: this.config.speed, direction: this.config.direction } }

  _notify(name) {
    try { this.config[name]?.(this._waterHeight, this.getState()) }
    catch (error) { this.pause(); console.error(`FloodLayer ${name} callback failed:`, error) }
  }

  start() {
    this._assertAlive()
    if (this._status === 'running' || !this.entities.length || (this._status === 'completed' && this._waterHeight === this.config.targetHeight)) return this
    const delta = this.config.targetHeight - this._waterHeight
    if ((this.config.direction === 'up' && delta < 0) || (this.config.direction === 'down' && delta > 0)) throw new RangeError('FloodLayer targetHeight does not match direction and current waterHeight.')
    if (!this._visible) return this
    if (!this.viewer.clock?.onTick) throw new Error('FloodLayer needs viewer.clock.onTick.')
    this._generation += 1
    this._status = 'running'
    this._lastTime = performance.now()
    this._lastCallback = this._lastTime
    this._removeTick = this.viewer.clock.onTick.addEventListener(() => this._tick())
    this._notify('onChange')
    if (delta === 0 && this._status === 'running') this._tick()
    this._requestRender()
    return this
  }

  _tick() {
    if (this._status !== 'running') return
    if (this.viewer.isDestroyed?.()) { this.destroy(); return }
    const now = performance.now()
    const step = Math.max(0, now - this._lastTime) / 1000 * this.config.speed
    this._lastTime = now
    const up = this.config.direction === 'up'
    this._waterHeight = up ? Math.min(this.config.targetHeight, this._waterHeight + step) : Math.max(this.config.targetHeight, this._waterHeight - step)
    const completed = this._waterHeight === this.config.targetHeight
    if (completed) { this._removeTick?.(); this._removeTick = null; this._status = 'completed' }
    this._refresh()
    const generation = this._generation
    if (completed || now - this._lastCallback >= this.config.callbackInterval) {
      this._lastCallback = now
      this._notify('onChange')
    }
    if (completed && !this._destroyed && generation === this._generation) this._notify('onComplete')
  }

  pause() {
    this._removeTick?.()
    this._removeTick = null
    this._generation += 1
    if (this._status === 'running') this._status = 'paused'
    return this
  }

  setWaterHeight(height) {
    this._assertAlive()
    normalize({ ...this.config, waterHeight: height })
    this.pause()
    this._waterHeight = height
    this._status = 'paused'
    this._refresh()
    this._notify('onChange')
    return this
  }

  reset() {
    this._assertAlive()
    this.pause()
    this._waterHeight = this.config.startHeight
    this._status = 'idle'
    this._refresh()
    this._notify('onChange')
    return this
  }
  show() { this._assertAlive(); this._visible = true; this._refresh(); return this }
  hide() { this.pause(); this._visible = false; this._refresh(); return this }
  getLayerById(id) { return this._records.get(String(id))?.[0] || null }
  getLayersById(id) { return [...(this._records.get(String(id)) || [])] }

  removeLayerById(id) {
    const records = this.getLayersById(id)
    if (!this.viewer?.isDestroyed?.()) records.forEach((entity) => this.viewer.entities.remove(entity))
    this.entities = this.entities.filter((entity) => !records.includes(entity))
    this.data = this.data.filter((item) => String(item.properties.id) !== String(id))
    this._records.delete(String(id))
    if (!this.entities.length) this.pause()
    this._requestRender()
    return records.length
  }

  removeLayer(entity) {
    const record = [...this._records].find(([, entities]) => entities.includes(entity))
    return record ? this.removeLayerById(record[0]) > 0 : false
  }

  clearLayer() {
    this.pause()
    if (!this.viewer?.isDestroyed?.()) this.entities.forEach((entity) => this.viewer?.entities.remove(entity))
    this.entities = []; this.data = []; this._records.clear()
    this._waterHeight = this.config.waterHeight
    this._status = 'idle'
    this._requestRender()
    return this
  }

  isDestroyed() { return this._destroyed }
  destroy() {
    if (this._destroyed) return
    this.clearLayer()
    this._destroyed = true; this._status = 'destroyed'; this.viewer = null
    this.config.onChange = this.config.onComplete = null
  }
}
