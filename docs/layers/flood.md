# FloodLayer 动态淹没水体

以连续的挤出多边形水体展示上升或下降过程。使用 SDK `{ geometry, properties }` 数组，支持 Polygon、带孔洞的 Polygon 和 MultiPolygon。图层只管理水体显示，不请求地形、不计算水动力；面积和体积可配合 `TerrainAnalysis.prepareFlood` 计算。

## 组件案例

图层目录的“动态效果 → 动态淹没水体”提供独立的 `FloodLayer` 示例，使用预设的 SDK 面数据和 Cesium World Terrain 展示水位上升。编辑参数后重新运行，可调整水位、速度、升降方向及外观。下方仅展示地图与水体。

<LayerExamplePreview example="flood" title="FloodLayer 动态淹没水体" :height="500" />

需要通过 `PickTools` 绘制范围、计算面积与体积时，请查看[动态淹没分析](/terrain/flood)。

## 用法

```js
viewer.scene.globe.depthTestAgainstTerrain = true
const water = new MapLayers.FloodLayer(viewer, {
  startHeight: 1000,
  targetHeight: 1400,
  baseHeight: 900,
  speed: 20,
  direction: 'up',
  color: '#409dfd',
  opacity: 0.65,
  onChange(height, state) { console.log(height, state.status) },
  onComplete(height) { console.log('到达目标水位', height) },
})
water.setData([{
  geometry: { type: 'Polygon', coordinates: [coordinates] },
  properties: { id: 'reservoir', name: '淹没范围' },
}])
water.start()
```

`coordinates` 为 WGS84 经纬度数组，第三维不会作为水位使用。环可不闭合；所有数据项共用一个动态水位。地形水下部分由深度检测遮挡，请选择包含沟谷且低于目标水位的区域。

## 配置

| 字段 | 默认值 | 作用 |
| --- | --- | --- |
| `startHeight` | `0` | 起始水位，椭球高米，支持零和负数 |
| `targetHeight` | `100` | 目标水位，椭球高米 |
| `waterHeight` | `startHeight` | 初始当前水位 |
| `baseHeight` | 自动 | 水体底部高程；自动取 `0` 与配置水位中的最低值，显式值不得高于任何配置水位 |
| `speed` | `10` | 正数，米/秒；按真实经过时间变化，不受 Cesium 时钟倍率影响 |
| `direction` | `'up'` | `'up'` 上升或 `'down'` 下降；目标水位须符合当前方向 |
| `color` | `'#409dfd'` | CSS 颜色或 Cesium.Color |
| `opacity` | `0.6` | 透明度，0～1，与颜色本身的 alpha 相乘 |
| `autoStart` | `false` | `setData` 后自动开始 |
| `callbackInterval` | `200` | 水位变化回调间隔，毫秒；0 为逐帧回调，到达目标时总会回调 |
| `onChange(height, state)` | — | 当前水位及状态回调 |
| `onComplete(height, state)` | — | 到达目标水位后的回调 |

`properties` 支持 `id`、`name`、`color`、`opacity`，单项颜色和透明度优先于图层配置。同一图层内 `id` 不重复。

## 方法

| 方法 | 作用 |
| --- | --- |
| `setData(data)` | 替换区域、停止旧动画并重置为配置的初始当前水位 |
| `addLayer(item)` | 增加区域，共用当前水位 |
| `setOptions(options)` | 更新配置并暂停；修改 `startHeight` 时同步重置当前水位，除非同时指定 `waterHeight` |
| `getOptions()` | 获取配置与当前水位 |
| `start()` / `pause()` | 开始或继续 / 暂停；重复 start 不创建多个监听 |
| `setWaterHeight(height)` | 暂停并直接设置水位，触发 onChange |
| `getWaterHeight()` / `getState()` | 当前水位 / 状态（idle、running、paused、completed） |
| `reset()` | 暂停并回到 startHeight，保留区域 |
| `show()` / `hide()` | 显示 / 隐藏；隐藏同时暂停，显示后可调用 start 继续 |
| `getLayerById(id)` / `getLayersById(id)` | 获取数据项的首个 / 全部水体实体 |
| `removeLayer(entity)` / `removeLayerById(id)` | 删除对应数据项；MultiPolygon 一并删除所有分块 |
| `clearLayer()` | 停止动画并移除图层自身区域 |
| `destroy()` / `isDestroyed()` | 销毁并清理监听 / 检查销毁状态 |

清理不会移除其他业务实体，也不会修改 Viewer 的地形、深度检测开关或时钟倍率。区域数据为空时不启动动画。
