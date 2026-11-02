import { CustomDataSource } from 'cesium'

const methods = ['getElevation', 'getProfile', 'getSurfaceDistance', 'getSurfaceArea', 'getSlopeAspect', 'getVisibility', 'getCutFill', 'getFlood', 'prepareFlood']
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
const abortError = () => Object.assign(new Error('示例任务已取消'), { name: 'AbortError' })

// 仅供示例工作台使用：隔离拾取实体、管理异步任务和资源，不参与 SDK 分析或结果组装。
// 编辑器中的代码仍直接使用 PickTools → TerrainAnalysis → MapLayers。
export function createTerrainExampleSession({ viewer, TerrainAnalysis, PickTools, MapLayers, onResult, onError, onStatus, onFloodLayer = () => {} }) {
  const picking = new CustomDataSource('terrain-analysis-picking')
  const pickViewer = { scene: viewer.scene, cesiumWidget: viewer.cesiumWidget, entities: picking.entities }
  const resources = new Set()
  let disposed = false, returned = null, task = null
  Promise.resolve(viewer.dataSources.add(picking)).then(() => {
    if (disposed && !viewer.isDestroyed()) viewer.dataSources.remove(picking, true)
  }).catch((error) => { if (!disposed) onError(error) })

  function track(instance) {
    const destroy = instance.destroy.bind(instance)
    let destroyed = false
    instance.destroy = () => {
      if (destroyed) return
      destroyed = true
      resources.delete(instance.destroy)
      destroy()
    }
    resources.add(instance.destroy)
    if (disposed) instance.destroy()
    return instance
  }

  class ExampleAnalysis extends TerrainAnalysis {
    constructor(...args) { super(...args); track(this) }
  }
  methods.forEach((name) => {
    ExampleAnalysis.prototype[name] = async function (...args) {
      if (disposed) throw abortError()
      const current = task
      const index = ['getVisibility', 'getCutFill', 'getFlood'].includes(name) ? 2 : 1
      args[index] = { ...args[index], ...(current ? { signal: current.signal } : {}) }
      const result = await TerrainAnalysis.prototype[name].apply(this, args)
      if (disposed || current?.signal.aborted) throw abortError()
      return result
    }
  })

  class ExamplePicker extends PickTools {
    constructor(target, config) {
      super(target === viewer ? pickViewer : target, config)
      // PickTools 在结束绘制时也会调用 destroy，再创建拖拽事件，不能将它包装成永久销毁。
      if (disposed) this.destroy()
      else resources.add(() => this.destroy())
    }
  }
  ;['pickPoint', 'pickPointIcon', 'pickLine', 'pickPolygon'].forEach((name) => {
    ExamplePicker.prototype[name] = function (callback, ...args) {
      if (disposed) return
      onStatus('等待拾取：单击添加点位，线面双击结束；完成后可拖动控制点')
      return PickTools.prototype[name].call(this, async (coordinates) => {
        if (disposed) return
        task?.abort()
        const current = task = new AbortController()
        // 输入填充不覆盖结果图层；保留输入边界和控制点用于编辑。
        picking.entities.values.forEach((entity) => { if (entity.polygon) entity.polygon.show = false })
        onStatus('正在采样真实地形…')
        try {
          await callback(structuredClone(coordinates))
          if (!disposed && current === task) viewer.scene.requestRender()
        } catch (error) {
          if (!disposed && current === task && error.name !== 'AbortError') onError(error)
        }
      }, ...args)
    }
  })

  const exampleLayers = Object.fromEntries(Object.entries(MapLayers).map(([name, Layer]) => [name, typeof Layer !== 'function' ? Layer : class extends Layer {
    constructor(...args) { super(...args); track(this); if (name === 'FloodLayer' && !disposed) onFloodLayer(this) }
  }]))

  return {
    async execute(code) {
      try {
        const execute = new AsyncFunction('TerrainAnalysis', 'PickTools', 'MapLayers', 'viewer', 'onResult', `'use strict';\n${code}`)
        returned = await execute(ExampleAnalysis, ExamplePicker, exampleLayers, viewer, (data) => {
          if (disposed || task?.signal.aborted) return
          onResult(data)
        })
        if (disposed) {
          if (typeof returned === 'function') returned()
          else returned?.destroy?.()
        }
      } catch (error) {
        this.destroy()
        throw error
      }
    },
    destroy() {
      if (disposed) return
      disposed = true
      task?.abort()
      const cleanup = typeof returned === 'function' ? returned : () => returned?.destroy?.()
      try { cleanup() } catch (error) { console.warn('三维分析示例清理失败：', error) }
      resources.forEach((destroy) => { try { destroy() } catch (error) { console.warn('三维分析示例清理失败：', error) } })
      resources.clear()
      if (!viewer.isDestroyed()) {
        viewer.dataSources.remove(picking, true)
        const controls = viewer.scene.screenSpaceCameraController
        controls.enableRotate = controls.enableTranslate = controls.enableZoom = true
        if (typeof document !== 'undefined') document.body.style.cursor = 'default'
      }
    },
  }
}
