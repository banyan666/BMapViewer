# TerrainAnalysis 三维地形分析

`TerrainAnalysis` 基于真实 TerrainProvider 异步采样，提供高程、剖面、贴地距离、地表面积、坡度坡向、地形通视、挖填方和等水位淹没分析。通过 `prepareFlood` 复用采样结果，配合 `FloodLayer` 展示水位升降，并计算各水位对应的淹没面积与体积。计算类只返回数据，不创建图层，不修改 Viewer 的地形或全局 Token。

与 `SpatialAnalysis` 的区别：空间分析不考虑地形起伏；三维分析需要先加载真实地形，结果依赖地形数据精度与采样密度。

## 接入

```js
import { BaseMaps, TerrainAnalysis } from 'b-map-viewer'

const terrain = new BaseMaps.CesiumTerrain(viewer, {
  token: import.meta.env.VITE_CESIUM_ION_TOKEN,
  requestVertexNormals: true, depthTestAgainstTerrain: true,
})
await terrain.readyPromise

const analysis = new TerrainAnalysis(viewer, {
  unit: 'km', areaUnit: 'km2', volumeUnit: 'm3',
  sampleSpacing: 60, cellSize: 120, maxSamples: 4096,
})
const result = await analysis.getProfile([[117.914, 43.783], [117.945, 43.791]])
console.log(result)

analysis.destroy() // 不会销毁 Viewer 或 TerrainProvider
terrain.destroy()
```

无需 Viewer 时，可使用 `new TerrainAnalysis(null, { terrainProvider })`。默认采样当前 Viewer 的地形，调用开始后固定使用该 Provider。

## 方法

| 方法 | 作用 | 文档 |
| --- | --- | --- |
| `getElevation(points, options?)` | 单点或批量高程 | [地形高程](/terrain/elevation) |
| `getProfile(line, options?)` | 沿线高程剖面与升降统计 | [地形剖面](/terrain/profile) |
| `getSurfaceDistance(line, options?)` | 起伏地表近似距离 | [贴地距离](/terrain/surface-distance) |
| `getSurfaceArea(polygon, options?)` | 地表面积与水平投影面积 | [地表面积](/terrain/surface-area) |
| `getSlopeAspect(polygon, options?)` | 三角网坡度和下坡方向 | [坡度坡向](/terrain/slope-aspect) |
| `getVisibility(first, second, options?)` | 考虑地球曲率的地形通视 | [地形通视](/terrain/visibility) |
| `getCutFill(polygon, baseHeight, options?)` | 相对水平设计高程的挖填体积 | [挖填方](/terrain/cut-fill) |
| `getFlood(polygon, waterHeight, options?)` | 静态水位以下区域与体积 | [淹没估算](/terrain/flood) |
| `prepareFlood(polygon, options?)` | 一次采样后复用网格，支持动态水位统计 | [动态淹没](/terrain/flood) |

## 配置

构造函数、`updateConfig(config)`、方法最后的 `options` 支持下列字段。单次调用不改变实例配置。

| 字段 | 默认值 | 作用 |
| --- | --- | --- |
| `unit` | `'m'` | 输出距离单位，`m` / `km` |
| `areaUnit` | `'m2'` | 输出面积单位，`m2` / `km2` / `ha` |
| `volumeUnit` | `'m3'` | 输出体积单位，`m3` / `km3` |
| `sampleSpacing` | `60` | 沿线采样最大水平间距，米 |
| `cellSize` | `120` | 面网格细分后的最大边长，米 |
| `maxSamples` | `4096` | 每次批量采样上限，整数 2～20000 |
| `batchSize` | `128` | 每批采样点数，整数 1～512 |
| `sampleLevel` | `null` | 固定地形层级 0～24；未指定时使用最详细可用层级 |
| `timeout` | `30000` | 一次方法调用的采样超时，毫秒 |
| `terrainProvider` | Viewer 当前地形 | 单独指定地形 Provider |
| `signal` | — | `AbortSignal`，中止任务结果等待与后续采样 |

高程、设计高程、水位、观察点离地高度、爬升和下降始终是**米**，并返回 `heightUnit: 'm'`，不随 `unit` 改变。高程是 WGS84 椭球高，不是海拔或离地高度。

所有成功结果都含 `sampleCount`、`samplingMode`、`sampleLevel`、`heightUnit`。`samplingMode` 为 `most-detailed` 或 `level`；固定层级 Provider 必须自行指定 `sampleLevel`，不会静默降级。

## 数据约定

- 坐标为 WGS84 `[经度, 纬度]`。输入第三维不作为地形数据，计算高程均来自 TerrainProvider。
- 点支持坐标、Point 几何、SDK `{ geometry, properties }` 数据项。批量高程也支持点数组、SDK 数组和 FeatureCollection，并保留业务属性。
- 线支持坐标组、LineString 几何、SDK 项或 Feature。连续重复点会合并。
- 面支持单个外环坐标组、Polygon / MultiPolygon 几何、SDK 项或 Feature。支持孔洞，自动闭合；非法、自交或退化面会报错。
- 面分析采用局部 WGS84 椭球比例尺投影和地形三角网，只支持非极区、经纬跨度不超过 2° 的局部区域；边界最多 512 个坐标。建议用于小范围分析。
- 返回的 `geometry` 包含 `[经度, 纬度, 高程米]`，可用于逐顶点高度的 Cesium 绘制。SDK 输入数据不会被修改。

## 采样精度与错误

计算基于离散采样和线性三角网，不能保证发现采样间距以内的尖峰、沟谷或遮挡；减小 `sampleSpacing` / `cellSize` 可提高密度，同时增加耗时。超出 `maxSamples` 时会明确报错，请缩小区域或增大间距。

地表面积采用局部投影三角网面积；体积相对水平等高面计算，不代表工程测量、土方施工计量或防洪预测。淹没分析不包含连通性、堤坝、流速和水动力模拟。通视只考虑地形，不包含建筑和 3D Tiles。

未加载真实地形、瓦片失败、缺失高程或采样超时会拒绝 Promise，不用零高程伪造成功结果。销毁实例后的待完成结果会被拒绝；网络层已发出的瓦片请求不保证能取消。

```js
const controller = new AbortController()
const task = analysis.getProfile(coordinates, { signal: controller.signal })
controller.abort()
try { await task } catch (error) {
  if (error.name !== 'AbortError') console.error(error)
}
```

## 生命周期

| 方法 | 作用 |
| --- | --- |
| `updateConfig(config)` | 修改后续调用配置，返回实例 |
| `isDestroyed()` | 查询是否销毁 |
| `destroy()` | 使待完成结果失效并释放 Viewer 引用，不销毁 Viewer 或地形 Provider |

示例页面在切换、重新运行和退出时清理自身数据源、拾取事件及分析任务，不清除其他业务图层。所有地形示例默认使用 Cesium World Terrain 和 ArcGIS 影像。

进入示例或文档组件案例后会自动开启 `PickTools`，等待拾取完成后才计算；不分析任何预置坐标。结果通过 `MapLayers` 的文字、线和面图层展示。保留控制点可拖拽更新，点击“重新绘制”清空旧结果并开始新一轮拾取。

## 拾取 → 分析 → 展示

编辑器只展示当前方法所需的代码。拾取实体隔离、旧任务取消和页面资源清理由示例工作台管理，不需要复制到每个案例中。

```js
import { TerrainAnalysis, PickTools, MapLayers } from 'b-map-viewer'

const analysis = new TerrainAnalysis(viewer, { unit: 'km' })
const tools = new PickTools(viewer, { includeHeight: true, isReserve: true })
const labels = new MapLayers.TextGroupLayer(viewer, {
  offset: [0, -26], enableCollisionDetection: false,
})

tools.pickPoint(async (coordinates) => {
  const result = await analysis.getElevation(coordinates)
  labels.setData(result.samples.map((point, index) => ({
    geometry: { type: 'Point', coordinates: [...point.center, point.height + 6] },
    properties: { id: 'height-' + index, text: point.height.toFixed(1) + ' m' },
  })))
  console.log(result)
})

// 页面退出时销毁各实例，并移除本页面拥有的拾取实体。
// tools.destroy(); analysis.destroy(); labels.destroy()
```

`includeHeight: true` 让拾取点携带当前地形的高度，挖填方和淹没示例可据此选择参考高程。`TerrainAnalysis` 仍独立采样真实地形，不将输入第三维当作沿线或区域的地形数据。
