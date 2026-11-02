// 示例专用：按需加载地形，切换、重运行或退出时恢复原场景。
export function createLayerExampleEnvironment({ BaseMaps, viewer, terrain }) {
  let disposed = false, terrainLayer = null, cancel = null
  const abort = () => Object.assign(new Error('图层示例已取消'), { name: 'AbortError' })
  const environment = {
    readyPromise: null,
    destroy() {
      if (disposed) return
      disposed = true
      cancel?.()
      cancel = null
      terrainLayer?.destroy()
      terrainLayer = null
    },
  }
  environment.readyPromise = (async () => {
    try {
      if (!terrain) return
      terrainLayer = new BaseMaps.CesiumTerrain(viewer, terrain)
      await new Promise((resolve, reject) => {
        cancel = () => reject(abort())
        Promise.resolve(terrainLayer.readyPromise).then(resolve, reject)
      })
      cancel = null
      if (disposed) throw abort()
    } catch (error) {
      environment.destroy()
      throw error
    }
  })()
  return environment
}
