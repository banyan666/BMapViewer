const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
const abortError = () => new DOMException('底图示例已取消', 'AbortError')

// 仅管理示例本次运行拥有的资源，不通过 Viewer 全局差集猜测归属。
export function createBaseMapExampleSession({ Cesium, BaseMaps, viewer, tileUrl }) {
  const resources = new Set()
  const readiness = []
  let disposed = false
  let returned = null
  let returnedCleaned = false

  const scopedBaseMaps = { ...BaseMaps }
  for (const name of ['BaseMap', 'CesiumTerrain', 'TdtTerrain']) {
    const Manager = BaseMaps[name]
    if (!Manager) continue
    scopedBaseMaps[name] = class extends Manager {
      constructor(...args) {
        if (disposed) throw abortError()
        super(...args)
        const destroy = this.destroy.bind(this)
        let destroyed = false
        this.destroy = () => {
          if (destroyed) return
          destroyed = true
          resources.delete(this.destroy)
          destroy()
        }
        resources.add(this.destroy)
        // 提前观察拒绝，避免代码尚未返回时异步失败成为未处理异常。
        if (this.readyPromise) {
          const ready = Promise.resolve(this.readyPromise)
          ready.catch(() => {})
          readiness.push(ready)
        }
      }
    }
  }

  function cleanupReturned() {
    if (returnedCleaned || !returned) return
    returnedCleaned = true
    try {
      const result = typeof returned === 'function' ? returned()
        : typeof returned.destroy === 'function' ? returned.destroy() : returned.remove?.()
      Promise.resolve(result).catch((error) => console.warn('底图示例清理失败：', error))
    } catch (error) { console.warn('底图示例清理失败：', error) }
  }

  const session = {
    async execute(code) {
      if (disposed) throw abortError()
      try {
        const execute = new AsyncFunction('Cesium', 'BaseMaps', 'viewer', 'tileUrl', `'use strict';\n${code}`)
        returned = await execute(Cesium, scopedBaseMaps, viewer, tileUrl)
        if (disposed) { cleanupReturned(); throw abortError() }
        await Promise.all([...readiness, returned?.readyPromise])
        if (disposed) throw abortError()
        return returned
      } catch (error) {
        session.destroy()
        throw error
      }
    },
    destroy() {
      if (disposed) return
      disposed = true
      cleanupReturned()
      // 地形后创建、先释放，再释放它所使用的影像。
      for (const destroy of [...resources].reverse()) {
        try { destroy() } catch (error) { console.warn('底图示例清理失败：', error) }
      }
      resources.clear()
    },
  }
  return session
}
