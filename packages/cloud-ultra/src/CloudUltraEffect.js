import * as Cesium from 'cesium'
import BaseWeatherEffect from '../../../src/sdk/weather/BaseWeatherEffect.js'
import { CloudsPipeline } from './cloud-ultra/CloudsPipeline.js'
import { cloudUltraDefaults, copyCloudUltraOptions, normalizeCloudUltraOptions } from './cloud-ultra/options.js'
import { getCloudUltraResources } from './cloud-ultra/resources.js'
import { waitForCloudUltraResources } from './cloud-ultra/resourceData.js'

const owners = new WeakMap()

/** Ultra 世界空间体积云。异步加载资源，使用统一天气生命周期，不创建 Viewer 或修改时钟、地形和 Token。 */
export default class CloudUltraEffect extends BaseWeatherEffect {
  constructor(viewer, options = {}) {
    super(viewer, 'cloud-ultra', cloudUltraDefaults, normalizeCloudUltraOptions(options))
    this.ready = false
    this.error = null
    this.progress = 0
    this._loading = null
    this._version = 0
    this._timer = null
    this._resourceAbort = null
    this._resources = null
    this._onContextLost = () => {
      const error = new Error('CloudUltraEffect WebGL 上下文已丢失，请恢复后重新 load')
      this.remove()
      this._reportError(error)
    }
    viewer.scene.canvas.addEventListener('webglcontextlost', this._onContextLost)
    this.load()
  }

  static isSupported(viewer) {
    const context = viewer?.scene?.context, gl = context?._gl
    return Boolean(context?.webgl2 && gl?.getExtension('EXT_color_buffer_float')
      && gl.getParameter(gl.MAX_DRAW_BUFFERS) >= 3
      && gl.getParameter(gl.MAX_COLOR_ATTACHMENTS) >= 3
      && gl.getParameter(gl.MAX_3D_TEXTURE_SIZE) >= 256)
  }

  load(options = {}) {
    this.ensureUsable()
    const config = normalizeCloudUltraOptions(options, this.config)
    this.remove()
    this.config = config
    this.error = null; this.progress = 0
    const version = ++this._version
    const task = this._load(version)
    this.readyPromise = task
    // 构造函数同步返回实例；调用者仍可 await readyPromise 捕获失败。
    task.catch(() => {})
    return task
  }

  async _load(version) {
    let pipeline
    try {
      if (this.viewer.scene.mode !== Cesium.SceneMode.SCENE3D) throw new Error('CloudUltraEffect 只支持三维场景')
      if (!CloudUltraEffect.isSupported(this.viewer)) throw new Error('CloudUltraEffect 需要 WebGL2、浮点颜色缓冲及至少 3 个 MRT 附件')
      const owner = owners.get(this.viewer.scene)
      if (owner && owner !== this) throw new Error('同一场景只能启用一个 CloudUltraEffect，请先销毁已有实例')
      owners.set(this.viewer.scene, this)
      const controller = this._resourceAbort = new AbortController()
      this._timer = setTimeout(() => {
        const error = new Error('CloudUltraEffect 资源准备超时，请检查网络和设备性能')
        this._reportError(error)
        controller.abort(error)
        pipeline?.stop()
      }, this.config.timeout)
      const resources = getCloudUltraResources(controller.signal)
      const handle = resources?.then ? await waitForCloudUltraResources(resources, controller.signal) : resources
      if (version !== this._version || this.destroyed) { handle.release(); throw Object.assign(new Error('CloudUltraEffect cancelled'), { name: 'AbortError' }) }
      this._resources = handle
      pipeline = new CloudsPipeline(this.viewer.scene, {
        resources: this._resources.urls, enabled: this.config.enabled,
        configure: () => this._applyOptions(),
        onError: (error) => { if (version === this._version && !this.destroyed) { this.ready = false; this._reportError(error) } },
      })
      this.stage = pipeline
      this._loading = pipeline.start((progress) => {
        if (version !== this._version || this.destroyed) return
        this.progress = Math.round(progress)
        try { this.config.onProgress?.(this.progress) } catch (error) { console.warn('CloudUltraEffect onProgress:', error) }
      })
      await this._loading
      if (version !== this._version || this.destroyed) throw Object.assign(new Error('CloudUltraEffect cancelled'), { name: 'AbortError' })
      this.ready = true
      return pipeline
    } catch (error) {
      pipeline?.stop()
      const failure = version === this._version && this.error ? this.error : error
      if (version === this._version && !this.destroyed) {
        if (owners.get(this.viewer.scene) === this) owners.delete(this.viewer.scene)
        this.stage = null; this.ready = false
        if (failure.name !== 'AbortError') this._reportError(failure)
      }
      throw failure
    } finally {
      if (version === this._version) { clearTimeout(this._timer); this._timer = null; this._loading = null; this._resources?.release(); this._resources = null }
    }
  }

  _reportError(error) {
    if (this.error === error) return
    this.error = error
    try { this.config.onError?.(error) } catch (callbackError) { console.error('CloudUltraEffect onError:', callbackError) }
  }

  _applyOptions() {
    const pipeline = this.stage, uniforms = pipeline?.uniforms, config = this.config
    if (!uniforms) return
    pipeline.exposure = config.exposure
    pipeline.enableShadow = config.enableShadow
    pipeline.enableCloudShadow = config.enableCloudShadow
    pipeline.cloudShadowStrength = config.cloudShadowStrength
    pipeline.enableAerialPerspective = config.enableAerialPerspective
    pipeline.aerialPerspectiveScale = config.aerialPerspectiveScale
    pipeline.enableGlobeLighting = config.enableGlobeLighting
    if (pipeline.enabled) pipeline.setGlobeLighting(config.enableGlobeLighting)
    pipeline.setTemporalUpscale(config.temporalUpscale)
    pipeline.setPerfOptimize(config.perfOptimize)
    pipeline.resolvePass.temporalAlpha = config.temporalAlpha
    pipeline.resolvePass.varianceGamma = config.varianceGamma
    uniforms.disableSceneClamp = !config.terrainClip
    Object.assign(uniforms.params, { coverage: config.coverage, scatteringCoefficient: config.scatteringCoefficient, absorptionCoefficient: config.absorptionCoefficient })
    Object.assign(uniforms.march, { maxIterationCount: config.steps, maxRayDistance: config.maxDistance })
    pipeline._shadowPass._shadowMarch.maxIterationCount = config.shadowSteps
    config.layers.forEach((layer, index) => { pipeline.layers[index] = { ...layer, densityProfile: { ...layer.densityProfile } } })
    uniforms.markLayersDirty()
    const frame = Cesium.Transforms.eastNorthUpToFixedFrame(this.viewer.scene.camera.positionWC)
    const angle = Cesium.Math.toRadians(config.windDirection)
    const direction = Cesium.Matrix4.multiplyByPointAsVector(frame, new Cesium.Cartesian3(Math.sin(angle), Math.cos(angle), 0), new Cesium.Cartesian3())
    Cesium.Cartesian2.fromElements(config.windSpeed * 1e-5, 0, uniforms.wind.localWeatherVelocity)
    Cesium.Cartesian3.multiplyByScalar(direction, config.windSpeed * uniforms.params.shapeRepeat, uniforms.wind.shapeVelocity)
    Cesium.Cartesian3.multiplyByScalar(direction, config.windSpeed * uniforms.params.shapeDetailRepeat * 0.25, uniforms.wind.shapeDetailVelocity)
    uniforms.resetReprojection()
    pipeline.setEnabled(config.enabled)
  }

  setOptions(options = {}) {
    this.ensureUsable()
    const config = normalizeCloudUltraOptions(options, this.config)
    this.config = config
    this._applyOptions()
    this.viewer.scene.requestRender()
    return this
  }

  getOptions() { this.ensureUsable(); return copyCloudUltraOptions(this.config) }
  show() { return this.setOptions({ enabled: true }) }
  hide() { return this.setOptions({ enabled: false }) }
  remove() {
    this._version += 1
    clearTimeout(this._timer); this._timer = null
    this._resourceAbort?.abort(Object.assign(new Error('CloudUltraEffect cancelled'), { name: 'AbortError' }))
    this._resourceAbort = null
    this.stage?.stop()
    this._resources?.release(); this._resources = null
    if (this.viewer?.scene && owners.get(this.viewer.scene) === this) owners.delete(this.viewer.scene)
    this.stage = null; this.ready = false; this._loading = null
  }

  destroy() {
    if (this.destroyed) return
    this.viewer?.scene?.canvas.removeEventListener('webglcontextlost', this._onContextLost)
    super.destroy()
  }
}
