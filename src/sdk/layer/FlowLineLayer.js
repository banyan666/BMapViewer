import * as Cesium from 'cesium'
import { uuid } from '../utils/utils.js'
import { FLOW_LINE_MATERIAL_TYPE, registerFlowLineMaterial } from './material/flowLine.js'

const defaults = Object.freeze({
  type: 'flow',
  color: '#b5ff33',
  width: 3,
  opacity: 0.8,
  speed: 5,
  percent: 0.15,
  gradient: 0.4,
  pulse: 0.5,
  backgroundAlpha: 0.8,
  brightness: 1,
  glowStrength: 1.5,
  glowColor: '#00e7ff',
  height: 0,
  autoStart: true,
  allowPicking: true,
})

function numberOrDefault(value, fallback, minimum = -Infinity, maximum = Infinity) {
  const number = Number(value)
  return Number.isFinite(number) ? Math.min(maximum, Math.max(minimum, number)) : fallback
}

function resolveOptions(config, properties = {}) {
  const options = { ...config, ...properties }
  const color = options.color instanceof Cesium.Color
    ? Cesium.Color.clone(options.color)
    : Cesium.Color.fromCssColorString(String(options.color))
  if (!color) throw new TypeError(`FlowLineLayer color is invalid: ${options.color}`)
  color.alpha *= numberOrDefault(options.opacity, defaults.opacity, 0, 1)
  const glowColor = options.glowColor instanceof Cesium.Color
    ? Cesium.Color.clone(options.glowColor)
    : Cesium.Color.fromCssColorString(String(options.glowColor))
  if (!glowColor) throw new TypeError(`FlowLineLayer glowColor is invalid: ${options.glowColor}`)

  return {
    type: options.type === 'enhanced' ? 'enhanced' : 'flow',
    color,
    width: numberOrDefault(options.width, defaults.width, 1),
    speed: numberOrDefault(options.speed, defaults.speed),
    percent: numberOrDefault(options.percent, defaults.percent, 0.001, 1),
    gradient: numberOrDefault(options.gradient, defaults.gradient, 0.001, 1),
    pulse: numberOrDefault(options.pulse, defaults.pulse, 0),
    backgroundAlpha: numberOrDefault(options.backgroundAlpha, defaults.backgroundAlpha, 0, 1),
    brightness: numberOrDefault(options.brightness, defaults.brightness, 0, 10),
    glowStrength: numberOrDefault(options.glowStrength, defaults.glowStrength, 0, 10),
    glowColor,
    height: numberOrDefault(options.height, defaults.height),
    allowPicking: options.allowPicking !== false,
  }
}

/**
 * 基于 PolylineGeometry 和自定义材质的流动线图层。
 * 数据使用 SDK 的 geometry / properties 格式，支持 LineString 和 MultiLineString。
 */
export default class FlowLineLayer {
  constructor(viewer, config = {}) {
    if (!viewer?.scene?.primitives) throw new Error('Viewer is required.')
    registerFlowLineMaterial()

    this.viewer = viewer
    this.config = { ...defaults, ...config }
    this.data = []
    this.resources = []
    this._visible = true
    this._running = this.config.autoStart !== false
    this._elapsed = 0
    this._startedAt = this._running ? performance.now() : null
    this._removePreRender = null
    this._renderTimer = null
    this._preRenderListener = this._update.bind(this)
  }

  setData(data = []) {
    if (!Array.isArray(data)) {
      console.error('FlowLineLayer data must be an array.')
      return this
    }
    this.clearLayer()
    data.forEach((feature) => this.addLayer(feature))
    return this
  }

  addLayer(feature) {
    if (!this._viewerAvailable()) return null
    const options = resolveOptions(this.config, feature?.properties)
    const resource = this._createResource(feature, feature?.properties?.id ?? uuid(), options)
    if (!resource) return null
    this.resources.push(resource)
    this.data.push(feature)
    this._syncAnimation()
    this.viewer.scene.requestRender()
    return resource.primitive
  }

  setOptions(options = {}) {
    if (!this._viewerAvailable()) return this
    const nextConfig = { ...this.config, ...options }
    const updates = this.resources.map((resource) => ({
      resource,
      options: resolveOptions(nextConfig, resource.feature.properties),
    }))
    this.config = nextConfig
    updates.forEach(({ resource, options: nextOptions }, index) => {
      if (resource.options.width !== nextOptions.width
        || resource.options.height !== nextOptions.height
        || resource.options.allowPicking !== nextOptions.allowPicking) {
        const replacement = this._createResource(resource.feature, resource.id, nextOptions)
        if (!replacement) return
        this.viewer.scene.primitives.remove(resource.primitive)
        this.resources[index] = replacement
      } else {
        resource.options = nextOptions
        this._applyUniforms(resource)
      }
    })
    this._syncAnimation()
    this.viewer.scene.requestRender()
    return this
  }

  getLayerById(id) {
    return this.resources.find((resource) => resource.id === id)?.primitive || null
  }

  getLayerDataById(id) {
    return this.resources.find((resource) => resource.id === id)?.feature || null
  }

  removeLayer(primitive) {
    const resource = this.resources.find((item) => item.primitive === primitive)
    if (!resource) return false
    this._removeResource(resource)
    this._syncAnimation()
    this.viewer?.scene?.requestRender()
    return true
  }

  removeLayerById(id) {
    const resources = this.resources.filter((resource) => resource.id === id)
    resources.forEach((resource) => this._removeResource(resource))
    this._syncAnimation()
    this.viewer?.scene?.requestRender()
    return resources.length
  }

  start() {
    if (!this._viewerAvailable()) return this
    if (!this._running) {
      this._running = true
      this._startedAt = performance.now()
    }
    this._syncAnimation()
    this.viewer.scene.requestRender()
    return this
  }

  stop() {
    this._elapsed = this._getTime()
    this._startedAt = null
    this._running = false
    this._update()
    this._syncAnimation()
    this.viewer?.scene?.requestRender()
    return this
  }

  show() {
    this._visible = true
    this.resources.forEach((resource) => { resource.primitive.show = true })
    this._syncAnimation()
    this.viewer?.scene?.requestRender()
    return this
  }

  hide() {
    this._visible = false
    this.resources.forEach((resource) => { resource.primitive.show = false })
    this._syncAnimation()
    this.viewer?.scene?.requestRender()
    return this
  }

  clearLayer() {
    this.resources.slice().forEach((resource) => this._removeResource(resource))
    this.data = []
    this._syncAnimation()
    this.viewer?.scene?.requestRender()
    return this
  }

  destroy() {
    this.clearLayer()
    this._running = false
    this.viewer = null
  }

  _createResource(feature, id, options) {
    const geometry = feature?.geometry
    const lines = geometry?.type === 'LineString' ? [geometry.coordinates]
      : geometry?.type === 'MultiLineString' ? geometry.coordinates : []
    if (!Array.isArray(lines)) return null
    const instances = lines.map((line, index) => {
      const positions = this._getPositions(line, options.height)
      if (positions.length < 2) return null
      return new Cesium.GeometryInstance({
        id: lines.length === 1 ? id : `${id}-${index + 1}`,
        geometry: new Cesium.PolylineGeometry({
          positions,
          width: options.width,
          vertexFormat: Cesium.PolylineMaterialAppearance.VERTEX_FORMAT,
        }),
      })
    }).filter(Boolean)
    if (!instances.length) return null

    const material = Cesium.Material.fromType(FLOW_LINE_MATERIAL_TYPE)
    const primitive = new Cesium.Primitive({
      geometryInstances: instances,
      appearance: new Cesium.PolylineMaterialAppearance({ material, translucent: true }),
      asynchronous: false,
      allowPicking: options.allowPicking,
      show: this._visible,
    })
    primitive._bmapLayerId = id
    primitive.properties = { ...feature.properties }
    const resource = { id, feature, options, material, primitive }
    this._applyUniforms(resource)
    this.viewer.scene.primitives.add(primitive)
    return resource
  }

  _getPositions(coordinates, defaultHeight) {
    if (!Array.isArray(coordinates)) return []
    const positions = []
    for (const coordinate of coordinates) {
      if (!Array.isArray(coordinate) || coordinate.length < 2) return []
      const longitude = Number(coordinate[0])
      const latitude = Number(coordinate[1])
      const height = coordinate[2] == null ? defaultHeight : Number(coordinate[2])
      if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180
        || !Number.isFinite(latitude) || latitude < -90 || latitude > 90
        || !Number.isFinite(height)) return []
      const position = Cesium.Cartesian3.fromDegrees(longitude, latitude, height)
      if (!positions.length || !Cesium.Cartesian3.equals(position, positions[positions.length - 1])) {
        positions.push(position)
      }
    }
    return positions
  }

  _applyUniforms(resource) {
    const { options, material } = resource
    Object.assign(material.uniforms, {
      color: options.color,
      time: this._getTime(),
      speed: options.speed,
      percent: options.percent,
      gradient: options.gradient,
      pulse: options.pulse,
      enhanced: options.type === 'enhanced' ? 1 : 0,
      backgroundAlpha: options.backgroundAlpha,
      brightness: options.brightness,
      glowStrength: options.glowStrength,
      glowColor: options.glowColor,
    })
  }

  _getTime() {
    return this._elapsed + (this._startedAt == null ? 0 : (performance.now() - this._startedAt) * 0.001)
  }

  _update() {
    const time = this._getTime()
    this.resources.forEach((resource) => { resource.material.uniforms.time = time })
  }

  _syncAnimation() {
    this._removePreRender?.()
    this._removePreRender = null
    if (this._renderTimer != null) clearInterval(this._renderTimer)
    this._renderTimer = null
    if (!this._viewerAvailable() || !this._running || !this._visible
      || !this.resources.some((resource) => resource.options.speed !== 0)) return

    this._removePreRender = this.viewer.scene.preRender.addEventListener(this._preRenderListener)
    if (this.viewer.scene.requestRenderMode) {
      this._renderTimer = setInterval(() => {
        if (this._viewerAvailable()) this.viewer.scene.requestRender()
      }, 33)
    }
  }

  _removeResource(resource) {
    if (this._viewerAvailable() && this.viewer.scene.primitives.contains(resource.primitive)) {
      this.viewer.scene.primitives.remove(resource.primitive)
    }
    this.resources = this.resources.filter((item) => item !== resource)
    this.data = this.resources.map((item) => item.feature)
  }

  _viewerAvailable() {
    return Boolean(this.viewer && !this.viewer.isDestroyed?.())
  }
}
