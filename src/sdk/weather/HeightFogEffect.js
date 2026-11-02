import * as Cesium from 'cesium'
import BaseWeatherEffect from './BaseWeatherEffect.js'
import { heightFogShader } from './height-fog/shader.js'

const defaults = Object.freeze({
  fogHeight: 900,
  baseHeight: 0,
  density: 0.62,
  brightness: 0.9,
  startDistance: 100,
  maxDistance: 100000,
  maxOpacity: 1,
  intensity: 1,
  color: '#ccd2d6',
})

function normalize(options, previous = defaults) {
  const config = { ...previous, ...options }
  const ranges = {
    fogHeight: [-10000, 100000], baseHeight: [-10000, 100000], density: [0, 10],
    startDistance: [0, 10000000], maxDistance: [1, 10000000], maxOpacity: [0, 1], intensity: [0, 1], brightness: [0, 2],
  }
  for (const [key, [minimum, maximum]] of Object.entries(ranges)) {
    const value = Number(config[key])
    if (!Number.isFinite(value)) throw new Error(`HeightFogEffect ${key} must be a finite number.`)
    config[key] = Math.min(maximum, Math.max(minimum, value))
  }
  if (config.fogHeight <= config.baseHeight) throw new Error('HeightFogEffect fogHeight must be greater than baseHeight.')
  const color = config.color instanceof Cesium.Color ? config.color : Cesium.Color.fromCssColorString(String(config.color))
  if (!color || ![color.red, color.green, color.blue, color.alpha].every(Number.isFinite)) throw new Error('HeightFogEffect color must be a valid CSS color or Cesium.Color.')
  if (config.color instanceof Cesium.Color) config.color = Cesium.Color.clone(config.color)
  return config
}

/** 深度高度雾：参考 FogDemo / FOG_FRAGMENT，使用视线竖直投影积分并调节整体亮度。 */
export default class HeightFogEffect extends BaseWeatherEffect {
  constructor(viewer, options = {}) {
    super(viewer, 'height-fog', defaults, normalize(options))
    if (viewer.scene.mode !== undefined && viewer.scene.mode !== Cesium.SceneMode.SCENE3D) throw new Error('HeightFogEffect requires a 3D scene.')
    this.load()
  }

  load(options = {}) { this.ensureUsable(); return super.load(normalize(options, this.config)) }
  setOptions(options = {}) { this.ensureUsable(); return super.setOptions(normalize(options, this.config)) }
  getOptions() {
    this.ensureUsable()
    const config = { ...this.config }
    if (config.color instanceof Cesium.Color) config.color = Cesium.Color.clone(config.color)
    return config
  }

  createStage(name) {
    const camera = () => this.viewer.camera || this.viewer.scene.camera
    return new Cesium.PostProcessStage({
      name,
      fragmentShader: heightFogShader,
      uniforms: {
        u_earthRadiusOnCamera: () => Cesium.Cartesian3.magnitude(camera().positionWC) - camera().positionCartographic.height,
        u_cameraHeight: () => camera().positionCartographic.height,
        u_fogHeight: () => this.config.fogHeight,
        u_baseHeight: () => this.config.baseHeight,
        u_globalDensity: () => this.config.density,
        u_startDistance: () => this.config.startDistance,
        u_maxDistance: () => this.config.maxDistance,
        u_maxOpacity: () => this.config.maxOpacity,
        u_intensity: () => this.config.intensity,
        brightness: () => this.config.brightness,
        u_fogColor: () => this.getColor('color', defaults.color),
      },
    })
  }
}
