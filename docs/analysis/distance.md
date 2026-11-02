# SpatialAnalysis 距离分析

`SpatialAnalysis` 是空间分析工具类，通过 `new SpatialAnalysis(config)` 创建实例，无需传入 Viewer。提供距离分析和[面积分析](/analysis/area)方法。

`getDistance` 使用 Turf 计算 WGS84 经纬度之间的球面距离，按输入顺序连接相邻点，返回各段距离、累计距离和总距离。不会自动闭合路径，也不计入高度差或地形起伏。

## 组件案例

<SdkExamplePreview category="analysis" example="distance-pick" title="SpatialAnalysis 距离分析" />

在地图中使用 PickTools 左键添加折点，双击结束后查看分段距离与总距离；拖动节点可更新结果。[在线示例](https://banyan666.github.io/BMapViewer/#/spatial-analysis)中还可以编辑代码和单位配置。

展开示例代码后，下方的 `CALLBACK RESULT` 面板会以 JSON 展示 `getDistance` 返回的完整数据；示例也会将结果打印到浏览器控制台。重新绘制时会清空旧结果，完成新路径后自动更新。

## 构造函数

```js
import { SpatialAnalysis } from 'b-map-viewer'

const analysis = new SpatialAnalysis({ unit: 'm' })
```

| 参数 | 类型 | 默认值 | 作用 |
| --- | --- | --- | --- |
| `config.unit` | `string` | `'m'` | 距离单位：`m` 米、`km` 千米；也支持 `meters`、`kilometers` |

## `getDistance(coordinates, options?)`

```js
const coordinates = [
  [125.80350776030973, 44.15904888594703],
  [125.83145648715924, 44.15448101296233],
  [125.84177266582131, 44.138682438735366],
]

const result = analysis.getDistance(coordinates)

console.log(result.distances)     // [2286.743933123865, 1940.0009608436928]
console.log(result.totalDistance) // 4226.744893967558
console.log(result.unit)          // 'm'

// 单次覆盖单位，不改变实例默认值
const kilometers = analysis.getDistance(coordinates, { unit: 'km' })
```

| 参数 | 类型 | 作用 |
| --- | --- | --- |
| `coordinates` | `number[][]` | 至少两个 `[经度, 纬度]` 坐标，按数组顺序计算；可包含第三维高度，但不会参与计算 |
| `options.unit` | `string` | 仅覆盖本次计算的单位 |

经度范围为 `[-180, 180]`，纬度范围为 `[-90, 90]`。点数不足、坐标无效或单位不支持时会抛出错误。重复的相邻点保留为距离为 `0` 的分段。

### 返回结果

输入 `N` 个坐标时，返回 `N - 1` 个分段。所有数值采用同一个单位，保留计算精度；显示时可自行调用 `toFixed`。

| 字段 | 类型 | 作用 |
| --- | --- | --- |
| `unit` | `'m' / 'km'` | 本次计算的单位 |
| `distances` | `number[]` | 按坐标顺序排列的各段距离 |
| `totalDistance` | `number` | 所有分段距离之和 |
| `segments` | `object[]` | 按坐标顺序排列的分段详情 |
| `segments[].index` | `number` | 分段索引，从 `0` 开始 |
| `segments[].start` | `number[]` | 当前段起点 `[经度, 纬度]` |
| `segments[].end` | `number[]` | 当前段终点 `[经度, 纬度]` |
| `segments[].center` | `number[]` | 当前段的球面中点，可用于放置距离标注 |
| `segments[].distance` | `number` | 当前段距离 |
| `segments[].cumulativeDistance` | `number` | 从路径起点累加至当前段终点的距离 |

输入坐标不会被修改，返回的坐标为独立数组。

## `updateConfig(config)`

修改后续分析的默认单位，返回当前实例。

```js
analysis.updateConfig({ unit: 'km' })
const result = analysis.getDistance(coordinates)
```

## 配合 PickTools 和图层

将 `pickLine` 返回的坐标直接传给 `getDistance`，再把分段中点和距离转换成 SDK 点数据交给文字图层。

```js
import { SpatialAnalysis, PickTools, MapLayers } from 'b-map-viewer'

const analysis = new SpatialAnalysis({ unit: 'm' })
const labels = new MapLayers.TextGroupLayer(viewer, {
  fontSize: 15,
  color: '#e9ffdc',
  showBackground: true,
  backgroundColor: 'rgba(6, 26, 31, 0.9)',
  offset: [0, -18],
  enableCollisionDetection: false,
})
const tools = new PickTools(viewer, {
  isReserve: false,
  color: '#a3d68a',
  lineWidth: 4,
  mouseHints: { show: true, text: '左键添加折点，双击结束' },
})
const route = new MapLayers.LineGroupLayer(viewer, { color: '#a3d68a', width: 4 })

tools.pickLine((coordinates) => {
  const result = analysis.getDistance(coordinates)
  route.setData([{
    geometry: { type: 'LineString', coordinates },
    properties: { id: 'measured-route' },
  }])
  labels.setData([
    ...result.segments.map((segment) => ({
      geometry: { type: 'Point', coordinates: segment.center },
      properties: {
        id: 'segment-' + segment.index,
        text: '第 ' + (segment.index + 1) + ' 段：' + segment.distance.toFixed(2) + ' m',
      },
    })),
    {
      geometry: { type: 'Point', coordinates: result.segments.at(-1).end },
      properties: { id: 'total', text: '总距离：' + result.totalDistance.toFixed(2) + ' m' },
    },
  ])
  viewer.scene.requestRender()
})

// 离开页面时调用
function cleanup() {
  tools.destroy()
  route.destroy()
  labels.destroy()
}
```

上面的示例在结束拾取后用图层呈现结果。在线示例还提供 `isReserve: true` 的节点拖拽编辑，编辑完成后自动重新计算并更新标注；重新运行或切换示例时会清理上一次的拾取实体和图层。
