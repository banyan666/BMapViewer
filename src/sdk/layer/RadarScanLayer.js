import * as Cesium from 'cesium'
import { uuid } from '../utils/utils.js'

// Based on the depth reconstruction and rotating scan line in AddRadarScanPostStage.
const radarScanShader = /* glsl */ `
uniform sampler2D colorTexture;
uniform sampler2D depthTexture;
uniform vec4 u_scanCenterEC;
uniform vec3 u_scanPlaneNormalEC;
uniform vec3 u_scanLineNormalEC;
uniform float u_radius;
uniform vec4 u_scanColor;
uniform float u_showOuterRing;
uniform float u_direction;
in vec2 v_textureCoordinates;

void main() {
  vec4 sceneColor = texture(colorTexture, v_textureCoordinates);
  out_FragColor = sceneColor;

  float depthOrLogDepth = texture(depthTexture, v_textureCoordinates).r;
  if (depthOrLogDepth >= 0.999999) return;

  vec4 eyePosition = czm_windowToEyeCoordinates(gl_FragCoord.xy, depthOrLogDepth);
  eyePosition /= eyePosition.w;
  vec3 fromCenter = eyePosition.xyz - u_scanCenterEC.xyz;
  vec3 onPlane = fromCenter - u_scanPlaneNormalEC * dot(fromCenter, u_scanPlaneNormalEC);
  float distanceFromCenter = length(onPlane);
  if (distanceFromCenter >= u_radius) return;

  float radius = max(u_radius, 0.001);
  float edge = pow(distanceFromCenter / radius, 64.0) * u_showOuterRing;
  vec3 lineEnd = u_scanLineNormalEC * radius;
  float sweep = 0.0;

  // The illuminated half-plane trails the current scan direction.
  if (dot(cross(onPlane, u_scanLineNormalEC), u_scanPlaneNormalEC) * u_direction < 0.0) {
    float distanceToEnd = length(onPlane - lineEnd);
    sweep = pow(clamp((2.0 * radius - distanceToEnd) / (2.0 * radius), 0.0, 1.0), 3.0);
  }

  float strength = clamp((edge + sweep) * u_scanColor.a, 0.0, 1.0);
  out_FragColor = vec4(mix(sceneColor.rgb, u_scanColor.rgb, strength), sceneColor.a);
}
`

const defaults = Object.freeze({
  radius: 1000,
  color: '#00f5dc',
  opacity: 0.8,
  duration: 3000,
  showOuterRing: true,
  direction: 'clockwise',
  startAngle: 0,
  autoStart: true,
})

// Cesium only writes globe depth for post-processing while terrain depth testing is on.
// Share the setting across instances so destroying one layer does not disable another.
const depthTestOwners = new WeakMap()

function acquireGlobeDepth(viewer) {
  const globe = viewer.scene.globe
  const state = depthTestOwners.get(viewer) || {
    count: 0,
    original: globe.depthTestAgainstTerrain,
  }
  state.count += 1
  depthTestOwners.set(viewer, state)
  globe.depthTestAgainstTerrain = true
}

function releaseGlobeDepth(viewer) {
  const state = depthTestOwners.get(viewer)
  if (!state) return
  state.count -= 1
  if (state.count > 0) return
  if (!viewer.isDestroyed?.() && viewer.scene.globe.depthTestAgainstTerrain) {
    viewer.scene.globe.depthTestAgainstTerrain = state.original
  }
  depthTestOwners.delete(viewer)
}

function positiveNumber(value, fallback) {
  const number = Number(value)
  return Number.isFinite(number) && number > 0 ? number : fallback
}

function parseColor(value) {
  const color = value instanceof Cesium.Color
    ? Cesium.Color.clone(value)
    : Cesium.Color.fromCssColorString(String(value))
  if (!color) throw new TypeError(`RadarScanLayer color is invalid: ${value}`)
  return color
}

/** GeoJSON-style Point features rendered as depth-aware radar post-process stages. */
export default class RadarScanLayer {
  constructor(viewer, config = {}) {
    if (!viewer?.scene?.postProcessStages) {
      throw new Error('A Cesium Viewer with postProcessStages is required.')
    }

    this.viewer = viewer
    this.config = { ...defaults, ...config }
    this.data = []
    this.resources = []
    this._visible = true
    this._running = this.config.autoStart !== false
    this._renderTimer = null
    this._ownsGlobeDepth = false
  }

  setData(data = []) {
    if (!Array.isArray(data)) {
      console.error('RadarScanLayer data must be an array.')
      return this
    }

    this.clearLayer()
    this.data = data
    data.forEach((feature) => this.addLayer(feature))
    return this
  }

  setOptions(options = {}) {
    this.config = { ...this.config, ...options }
    this.resources.forEach((resource) => {
      resource.options = this._resolveOptions(resource.feature.properties)
    })
    this.viewer?.scene?.requestRender()
    return this
  }

  addLayer(feature) {
    if (!this._viewerAvailable()) return null
    const coordinates = feature?.geometry?.coordinates
    if (feature?.geometry?.type !== 'Point' || !Array.isArray(coordinates)) return null

    const longitude = Number(coordinates[0])
    const latitude = Number(coordinates[1])
    const height = coordinates[2] == null ? 0 : Number(coordinates[2])
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180
      || !Number.isFinite(latitude) || latitude < -90 || latitude > 90
      || !Number.isFinite(height)) return null

    const id = feature.properties?.id ?? uuid()
    const options = this._resolveOptions(feature.properties)
    const center = Cesium.Cartesian3.fromDegrees(longitude, latitude, height)
    const frame = Cesium.Transforms.eastNorthUpToFixedFrame(center)
    const centerWC = new Cesium.Cartesian4(center.x, center.y, center.z, 1)
    const eastWC = Cesium.Matrix4.getColumn(frame, 0, new Cesium.Cartesian4())
    const northWC = Cesium.Matrix4.getColumn(frame, 1, new Cesium.Cartesian4())
    const upWC = Cesium.Matrix4.getColumn(frame, 2, new Cesium.Cartesian4())
    const resource = {
      id,
      feature,
      options,
      centerWC,
      eastWC,
      northWC,
      upWC,
      elapsed: 0,
      startedAt: this._running ? performance.now() : null,
      centerEC: new Cesium.Cartesian4(),
      eastEC: new Cesium.Cartesian4(),
      northEC: new Cesium.Cartesian4(),
      upEC: new Cesium.Cartesian4(),
      normalEC: new Cesium.Cartesian3(),
      lineEC: new Cesium.Cartesian3(),
      stage: null,
    }

    const stage = new Cesium.PostProcessStage({
      name: `bmap-viewer-radar-scan-${uuid()}`,
      fragmentShader: radarScanShader,
      uniforms: {
        u_scanCenterEC: () => Cesium.Matrix4.multiplyByVector(
          this.viewer.camera.viewMatrix, resource.centerWC, resource.centerEC,
        ),
        u_scanPlaneNormalEC: () => {
          Cesium.Matrix4.multiplyByVector(this.viewer.camera.viewMatrix, resource.upWC, resource.upEC)
          return Cesium.Cartesian3.normalize(resource.upEC, resource.normalEC)
        },
        u_scanLineNormalEC: () => {
          const viewMatrix = this.viewer.camera.viewMatrix
          Cesium.Matrix4.multiplyByVector(viewMatrix, resource.eastWC, resource.eastEC)
          Cesium.Matrix4.multiplyByVector(viewMatrix, resource.northWC, resource.northEC)
          const elapsed = resource.elapsed + (resource.startedAt == null
            ? 0 : performance.now() - resource.startedAt)
          const direction = resource.options.direction === 'counterclockwise' ? -1 : 1
          const startAngle = Number(resource.options.startAngle) || 0
          const angle = Cesium.Math.toRadians(startAngle)
            + direction * Cesium.Math.TWO_PI
              * ((elapsed % resource.options.duration) / resource.options.duration)
          resource.lineEC.x = resource.northEC.x * Math.cos(angle) + resource.eastEC.x * Math.sin(angle)
          resource.lineEC.y = resource.northEC.y * Math.cos(angle) + resource.eastEC.y * Math.sin(angle)
          resource.lineEC.z = resource.northEC.z * Math.cos(angle) + resource.eastEC.z * Math.sin(angle)
          return Cesium.Cartesian3.normalize(resource.lineEC, resource.lineEC)
        },
        u_radius: () => resource.options.radius,
        u_scanColor: () => resource.options.color,
        u_showOuterRing: () => resource.options.showOuterRing ? 1 : 0,
        u_direction: () => resource.options.direction === 'counterclockwise' ? -1 : 1,
      },
    })

    if (!this._ownsGlobeDepth) {
      acquireGlobeDepth(this.viewer)
      this._ownsGlobeDepth = true
    }
    stage.enabled = this._visible
    resource.stage = this.viewer.scene.postProcessStages.add(stage)
    this.resources.push(resource)
    this._syncRenderTimer()
    this.viewer.scene.requestRender()
    return stage
  }

  getLayerById(id) {
    return this.resources.find((resource) => resource.id === id)?.stage || null
  }

  getLayerDataById(id) {
    return this.resources.find((resource) => resource.id === id)?.feature || null
  }

  removeLayer(stage) {
    const resource = this.resources.find((item) => item.stage === stage)
    if (!resource) return false
    this._removeResource(resource)
    return true
  }

  removeLayerById(id) {
    const resources = this.resources.filter((resource) => resource.id === id)
    resources.forEach((resource) => this._removeResource(resource))
    return resources.length
  }

  start() {
    if (this._running) return this
    this._running = true
    const now = performance.now()
    this.resources.forEach((resource) => { resource.startedAt = now })
    this._syncRenderTimer()
    this.viewer?.scene?.requestRender()
    return this
  }

  stop() {
    if (!this._running) return this
    const now = performance.now()
    this.resources.forEach((resource) => {
      if (resource.startedAt != null) resource.elapsed += now - resource.startedAt
      resource.startedAt = null
    })
    this._running = false
    this._syncRenderTimer()
    return this
  }

  show() {
    this._visible = true
    this.resources.forEach((resource) => { resource.stage.enabled = true })
    this._syncRenderTimer()
    this.viewer?.scene?.requestRender()
    return this
  }

  hide() {
    this._visible = false
    this.resources.forEach((resource) => { resource.stage.enabled = false })
    this._syncRenderTimer()
    this.viewer?.scene?.requestRender()
    return this
  }

  clearLayer() {
    this.resources.slice().forEach((resource) => this._removeResource(resource))
    this.data = []
    return this
  }

  destroy() {
    this.clearLayer()
    this.viewer = null
  }

  _resolveOptions(properties = {}) {
    const values = { ...this.config, ...properties }
    const opacity = Number(values.opacity)
    const color = parseColor(values.color)
    color.alpha *= Number.isFinite(opacity) ? Math.min(1, Math.max(0, opacity)) : defaults.opacity
    return {
      radius: positiveNumber(values.radius, defaults.radius),
      duration: positiveNumber(values.duration, defaults.duration),
      color,
      showOuterRing: values.showOuterRing !== false,
      direction: values.direction === 'counterclockwise' ? 'counterclockwise' : 'clockwise',
      startAngle: values.startAngle,
    }
  }

  _removeResource(resource) {
    const stages = this.viewer?.scene?.postProcessStages
    if (resource.stage && stages?.contains(resource.stage)) stages.remove(resource.stage)
    this.resources = this.resources.filter((item) => item !== resource)
    if (!this.resources.length && this._ownsGlobeDepth) {
      releaseGlobeDepth(this.viewer)
      this._ownsGlobeDepth = false
    }
    this._syncRenderTimer()
    this.viewer?.scene?.requestRender()
  }

  _syncRenderTimer() {
    if (this._renderTimer != null) {
      clearInterval(this._renderTimer)
      this._renderTimer = null
    }
    if (this._running && this._visible && this.resources.length
      && this.viewer?.scene?.requestRenderMode) {
      this._renderTimer = setInterval(() => {
        if (this._viewerAvailable()) this.viewer.scene.requestRender()
      }, 33)
    }
  }

  _viewerAvailable() {
    return Boolean(this.viewer && !this.viewer.isDestroyed?.())
  }
}
