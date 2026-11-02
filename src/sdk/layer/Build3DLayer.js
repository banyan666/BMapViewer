import * as Cesium from 'cesium'
import FeatureColors, { featureKey } from './build3d/FeatureColors.js'
import { normalizeBuildShader, buildShaderUniforms, createBuildShader } from './material/build3d.js'

function urlKey(url) {
  const key = url instanceof Cesium.Resource ? url.url : url
  if (typeof key !== 'string' || !key.trim()) throw new TypeError('A tileset URL is required.')
  return key
}

function nativeStyle(value) {
  if (value == null) return undefined
  if (value instanceof Cesium.Cesium3DTileStyle) return value
  if (Array.isArray(value)) return new Cesium.Cesium3DTileStyle({ color: { conditions: value } })
  if (typeof value !== 'object') throw new TypeError('style must be conditions, a style object or Cesium3DTileStyle.')
  return new Cesium.Cesium3DTileStyle(value)
}

function disposeTileset(tileset, viewer) {
  if (!tileset || tileset.isDestroyed()) return
  if (viewer && !viewer.isDestroyed?.()) viewer.scene.primitives.remove(tileset)
  if (!tileset.isDestroyed()) tileset.destroy()
}

/** 3D Tiles 建筑图层：加载、按标识改色、高度渐变与动态扫光。 */
export default class Build3DLayer {
  constructor(viewer, config = {}) {
    if (!viewer?.scene?.primitives || !viewer.clock?.onTick || viewer.isDestroyed?.()) throw new Error('An active Cesium Viewer is required.')
    urlKey(config.url)
    const show = config.show ?? config.options?.show ?? true
    if (typeof show !== 'boolean') throw new TypeError('show must be a boolean.')
    const property = config.featureIdProperty ?? 'id'
    if (typeof property !== 'string' || !property.trim()) throw new TypeError('featureIdProperty must be a nonempty string.')
    if (config.options?.customShader) throw new Error('Use the shader option instead of options.customShader.')
    const shader = normalizeBuildShader(typeof config.shader === 'boolean' ? { enabled: config.shader } : config.shader)
    this.config = { url: config.url, name: config.name ?? 'Build3DLayer', show, featureIdProperty: property, options: { ...config.options }, shader }
    this.name = this.config.name
    this.viewer = viewer
    this.tileset = null
    this.readyPromise = null
    this._loadedKey = null
    this._pending = null
    this._version = 0
    this._destroyed = false
    this._style = nativeStyle(config.style)
    this._shader = null
    this._colors = new FeatureColors(property)
    this._events = []
    this._removeTick = null
    this._elapsed = 0
    this._startedAt = null
  }

  _assertAlive() {
    if (this._destroyed || this.viewer?.isDestroyed?.()) throw new Error('Build3DLayer or its Viewer has been destroyed.')
  }

  _requestRender() {
    if (this.viewer && !this.viewer.isDestroyed?.()) this.viewer.scene.requestRender()
  }

  _time() { return this._elapsed + (this._startedAt === null ? 0 : (performance.now() - this._startedAt) * 0.0001) }

  /** 相同地址的并发加载复用 Promise；被后续加载/清理取代的请求以 AbortError 结束。 */
  load(url = this.config.url) {
    this._assertAlive()
    const key = urlKey(url)
    if (this._pending?.key === key) return this._pending.promise
    if (this.tileset && this._loadedKey === key) {
      this._version++
      this._pending = null
      this.readyPromise = Promise.resolve(this.tileset)
      return this.readyPromise
    }
    const version = ++this._version
    const options = { ...this.config.options, show: this.config.show }
    const cancelled = () => this._destroyed || version !== this._version || this.viewer?.isDestroyed?.()
    const abortError = () => new DOMException('Tileset load was superseded or cancelled.', 'AbortError')
    const promise = Promise.resolve().then(() => {
      if (cancelled()) throw abortError()
      return Cesium.Cesium3DTileset.fromUrl(url, options)
    }).then((tileset) => {
      if (cancelled()) {
        disposeTileset(tileset)
        throw abortError()
      }
      this._releaseTileset()
      this.tileset = tileset
      try {
        this.viewer.scene.primitives.add(tileset)
        tileset.show = this.config.show
        tileset.colorBlendMode = Cesium.Cesium3DTileColorBlendMode.REPLACE
        this._events = [
          tileset.tileLoad.addEventListener((tile) => this._colors.track(tile)),
          tileset.tileVisible.addEventListener((tile) => { if (this._colors.visible(tile)) this._requestRender() }),
          tileset.tileUnload.addEventListener((tile) => this._colors.unload(tile)),
        ]
        this._applyShader()
        this.config.url = url
        this._loadedKey = key
        this._requestRender()
        return tileset
      } catch (error) {
        this._releaseTileset()
        throw error
      }
    }).catch((error) => {
      if (cancelled()) throw abortError()
      throw error
    }).finally(() => {
      if (this._pending?.version === version) this._pending = null
    })
    this._pending = { key, version, promise }
    this.readyPromise = promise
    return promise
  }

  /** 使用原生样式时关闭内置着色器；再次开启着色器时暂停原生样式。 */
  setStyle(style) {
    this._assertAlive()
    this._style = nativeStyle(style)
    this.config.shader.enabled = false
    this._applyShader()
    this._requestRender()
    return this
  }

  /** 合并着色参数。false 关闭效果，true 按当前参数开启。 */
  setShader(options = {}) {
    this._assertAlive()
    if (typeof options !== 'boolean' && (!options || typeof options !== 'object' || Array.isArray(options))) throw new TypeError('shader must be an object or boolean.')
    const patch = typeof options === 'boolean' ? { enabled: options } : options
    this.config.shader = normalizeBuildShader({ ...this.config.shader, enabled: true, ...patch })
    this._applyShader()
    this._requestRender()
    return this
  }

  getShaderOptions() { return normalizeBuildShader(this.config.shader) }

  _applyShader() {
    if (!this.tileset) return
    const config = this.config.shader
    const enabled = config.enabled && (config.gradientEnabled || config.sweepEnabled)
    const style = enabled ? undefined : this._style
    if (this.tileset.style !== style) {
      this.tileset.style = style
      this._colors.styleChanged(style)
    }
    this._colors.setShaderActive(enabled)
    if (enabled) {
      if (!this._shader) this._shader = createBuildShader(config, this._time())
      else for (const [name, uniform] of Object.entries(buildShaderUniforms(config, this._time()))) this._shader.setUniform(name, uniform.value)
      this.tileset.customShader = this._shader
    } else {
      this.tileset.customShader = undefined
      if (this._shader && !this._shader.isDestroyed()) this._shader.destroy()
      this._shader = null
    }
    this._syncAnimation()
  }

  _syncAnimation() {
    this._removeTick?.()
    this._removeTick = null
    const config = this.config.shader
    const animated = this._shader && this.tileset?.show && config.active && config.sweepEnabled && config.speed > 0
    if (animated && this._startedAt === null) this._startedAt = performance.now()
    else if (!animated && this._startedAt !== null) {
      this._elapsed = this._time()
      this._startedAt = null
    }
    this._shader?.setUniform('u_time', this._time())
    if (animated) this._removeTick = this.viewer.clock.onTick.addEventListener(() => {
      if (this.viewer.isDestroyed?.()) { this.destroy(); return }
      this._shader.setUniform('u_time', this._time())
      this._requestRender()
    })
  }

  start() { this._assertAlive(); this.config.shader.active = true; this._syncAnimation(); this._requestRender(); return this }
  stop() { this._assertAlive(); this.config.shader.active = false; this._syncAnimation(); this._requestRender(); return this }
  resetTime() {
    this._assertAlive()
    this._elapsed = 0
    if (this._startedAt !== null) this._startedAt = performance.now()
    this._shader?.setUniform('u_time', 0)
    this._requestRender()
    return this
  }

  /** 按标识改色；渐变开启时仅替换该建筑的 maxColor，不改变渐变底色或扫光。 */
  setFeatureColor(id, color) { this._assertAlive(); this._colors.set(id, color); this._requestRender(); return this }
  /** 全量替换改色列表，遵循 setFeatureColor 的着色规则；传空数组可恢复，支持加载前调用。 */
  setFeatureColors(items) { this._assertAlive(); this._colors.replace(items); this._requestRender(); return this }
  clearFeatureColor(id) { this._assertAlive(); this._colors.clear(featureKey(id)); this._requestRender(); return this }
  clearFeatureColors() { this._assertAlive(); this._colors.clear(); this._requestRender(); return this }
  getFeatureColor(id) { return this._colors.get(id) }
  getFeaturesById(id) { return this._colors.getFeatures(id) }
  getTileset() { return this.tileset }
  isDestroyed() { return this._destroyed }

  show() {
    this._assertAlive()
    this.config.show = true
    if (this.tileset) this.tileset.show = true
    this._syncAnimation(); this._requestRender()
    return this
  }

  hide() {
    this._assertAlive()
    this.config.show = false
    if (this.tileset) this.tileset.show = false
    this._syncAnimation(); this._requestRender()
    return this
  }

  flyTo(duration = 1.2, options = {}) {
    this._assertAlive()
    if (this.tileset) this.viewer.camera.flyToBoundingSphere(this.tileset.boundingSphere, {
      duration,
      offset: new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-45), this.tileset.boundingSphere.radius * 3),
      ...options,
    })
    return this
  }

  _releaseTileset() {
    this._removeTick?.()
    this._removeTick = null
    for (const remove of this._events) remove()
    this._events = []
    this._colors.detach()
    if (this.tileset && !this.tileset.isDestroyed()) this.tileset.customShader = undefined
    disposeTileset(this.tileset, this.viewer)
    if (this._shader && !this._shader.isDestroyed()) this._shader.destroy()
    this.tileset = null
    this._shader = null
    this._loadedKey = null
    this._elapsed = 0
    this._startedAt = null
  }

  /** 清理渲染资源，保留配置及改色列表，之后可重新 load。 */
  clearLayer() {
    this._version++
    this._pending = null
    this.readyPromise = null
    this._releaseTileset()
    this._requestRender()
    return this
  }

  destroy() {
    if (this._destroyed) return
    this.clearLayer()
    this._colors.clear()
    this._destroyed = true
    this.viewer = null
  }
}
