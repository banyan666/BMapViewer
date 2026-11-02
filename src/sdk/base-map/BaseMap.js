import * as Cesium from 'cesium'
import EarthColor from '../utils/EarthColor.js'
import { createImageryProvider } from './createImageryProvider.js'

/**
 * 底图管理器。
 *
 * 统一管理一个 Cesium 影像底图的创建、切换、显隐、滤镜与销毁。
 */
class BaseMap {
  constructor(viewer, config = {}) {
    if (!viewer) throw new Error('Viewer is required.')

    this.viewer = viewer
    this.config = {}
    this.imageryLayer = null
    this.theme = null
    this.destroyed = false
    this.readyPromise = Promise.resolve(null)
    this.load(config)
  }

  load(config = {}) {
    this.ensureUsable()
    this.remove()
    this.config = {
      type: 'url-template',
      index: 0,
      show: true,
      ...config,
    }

    const provider = createImageryProvider(this.config)
    const layerOptions = {
      show: this.config.show,
      ...(this.config.layerOptions || {}),
    }
    this.imageryLayer = typeof provider?.then === 'function'
      ? Cesium.ImageryLayer.fromProviderAsync(provider, layerOptions)
      : new Cesium.ImageryLayer(provider, layerOptions)
    const layer = this.imageryLayer
    this.readyPromise = Promise.resolve(provider).then((readyProvider) => (
      !this.destroyed && this.imageryLayer === layer ? readyProvider : null
    ))
    // 保留 Promise 的拒绝状态供调用方 await，同时避免未等待时产生未处理拒绝。
    this.readyPromise.catch(() => {})

    const collection = this.viewer.imageryLayers
    const index = Math.max(0, Math.min(this.config.index, collection.length))
    collection.add(this.imageryLayer, index)

    if (this.config.themeColor) this.setTheme(this.config.themeColor)
    return this.imageryLayer
  }

  switch(config = {}) {
    return this.load({ ...this.config, ...config })
  }

  getImageryLayer() {
    return this.imageryLayer
  }

  getProvider() {
    return this.imageryLayer?.imageryProvider || null
  }

  setTheme(color) {
    this.ensureUsable()
    this.removeColor()
    if (!color) return
    this.theme = new EarthColor(this.viewer)
    this.theme.addColor({ invertColor: true, filterRGB: color })
  }

  removeColor() {
    this.theme?.restore()
    this.theme = null
  }

  show() {
    if (this.imageryLayer) this.imageryLayer.show = true
  }

  hide() {
    if (this.imageryLayer) this.imageryLayer.show = false
  }

  remove() {
    this.removeColor()
    if (
      this.imageryLayer &&
      this.viewer &&
      !this.viewer.isDestroyed() &&
      this.viewer.imageryLayers.contains(this.imageryLayer)
    ) {
      this.viewer.imageryLayers.remove(this.imageryLayer, true)
    }
    this.imageryLayer = null
    this.readyPromise = Promise.resolve(null)
  }

  destroy() {
    if (this.destroyed) return
    this.remove()
    this.destroyed = true
    this.viewer = null
    this.config = null
  }

  isDestroyed() {
    return this.destroyed
  }

  ensureUsable() {
    if (this.destroyed) throw new Error('BaseMap has been destroyed.')
    if (!this.viewer || this.viewer.isDestroyed()) {
      throw new Error('Viewer is unavailable.')
    }
  }
}

export default BaseMap
