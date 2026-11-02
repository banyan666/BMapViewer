# WaterFlowLayer 水流面

`WaterFlowLayer` 用于展示河道中的流动水纹、岸边泡沫与水面反射，支持水位、流速、流向和深浅水色配置。

## 组件案例

<LayerExamplePreview example="water-flow" title="WaterFlowLayer 水流面" :height="500" />

示例使用 ArcGIS 影像和长江武汉段水域面数据展示水纹流动效果，不代表真实水文计算结果。可在“图层示例 → 动态效果 → 水流面”中编辑代码并运行。

## 基本用法

```js
import { MapLayers } from 'b-map-viewer'

const layer = new MapLayers.WaterFlowLayer(viewer, {
  height: 20,
  speed: 1.4,
  flowMultiplier: 1.2,
  deepColor: '#061a14',
  shallowColor: '#147a61',
  opacity: 1,
})

layer.setData([{
  geometry: {
    type: 'Polygon',
    coordinates: [[
      [114.280, 30.550], [114.290, 30.562],
      [114.300, 30.556], [114.290, 30.544],
      [114.280, 30.550],
    ]],
  },
  properties: {
    id: 'river-1',
    centerline: {
      type: 'LineString',
      coordinates: [[114.285, 30.547], [114.295, 30.559]],
    },
  },
}])

layer.setOptions({ speed: 2, flowMultiplier: -1.2 })
layer.stop()
layer.start()
layer.flyTo('river-1')

// 页面退出时销毁
layer.destroy()
```

## 配置项

| 字段 | 默认值 | 作用 |
| --- | --- | --- |
| `height` | `0` | 统一水面高程，米 |
| `speed` | `1.4` | 水纹动画速度，非负数，0 为静止 |
| `flowMultiplier` | `1.2` | 沿中心线的流速倍率，负值反向 |
| `centerline` | `null` | 河道中心线，支持 `LineString / MultiLineString` 几何或 SDK 线数据 |
| `flowDirection` | `90` | 未提供中心线时的流向角，正北为 0，顺时针，单位为度 |
| `textureSize` | `512` | 流向分辨率，64～1024 的 2 次幂整数 |
| `wavelength` | `102.5` | 水纹尺度，米，须大于 0 |
| `foamScale` | `1.2` | 泡沫强度，非负数 |
| `foamOffset` | `0.2` | 泡沫生成阈值，0～1 |
| `shoreWidth` | `0.15` | 岸边浅水及透明过渡宽度，须大于 0 |
| `deepColor` | `'#061a14'` | 深水颜色 |
| `shallowColor` | `'#147a61'` | 浅水颜色 |
| `opacity` | `1` | 整体透明度，0～1 |
| `exposure` | `1.68` | 水面亮度增益，非负数 |
| `specularColor` | `'#e0e5e1'` | 高光颜色 |
| `specularIntensity` | `0.3` | 高光强度，非负数 |
| `specularShininess` | `220` | 高光聚拢程度，须大于 0 |
| `specularAA` | `1` | 高光平滑强度，非负数，0 为关闭 |
| `skyColor` | `'#7ab5ad'` | 天空反射颜色 |
| `fresnelIntensity` | `0.14` | 视角反射强度，非负数 |
| `fresnelPower` | `5.8` | 视角反射变化指数，须大于 0 |
| `autoStart` | `true` | 加载数据后是否自动播放 |

颜色字段支持 CSS 颜色或 `Cesium.Color`，整体透明度通过 `opacity` 设置。

## 数据格式

传入 SDK `{ geometry, properties }` 数组，支持 `Polygon`、带孔面和 `MultiPolygon`。坐标使用 WGS84 经纬度，每个环至少包含三个不同点。未闭合的环会自动闭合。跨日期变更线的面需先拆分。

水位统一由 `height` 控制，面坐标第三维不会改变水位。`properties.id` 支持字符串或数字，同一图层内不可重复；省略时自动生成。同名 `properties` 字段覆盖全局配置。

中心线可以放在全局 `centerline` 中，或在单项 `properties.centerline` 中指定；坐标顺序表示流动方向。省略中心线时使用 `flowDirection`。

```js
layer.addLayer({
  geometry: {
    type: 'Polygon',
    coordinates: [[
      [114.31, 30.57], [114.32, 30.58],
      [114.33, 30.575], [114.32, 30.565],
      [114.31, 30.57],
    ]],
  },
  properties: {
    id: 'river-2',
    height: 15,
    speed: 0.8,
    deepColor: '#063a56',
    shallowColor: '#32bdc6',
    centerline: {
      type: 'LineString',
      coordinates: [[114.315, 30.5675], [114.325, 30.5775]],
    },
  },
})
```

## 方法

| 方法 | 作用 |
| --- | --- |
| `setData(data)` | 替换全部数据并重置动画，保留播放与显隐状态 |
| `addLayer(item)` | 添加一项水域，返回 Primitive 或多部分 Primitive 数组 |
| `setOptions(options)` / `getOptions()` | 修改 / 获取全局配置，单项配置优先 |
| `getLayerById(id)` / `getLayersById(id)` | 获取业务项的首个 / 全部 Primitive |
| `getLayerDataById(id)` | 获取业务数据 |
| `flyTo(id?, duration?)` | 定位指定水域或全部水域，动画默认 1.2 秒 |
| `start()` / `stop()` | 继续 / 暂停水纹动画 |
| `resetTime()` | 重置动画进度 |
| `show()` / `hide()` | 显示并恢复原播放状态 / 隐藏并暂停推进 |
| `removeLayer(primitive)` | 移除该 Primitive 所属的完整业务项 |
| `removeLayerById(id)` | 按业务 ID 移除，返回移除的 Primitive 数量 |
| `clearLayer()` | 清空本图层数据与效果 |
| `destroy()` / `isDestroyed()` | 销毁图层 / 检查是否已销毁 |
