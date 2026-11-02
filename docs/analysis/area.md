# SpatialAnalysis 面积分析

`getArea(coordinates, options?)` 使用 Turf 计算单个多边形区域的球面面积，并返回周长、中心点、顶点数和闭合坐标。直接接受 `PickTools.pickPolygon()` 返回的坐标组，无需传入 Viewer。

圆形区域可使用 [`getCircleArea(center, radius)`](/analysis/circle-area)，直接传入圆心和半径。

两区域的重叠面积及交集几何可使用 [`getOverlapArea(firstCoordinates, secondCoordinates)`](/analysis/overlap-area)。

## 组件案例

<SdkExamplePreview category="analysis" example="area-pick" title="SpatialAnalysis 面积分析" />

左键依次添加顶点，双击结束绘制。完成后显示面积和周长，拖拽顶点后自动更新。可在[在线示例](https://banyan666.github.io/BMapViewer/#/spatial-analysis)中切换到“面积分析”，编辑代码和单位配置，查看 `CALLBACK RESULT` 中的完整返回数据。

## 使用方法

```js
import { SpatialAnalysis } from 'b-map-viewer'

const analysis = new SpatialAnalysis({
  unit: 'm',      // 周长的距离单位
  areaUnit: 'm2', // 面积单位
})

const coordinates = [
  [125.80, 44.15],
  [125.84, 44.15],
  [125.84, 44.12],
  [125.80, 44.12],
]

const result = analysis.getArea(coordinates)
console.log(result.area)          // 约 10648684.77
console.log(result.unit)          // 'm2'
console.log(result.perimeter)     // 约 13056.09
console.log(result.perimeterUnit) // 'm'
console.log(result.center)        // 约 [125.82, 44.135]

// 单次覆盖单位，不改变实例默认配置
const kilometers = analysis.getArea(coordinates, {
  areaUnit: 'km2',
  unit: 'km',
})
```

## 配置参数

构造函数、`updateConfig` 和 `getArea` 的单次配置使用相同字段。

| 参数 | 默认值 | 作用 |
| --- | --- | --- |
| `areaUnit` | `'m2'` | 面积单位：`m2` 平方米、`km2` 平方千米、`ha` 公顷；也接受 `m²`、`km²`，返回时统一为 `m2`、`km2` |
| `unit` | `'m'` | 周长的距离单位：`m` 米、`km` 千米；也支持 `meters`、`kilometers` |

```js
analysis.updateConfig({ areaUnit: 'ha', unit: 'km' })
const result = analysis.getArea(coordinates)
```

## 坐标约定

传入至少三个不共线的 `[经度, 纬度]` 顶点，按边界顺序排列。支持未闭合或已闭合的单个外环；方法自动补齐闭合边，周长包含最后一个顶点回到首点的距离。

连续重复点会被合并，闭合首点不计入顶点数。输入数组不会被修改；第三维高度不参与计算。点数不足、非法坐标、重复的非相邻顶点、自相交或退化区域会抛出错误。

本方法面向局部区域，支持跨越 ±180° 经线的局部多边形，不支持孔洞、多区域和环绕极点的区域。面积和周长不包含地形起伏。

## 返回结果

| 字段 | 类型 | 作用 |
| --- | --- | --- |
| `area` | `number` | 多边形面积，单位见 `unit` |
| `unit` | `'m2' / 'km2' / 'ha'` | 面积单位 |
| `perimeter` | `number` | 闭合边界的总距离 |
| `perimeterUnit` | `'m' / 'km'` | 周长单位 |
| `center` | `number[]` | Turf 计算的多边形质心 `[经度, 纬度]`；凹多边形的质心可能位于区域外 |
| `vertexCount` | `number` | 有效顶点数，不含重复的闭合首点 |
| `coordinates` | `number[][]` | 规范化后的闭合边界坐标，首尾相同且为独立数组 |

所有数值保留计算精度，可在展示时自行使用 `toFixed`。

## 配合 pickPolygon 和文字图层

```js
import { SpatialAnalysis, PickTools, MapLayers } from 'b-map-viewer'

const analysis = new SpatialAnalysis({ unit: 'km', areaUnit: 'km2' })
const entitySnapshot = new Set(viewer.entities.values)
const labels = new MapLayers.TextGroupLayer(viewer, {
  fontSize: 16,
  showBackground: true,
  backgroundColor: 'rgba(6, 26, 31, 0.94)',
  color: '#e9ffdc',
  enableCollisionDetection: false,
})
const tools = new PickTools(viewer, {
  color: '#a3d68a',
  lineWidth: 3,
  isReserve: true,
})

tools.pickPolygon((coordinates) => {
  try {
    const result = analysis.getArea(coordinates)
    labels.setData([{
      geometry: { type: 'Point', coordinates: result.center },
      properties: {
        id: 'area-result',
        text: '面积：' + result.area.toFixed(4) + ' km²\n周长：' + result.perimeter.toFixed(3) + ' km',
      },
    }])
    console.log('SpatialAnalysis.getArea 返回结果：', result)
  } catch (error) {
    labels.clearLayer()
    console.error('面积分析失败：', error)
  }
})

// 离开页面或重新开始时调用
function cleanup() {
  tools.destroy()
  labels.destroy()
  if (!viewer.isDestroyed()) {
    viewer.entities.values
      .filter((entity) => !entitySnapshot.has(entity))
      .forEach((entity) => viewer.entities.remove(entity))
  }
}
```

在线示例通过 `onResult(result)` 同步更新地图结果面板和 JSON 面板；绘制无效区域时通过 `onError(error)` 显示错误，可拖动顶点修正或重新绘制。
