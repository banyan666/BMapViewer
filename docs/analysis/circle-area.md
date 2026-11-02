# SpatialAnalysis 圆面积分析

`getCircleArea(center, radius, options?)` 根据 WGS84 圆心和地表半径计算圆面积，返回周长、半径、直径及对应单位。无需传入 Viewer，可直接接收 `PickTools.pickCircle()` 返回的 `center` 和 `radius`。

## 组件案例

<SdkExamplePreview category="analysis" example="circle-area-pick" title="SpatialAnalysis 圆面积分析" />

第一次单击确定圆心，第二次单击确定半径。完成后在地图中显示面积、半径和周长，拖动圆心或边缘控制点可更新结果。可在[在线示例](https://banyan666.github.io/BMapViewer/#/spatial-analysis)中切换到“圆面积分析”，编辑单位配置，查看 `CALLBACK RESULT` 中的完整返回数据。

## 使用方法

```js
import { SpatialAnalysis } from 'b-map-viewer'

const analysis = new SpatialAnalysis({
  unit: 'km',     // 半径、直径和周长单位
  areaUnit: 'km2', // 面积单位
})

const result = analysis.getCircleArea([125.823, 44.148], 1)
console.log(result.area)          // 约 3.14159265
console.log(result.unit)          // 'km2'
console.log(result.perimeter)     // 约 6.28319
console.log(result.perimeterUnit) // 'km'
console.log(result.center)        // [125.823, 44.148]
console.log(result.radius)        // 1
console.log(result.radiusUnit)    // 'km'
console.log(result.diameter)      // 2，单位同 radiusUnit

// 单次配置：此时传入的半径 1000 表示 1000 m
const meters = analysis.getCircleArea([125.823, 44.148], 1000, {
  unit: 'm',
  areaUnit: 'm2',
})
```

## 参数与单位

| 参数 | 默认值 | 作用 |
| --- | --- | --- |
| `center` | 必填 | 圆心 `[经度, 纬度]`，经度范围 -180～180，纬度范围 -90～90；忽略第三维高度 |
| `radius` | 必填 | 有限正数半径，单位由 `unit` 指定 |
| `options.unit` | 实例配置，初始为 `'m'` | 输入半径及返回半径、直径、周长的单位：`m`、`km`，也接受 `meters`、`kilometers` |
| `options.areaUnit` | 实例配置，初始为 `'m2'` | 面积单位：`m2`、`km2`、`ha`，也接受 `m²`、`km²` |

构造函数和 `updateConfig()` 设置默认单位，方法的 `options` 仅对本次调用生效。

```js
analysis.updateConfig({ unit: 'km', areaUnit: 'ha' })
const result = analysis.getCircleArea([125.823, 44.148], 0.5) // 半径 500 米
```

`PickTools` 和 `SpatialAnalysis` 使用相同的 `unit`，拾取半径即可直接用于分析，无需手动换算。在线示例统一配置 `unit: 'km'`、`areaUnit: 'km2'`，面积显示 km²，半径、直径和周长显示 km。两者未配置时均默认使用米。

## 返回结果

| 字段 | 类型 | 作用 |
| --- | --- | --- |
| `area` | `number` | 圆面积，单位见 `unit` |
| `unit` | `'m2' / 'km2' / 'ha'` | 面积单位 |
| `perimeter` | `number` | 圆的边界周长 |
| `perimeterUnit` | `'m' / 'km'` | 周长单位 |
| `center` | `number[]` | 圆心 `[经度, 纬度]`，为独立数组 |
| `radius` | `number` | 输入的圆半径 |
| `radiusUnit` | `'m' / 'km'` | 半径及直径单位 |
| `diameter` | `number` | 半径的两倍，单位同 `radiusUnit` |

计算采用 Turf 的地球半径与单位换算，使用球面圆解析公式，不依赖多边形采样步数。设地球半径为 `R`，米制圆半径为 `r`，面积为 `4πR² sin²(r / 2R)`，周长为 `2πR sin(r / R)`。局部小范围内接近 `πr²` 和 `2πr`，大范围时与平面公式存在差异。

所有数值保留计算精度，不包含地形起伏和高度差。圆心不合法、半径非正数或非有限数、半径达到地球半周长，以及小到无法表示正面积时会抛出错误；输入数组不会被修改。

## 配合 pickCircle 和文字图层

```js
import { SpatialAnalysis, PickTools, MapLayers } from 'b-map-viewer'

const analysis = new SpatialAnalysis({ unit: 'km', areaUnit: 'km2' })
const entitySnapshot = new Set(viewer.entities.values)
const labels = new MapLayers.TextGroupLayer(viewer, {
  fontSize: 16,
  color: '#e9ffdc',
  showBackground: true,
  backgroundColor: 'rgba(6, 26, 31, 0.94)',
  offset: [0, -64],
  enableCollisionDetection: false,
})
const tools = new PickTools(viewer, {
  unit: 'km', // 与 SpatialAnalysis 保持一致
  color: '#a3d68a',
  lineWidth: 3,
  fillOpacity: 0.22,
  isReserve: true,
})

tools.pickCircle(({ center, radius }) => {
  try {
    const result = analysis.getCircleArea(center, radius)
    labels.setData([{
      geometry: { type: 'Point', coordinates: result.center },
      properties: {
        id: 'circle-area-result',
        text: '面积：' + result.area.toFixed(4) + ' km²\n半径：' + result.radius.toFixed(3) + ' km\n周长：' + result.perimeter.toFixed(3) + ' km',
      },
    }])
    console.log('SpatialAnalysis.getCircleArea 返回结果：', result)
  } catch (error) {
    labels.clearLayer()
    console.error('圆面积分析失败：', error)
  }
})

// 离开页面或重新绘制前调用
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

在线示例通过 `onResult(result)` 更新结果面板和 JSON 面板，通过 `onError(error)` 展示分析错误并清空旧结果。文档内组件案例仅展示地图、绘制效果及结果标注。
