# SpatialAnalysis 面积叠加分析

`getOverlapArea(firstCoordinates, secondCoordinates, options?)` 使用 Turf 计算两个多边形的交集，返回重叠面积、交叠比例以及可直接绘制的 GeoJSON 几何。无需传入 Viewer，可配合 `PickTools.pickPolygon()` 和 SDK 面图层使用。

## 组件案例

<SdkExamplePreview category="analysis" example="overlap-area-pick" title="SpatialAnalysis 面积叠加分析" />

红色为默认区域，绿色为拾取区域，蓝色为交叠部分。在红色区域附近单击添加顶点，双击结束绘制；拖拽顶点后重新计算并更新交集。没有重叠面积时显示提示并清除旧的蓝色区域。

在[在线示例](https://banyan666.github.io/BMapViewer/#/spatial-analysis)中选择“面积叠加分析”，可以编辑默认坐标、面积单位和颜色，查看地图结果、分析面板及 `CALLBACK RESULT` 返回数据。

## 使用方法

```js
import { SpatialAnalysis } from 'b-map-viewer'

const analysis = new SpatialAnalysis({ areaUnit: 'km2' })
const firstCoordinates = [
  [125.795, 44.142], [125.800, 44.164], [125.816, 44.175],
  [125.835, 44.165], [125.836, 44.142],
]
const secondCoordinates = [
  [125.82, 44.13], [125.85, 44.13],
  [125.85, 44.16], [125.82, 44.16],
]

const result = analysis.getOverlapArea(firstCoordinates, secondCoordinates)
console.log(result.area)         // 约 2.4925
console.log(result.unit)         // 'km2'
console.log(result.hasOverlap)   // true
console.log(result.geometry)     // GeoJSON Polygon 或 MultiPolygon
console.log(result.firstRatio)   // 约 0.2706，即占第一组区域约 27.06%
console.log(result.secondRatio)  // 约 0.3121，即占第二组区域约 31.21%

// 单次覆盖面积单位，不修改实例默认配置
const hectares = analysis.getOverlapArea(firstCoordinates, secondCoordinates, {
  areaUnit: 'ha',
})
```

## 参数

| 参数 | 默认值 | 作用 |
| --- | --- | --- |
| `firstCoordinates` | 必填 | 第一组面顶点 `[[经度, 纬度], ...]` |
| `secondCoordinates` | 必填 | 第二组面顶点，可直接传入 `pickPolygon` 返回的坐标组 |
| `options.areaUnit` | 实例配置，初始为 `'m2'` | 所有返回面积的单位：`m2`、`km2`、`ha`；也支持 `m²`、`km²` |

两组坐标各自表示单个多边形外环，至少包含三个不共线顶点，按边界顺序排列；支持已闭合或未闭合的坐标，自动合并连续重复点并补齐闭合边。输入数组不会被修改，第三维高度不参与分析。

非法坐标、自相交、退化区域和重复的非相邻顶点会抛出错误。当前方法面向不跨越 ±180° 经线的局部区域，不接受带孔洞、多区域或环绕极点的输入。交集结果可以包含多个不相连的区域。

交集边界按经纬度平面拓扑裁剪，面积由 Turf 按球面计算，不包含地形起伏。`unit` 距离配置不影响此方法，所有面积使用 `areaUnit`。

## 返回结果

| 字段 | 类型 | 作用 |
| --- | --- | --- |
| `area` | `number` | 所有交叠部分的总面积 |
| `unit` | `'m2' / 'km2' / 'ha'` | `area`、原始区域面积和各分块面积的统一单位 |
| `hasOverlap` | `boolean` | 是否存在具有正面积的交集 |
| `firstArea` | `number` | 第一组区域的面积 |
| `secondArea` | `number` | 第二组区域的面积 |
| `firstRatio` | `number` | 交叠面积占第一组区域的比例，范围 0～1 |
| `secondRatio` | `number` | 交叠面积占第二组区域的比例，范围 0～1 |
| `center` | `number[] / null` | 最大交叠分块上的标签锚点 `[经度, 纬度]` |
| `geometry` | `object / null` | 交集的 GeoJSON `Polygon` 或 `MultiPolygon` 几何，可直接传给 SDK 面图层 |
| `parts` | `object[]` | 交叠分块列表，每项包含 `area`、`center` 和 `geometry` |

`parts[].geometry` 为单个 `Polygon`，`parts[].area` 的单位同返回结果的 `unit`。每块的 `center` 优先使用区域质心，若质心在区域外，则回退到区域内或边界上的点，适合放置面积标注，不保证是几何中心。

没有相交或仅接触边、顶点时，返回 `area: 0`、`hasOverlap: false`、`geometry: null`、`center: null`、`parts: []`，两项比例均为 0；`firstArea` 和 `secondArea` 仍保留有效值。

## 配合拾取与面图层

```js
import { SpatialAnalysis, PickTools, MapLayers } from 'b-map-viewer'

const analysis = new SpatialAnalysis({ areaUnit: 'km2' })
const entitySnapshot = new Set(viewer.entities.values)
const firstCoordinates = [
  [125.795, 44.142], [125.800, 44.164], [125.816, 44.175],
  [125.835, 44.165], [125.836, 44.142],
]
const baseLayer = new MapLayers.PolygonPrimitiveLayer(viewer, {
  color: '#ef534b', opacity: 0.4, height: 2,
})
const overlapLayer = new MapLayers.PolygonPrimitiveLayer(viewer, {
  color: '#4169ff', opacity: 0.85, height: 12,
})
baseLayer.setData([{
  geometry: { type: 'Polygon', coordinates: [analysis.getArea(firstCoordinates).coordinates] },
  properties: { id: 'default-area' },
}])

const tools = new PickTools(viewer, { color: '#36df93', isReserve: true })
tools.pickPolygon((coordinates) => {
  try {
    const result = analysis.getOverlapArea(firstCoordinates, coordinates)
    if (result.hasOverlap) {
      overlapLayer.setData([{
        geometry: result.geometry,
        properties: { id: 'intersection' },
      }])
    } else {
      overlapLayer.clearLayer()
    }
    console.log('SpatialAnalysis.getOverlapArea 返回结果：', result)
  } catch (error) {
    overlapLayer.clearLayer()
    console.error('面积叠加分析失败：', error)
  }
})

// 离开页面或重新绘制前调用；只清理本例资源，保留已有场景数据
function cleanup() {
  tools.destroy()
  overlapLayer.destroy()
  baseLayer.destroy()
  if (!viewer.isDestroyed()) {
    viewer.entities.values
      .filter((entity) => !entitySnapshot.has(entity))
      .forEach((entity) => viewer.entities.remove(entity))
  }
}
```

在线示例另外使用 `TextGroupLayer` 在各交叠分块上标注面积，并通过 `onResult(result)` 更新结果面板；绘制无效区域时通过 `onError(error)` 展示错误并清空旧交集。
