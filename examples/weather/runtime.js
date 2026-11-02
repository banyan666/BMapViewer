import { JulianDate } from 'cesium'

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor

// 仅属于示例工作台：构造后立即登记资源，异步加载期间切换/退出也可同步销毁。
export function createWeatherExampleSession({ WeatherEffects, BaseMaps, terrain, viewer, time, onProgress = () => {}, onError = () => {} }) {
  const clock = time ? { currentTime: JulianDate.clone(viewer.clock.currentTime), shouldAnimate: viewer.clock.shouldAnimate } : null
  if (time) { viewer.clock.currentTime = JulianDate.fromIso8601(time); viewer.clock.shouldAnimate = false }
  const resources = new Set()
  const stages = new Set(Array.from({ length: viewer.scene.postProcessStages.length }, (_, i) => viewer.scene.postProcessStages.get(i)))
  let disposed = false, returned = null, cancelTerrain = null
  const abort = () => Object.assign(new Error('天气示例已取消'), { name: 'AbortError' })
  const options = (config = {}) => ({ ...config,
    onProgress(value) { if (!disposed) { onProgress(value); config.onProgress?.(value) } },
    onError(error) { if (!disposed) { onError(error); config.onError?.(error) } },
  })
  const scoped = Object.fromEntries(Object.entries(WeatherEffects).map(([name, value]) => [name, typeof value === 'function' && value.prototype?.destroy ? new Proxy(value, {
    construct(Target, args) {
      if (disposed) throw abort()
      const effect = Reflect.construct(Target, [args[0], options(args[1])])
      resources.add(effect)
      return effect
    },
  }) : value]))
  scoped.createWeatherEffect = (target, type, config) => {
    if (disposed) throw abort()
    const effect = typeof type === 'object'
      ? WeatherEffects.createWeatherEffect(target, options(type))
      : WeatherEffects.createWeatherEffect(target, type, options(config))
    resources.add(effect)
    return effect
  }
  return {
    async execute(code) {
      try {
        if (disposed) throw abort()
        if (terrain) {
          if (!BaseMaps?.CesiumTerrain) throw new Error('高度雾示例需要 BaseMaps.CesiumTerrain')
          const terrainLayer = new BaseMaps.CesiumTerrain(viewer, terrain)
          resources.add(terrainLayer)
          // 地形请求本身不可中断，但退出示例时立即结束等待，销毁后不会应用迟到的 Provider。
          try {
            await new Promise((resolve, reject) => {
              cancelTerrain = () => reject(abort())
              Promise.resolve(terrainLayer.readyPromise).then(resolve, reject)
            })
          } finally { cancelTerrain = null }
          if (disposed) throw abort()
        }
        returned = await new AsyncFunction('WeatherEffects', 'viewer', `'use strict';\n${code}`)(scoped, viewer)
        if (disposed) { if (typeof returned === 'function') returned(); else returned?.destroy?.(); throw abort() }
        if (returned?.readyPromise) await returned.readyPromise
        return returned
      } catch (error) { this.destroy(); throw error }
    },
    destroy() {
      if (disposed) return
      disposed = true
      cancelTerrain?.()
      cancelTerrain = null
      resources.forEach((effect) => { try { effect.destroy() } catch (error) { console.warn('天气示例清理失败：', error) } })
      resources.clear()
      try {
        if (typeof returned === 'function') Promise.resolve(returned()).catch((error) => console.warn('天气示例清理失败：', error))
        else if (returned && !returned.isDestroyed?.()) { if (returned.destroy) returned.destroy(); else returned.remove?.() }
      } catch (error) { console.warn('天气示例清理失败：', error) }
      if (!viewer.isDestroyed()) {
        if (clock) { viewer.clock.currentTime = clock.currentTime; viewer.clock.shouldAnimate = clock.shouldAnimate }
        const collection = viewer.scene.postProcessStages
        for (let i = collection.length - 1; i >= 0; i--) if (!stages.has(collection.get(i))) collection.remove(collection.get(i))
      }
    },
  }
}
