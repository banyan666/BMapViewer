import * as Cesium from 'cesium'
import { bakeWaterFlow, normalizeCenterline, normalizeWaterPolygons, waterBounds } from './water-flow/geometry.js'
import { normalizeWaterOptions, waterColor, WATER_FLOW_COLORS, WATER_FLOW_UNIFORMS } from './water-flow/options.js'
import { WATER_FLOW_VERTEX_SHADER, WATER_FLOW_FRAGMENT_SHADER, WATER_FLOW_MATERIAL_SOURCE } from './material/waterFlow.js'

function textureCanvas(data, size) {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const context = canvas.getContext('2d')
  if (!context) throw new Error('WaterFlowLayer requires Canvas 2D support.')
  const pixels = context.createImageData(size, size)
  pixels.data.set(data); context.putImageData(pixels, 0, 0)
  return canvas
}

function surfaceGeometry(rings, height, bounds) {
  const hierarchy = (ring) => Cesium.Cartesian3.fromDegreesArray(ring.slice(0, -1).flatMap((p) => p.slice(0, 2)))
  const geometry = Cesium.PolygonGeometry.createGeometry(new Cesium.PolygonGeometry({
    polygonHierarchy: new Cesium.PolygonHierarchy(hierarchy(rings[0]), rings.slice(1).map((ring) => new Cesium.PolygonHierarchy(hierarchy(ring)))),
    height, vertexFormat: Cesium.VertexFormat.POSITION_NORMAL_AND_ST,
    granularity: Cesium.Math.toRadians(0.01),
  }))
  if (!geometry) throw new Error('WaterFlowLayer could not triangulate the water polygon.')
  const values = geometry.attributes.position.values, uv = new Float32Array(values.length / 3 * 2)
  const cartesian = new Cesium.Cartesian3(), cartographic = new Cesium.Cartographic()
  for (let i = 0; i < values.length; i += 3) {
    Cesium.Cartesian3.fromArray(values, i, cartesian)
    Cesium.Cartographic.fromCartesian(cartesian, Cesium.Ellipsoid.WGS84, cartographic)
    uv[i / 3 * 2] = (Cesium.Math.toDegrees(cartographic.longitude) - bounds.west) / (bounds.east - bounds.west)
    uv[i / 3 * 2 + 1] = (Cesium.Math.toDegrees(cartographic.latitude) - bounds.south) / (bounds.north - bounds.south)
  }
  geometry.attributes.st.values = uv
  return geometry
}

/** 由 SDK Polygon / MultiPolygon 和可选中心线定义的流场水面。 */
export default class WaterFlowLayer {
  constructor(viewer, config = {}) {
    if (!viewer?.scene?.primitives || !viewer?.clock?.onTick || viewer.isDestroyed?.()) throw new Error('A usable Cesium Viewer is required.')
    this.config = normalizeWaterOptions(config)
    this.viewer = viewer
    this.data = []; this.resources = []
    this._records = new Map()
    this._visible = true; this._running = this.config.autoStart; this._destroyed = false
    this._elapsed = 0; this._startedAt = null; this._removeTick = null
  }
  _assertAlive() {
    if (this._destroyed || this.viewer?.isDestroyed?.()) throw new Error('WaterFlowLayer or Viewer has been destroyed.')
  }
  _requestRender() { if (this.viewer && !this.viewer.isDestroyed?.()) this.viewer.scene.requestRender() }
  _time() { return this._elapsed + (this._startedAt == null ? 0 : Math.max(0, performance.now() - this._startedAt) / 1000) }

  _prepare(item, config = this.config) {
    if (!item?.geometry) throw new TypeError('WaterFlowLayer expects SDK { geometry, properties } data.')
    const properties = { ...item.properties, id: item.properties?.id ?? Cesium.createGuid() }
    if (typeof properties.id !== 'string' && !(typeof properties.id === 'number' && Number.isFinite(properties.id))) throw new TypeError('WaterFlowLayer id must be a string or finite number.')
    for (const key of WATER_FLOW_COLORS) if (properties[key] instanceof Cesium.Color) properties[key] = Cesium.Color.clone(properties[key])
    if (properties.centerline != null) properties.centerline = structuredClone(properties.centerline)
    const options = normalizeWaterOptions({ ...config, ...properties })
    const polygons = normalizeWaterPolygons(item.geometry), centerlines = normalizeCenterline(options.centerline)
    polygons.forEach(waterBounds)
    return {
      feature: { geometry: { type: item.geometry.type, coordinates: structuredClone(item.geometry.coordinates) }, properties },
      options, polygons, centerlines, resources: [],
      signature: JSON.stringify([polygons, centerlines, options.height, options.textureSize, options.flowDirection]),
    }
  }
  _createRecord(record) {
    try {
      for (const rings of record.polygons) {
        const baked = bakeWaterFlow(rings, record.centerlines, record.options.textureSize, record.options.flowDirection)
        const flowCanvas = textureCanvas(baked.flow, baked.size), shoreCanvas = textureCanvas(baked.shore, baked.size)
        const geometry = surfaceGeometry(rings, record.options.height, baked.bounds)
        const uniforms = { u_time: this._time(), u_uvScale: new Cesium.Cartesian2(), u_flowTexture: Cesium.Material.DefaultImageId, u_shoreTexture: Cesium.Material.DefaultImageId }
        for (const key of WATER_FLOW_UNIFORMS) uniforms[`u_${key}`] = record.options[key]
        for (const key of WATER_FLOW_COLORS) uniforms[`u_${key}`] = waterColor(record.options[key])
        const material = new Cesium.Material({ fabric: { type: 'BMapViewerWaterFlow', uniforms, source: WATER_FLOW_MATERIAL_SOURCE }, translucent: () => true })
        material.uniforms.u_flowTexture = flowCanvas; material.uniforms.u_shoreTexture = shoreCanvas
        const primitive = new Cesium.Primitive({
          geometryInstances: new Cesium.GeometryInstance({ id: { ...record.feature.properties }, geometry }),
          appearance: new Cesium.Appearance({
            material, translucent: true, closed: false,
            renderState: { depthTest: { enabled: true }, cull: { enabled: false }, blending: Cesium.BlendingState.ALPHA_BLEND },
            vertexShaderSource: WATER_FLOW_VERTEX_SHADER, fragmentShaderSource: WATER_FLOW_FRAGMENT_SHADER,
          }),
          asynchronous: false, show: false,
        })
        primitive._bmapLayerId = record.feature.properties.id
        primitive.properties = { ...record.feature.properties }
        this.viewer.scene.primitives.add(primitive)
        const resource = { primitive, material, bounds: baked.bounds, sphere: Cesium.BoundingSphere.clone(geometry.boundingSphere), flowCanvas, shoreCanvas }
        record.resources.push(resource)
        this._applyUniforms(record, resource)
      }
    } catch (error) { record.resources.forEach((resource) => this._dispose(resource)); record.resources = []; throw error }
  }
  _applyUniforms(record, resource) {
    const uniforms = resource.material.uniforms
    uniforms.u_time = this._time()
    for (const key of WATER_FLOW_UNIFORMS) uniforms[`u_${key}`] = record.options[key]
    for (const key of WATER_FLOW_COLORS) Cesium.Color.clone(waterColor(record.options[key]), uniforms[`u_${key}`])
    uniforms.u_uvScale.x = resource.bounds.widthMeters / record.options.wavelength
    uniforms.u_uvScale.y = resource.bounds.heightMeters / record.options.wavelength
    resource.primitive.show = this._visible
  }
  setData(data = []) {
    this._assertAlive()
    if (!Array.isArray(data)) throw new TypeError('WaterFlowLayer data must be an array.')
    const records = data.map((item) => this._prepare(item))
    if (new Set(records.map((record) => String(record.feature.properties.id))).size !== records.length) throw new Error('WaterFlowLayer IDs must be unique.')
    try { records.forEach((record) => this._createRecord(record)) }
    catch (error) { records.forEach((record) => record.resources.forEach((resource) => this._dispose(resource))); throw error }
    this.clearLayer()
    records.forEach((record) => this._commit(record))
    this._syncAnimation(); this._requestRender()
    return this
  }
  _commit(record) {
    this._records.set(String(record.feature.properties.id), record)
    this.data.push(record.feature); this.resources.push(...record.resources)
    return record.resources.length === 1 ? record.resources[0].primitive : record.resources.map((resource) => resource.primitive)
  }
  addLayer(item) {
    this._assertAlive()
    const record = this._prepare(item)
    if (this._records.has(String(record.feature.properties.id))) throw new Error('WaterFlowLayer IDs must be unique.')
    this._createRecord(record)
    const result = this._commit(record)
    this._syncAnimation(); this._requestRender()
    return result
  }
  setOptions(patch = {}) {
    this._assertAlive()
    const config = normalizeWaterOptions({ ...this.config, ...patch })
    const updates = this.data.map((item) => this._prepare(item, config))
    const rebuilt = []
    try {
      for (const next of updates) if (next.signature !== this._records.get(String(next.feature.properties.id)).signature) {
        this._createRecord(next); rebuilt.push(next)
      }
    } catch (error) { rebuilt.forEach((record) => record.resources.forEach((resource) => this._dispose(resource))); throw error }
    this.config = config
    for (const next of updates) {
      const id = String(next.feature.properties.id), previous = this._records.get(id)
      if (next.resources.length) {
        previous.resources.forEach((resource) => this._dispose(resource))
        this._records.set(id, next)
      } else previous.options = next.options
    }
    this.resources = [...this._records.values()].flatMap((record) => record.resources)
    if (patch.autoStart != null) this._running = patch.autoStart
    this._syncAnimation(); this._requestRender()
    return this
  }
  getOptions() {
    const result = { ...this.config, centerline: this.config.centerline == null ? null : structuredClone(this.config.centerline) }
    for (const key of WATER_FLOW_COLORS) if (result[key] instanceof Cesium.Color) result[key] = Cesium.Color.clone(result[key])
    return result
  }
  getLayerById(id) { return this._records.get(String(id))?.resources[0]?.primitive || null }
  getLayersById(id) { return (this._records.get(String(id))?.resources || []).map((resource) => resource.primitive) }
  getLayerDataById(id) { return this._records.get(String(id))?.feature || null }
  isDestroyed() { return this._destroyed }
  flyTo(id, duration = 1.2) {
    this._assertAlive()
    const resources = id == null ? this.resources : this._records.get(String(id))?.resources || []
    if (!resources.length) return this
    const sphere = Cesium.BoundingSphere.fromBoundingSpheres(resources.map((resource) => resource.sphere))
    this.viewer.camera.flyToBoundingSphere(sphere, { duration, offset: new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-45), Math.max(100, sphere.radius * 3)) })
    return this
  }
  _syncAnimation() {
    this._removeTick?.(); this._removeTick = null
    const animated = !this._destroyed && this._visible && this._running && [...this._records.values()].some((record) => record.options.speed > 0)
    if (animated && this._startedAt == null) this._startedAt = performance.now()
    if (!animated && this._startedAt != null) { this._elapsed = this._time(); this._startedAt = null }
    if (animated) this._removeTick = this.viewer.clock.onTick.addEventListener(() => {
      if (this.viewer?.isDestroyed?.()) this.destroy()
      else {
        const time = this._time()
        this.resources.forEach((resource) => { resource.material.uniforms.u_time = time })
        this._requestRender()
      }
    })
    for (const record of this._records.values()) record.resources.forEach((resource) => this._applyUniforms(record, resource))
  }
  start() { this._assertAlive(); this._running = true; this._syncAnimation(); this._requestRender(); return this }
  stop() { this._running = false; this._syncAnimation(); this._requestRender(); return this }
  resetTime() {
    this._assertAlive(); this._elapsed = 0
    if (this._startedAt != null) this._startedAt = performance.now()
    this._syncAnimation(); this._requestRender(); return this
  }
  show() { this._assertAlive(); this._visible = true; this._syncAnimation(); this._requestRender(); return this }
  hide() { this._visible = false; this._syncAnimation(); this.resources.forEach((resource) => { resource.primitive.show = false }); this._requestRender(); return this }
  _dispose(resource) {
    if (this.viewer && !this.viewer.isDestroyed?.() && !this.viewer.scene.primitives.isDestroyed?.()) this.viewer.scene.primitives.remove(resource.primitive)
    if (!resource.primitive.isDestroyed()) resource.primitive.destroy()
    if (!resource.material.isDestroyed()) resource.material.destroy()
    resource.flowCanvas.width = resource.flowCanvas.height = resource.shoreCanvas.width = resource.shoreCanvas.height = 0
  }
  removeLayerById(id) {
    this._assertAlive()
    const record = this._records.get(String(id))
    if (!record) return 0
    record.resources.forEach((resource) => this._dispose(resource))
    this.resources = this.resources.filter((resource) => !record.resources.includes(resource))
    this.data = this.data.filter((item) => String(item.properties.id) !== String(id))
    this._records.delete(String(id)); this._syncAnimation()
    if (!this.resources.length) { this._elapsed = 0; this._startedAt = null }
    this._requestRender(); return record.resources.length
  }
  removeLayer(primitive) {
    const record = [...this._records.values()].find((item) => item.resources.some((resource) => resource.primitive === primitive))
    return record ? this.removeLayerById(record.feature.properties.id) > 0 : false
  }
  clearLayer() {
    this._removeTick?.(); this._removeTick = null
    this.resources.forEach((resource) => this._dispose(resource))
    this.resources = []; this.data = []; this._records.clear()
    this._elapsed = 0; this._startedAt = null; this._requestRender(); return this
  }
  destroy() {
    if (this._destroyed) return
    this.clearLayer(); this._running = false; this._destroyed = true; this.viewer = null
  }
}
