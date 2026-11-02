# CircleBlurLayer 模糊圆

`CircleBlurLayer` 用于展示边缘柔化的圆形覆盖范围，支持颜色、透明度、半径和呼吸效果配置。

## 组件案例

<LayerExamplePreview example="circle-blur" title="CircleBlurLayer 模糊圆" :height="500" />

可在“图层示例 → 线面图层 → 模糊圆”中编辑代码并运行。

## 基本用法

```js
import { MapLayers } from 'b-map-viewer'

const layer = new MapLayers.CircleBlurLayer(viewer, {
  color: '#ff4d4f',
  radius: 1500,
  opacity: 1,
  breathing: false,
})

layer.setData([{
  geometry: { type: 'Point', coordinates: [125.834, 44.1475] },
  properties: { id: 'circle-1', name: '覆盖范围' },
}])

// 开启呼吸效果
layer.setOptions({ breathing: true, speed: 3 })

// 关闭呼吸，恢复静态效果
layer.setOptions({ breathing: false })

// 页面退出时销毁
layer.destroy()
```

## 配置项

| 字段 | 默认值 | 作用 |
| --- | --- | --- |
| `color` | `'#ff4d4f'` | CSS 颜色或 `Cesium.Color` |
| `opacity` | `1` | 透明度，范围 0～1，与颜色 alpha 相乘 |
| `radius` | `1500` | 圆形覆盖范围半径，米，须大于 0 |
| `height` | `0` | 圆所在的高程，米 |
| `blur` | `10` | 边缘衰减指数，须大于 0；值越大，颜色越集中于圆心 |
| `brightness` | `3` | 亮度倍率，非负数 |
| `breathing` | `false` | 是否开启循环呼吸效果 |
| `speed` | `3` | 呼吸速度，非负数；越大越快，0 为静态 |
| `autoStart` | `true` | 开启呼吸后是否自动播放 |

`radius` 为覆盖范围，模糊效果在范围内逐渐衰减。`breathing: false` 时保持静态；`stop()` 可暂停并保留当前呼吸状态，`start()` 继续播放。

## 数据格式

传入 SDK `{ geometry, properties }` 数组，`geometry.type` 使用 `Point`。坐标为 WGS84 `[经度, 纬度, 高程?]`，省略高程时使用全局 `height`；单项 `properties.height` 优先。

`properties.id` 为业务标识，支持字符串或数字，同一图层内不可重复；省略时自动生成。同名 `properties` 字段覆盖全局配置，播放与显隐由图层统一控制。

```js
layer.setData([
  {
    geometry: { type: 'Point', coordinates: [125.827, 44.149] },
    properties: { id: 'static', color: '#00e7ff', radius: 1200, breathing: false },
  },
  {
    geometry: { type: 'Point', coordinates: [125.85, 44.145, 20] },
    properties: { id: 'animated', color: '#ff4d4f', radius: 1600, breathing: true, speed: 4 },
  },
])
```

## 方法

| 方法 | 作用 |
| --- | --- |
| `setData(data)` | 替换全部数据并重置呼吸进度，保留播放和显隐状态 |
| `addLayer(item)` | 添加一个模糊圆，返回 Entity |
| `setOptions(options)` / `getOptions()` | 修改 / 获取全局配置；单项配置优先 |
| `getLayerById(id)` | 按业务 ID 获取 Entity |
| `getLayerDataById(id)` | 获取业务数据 |
| `start()` / `stop()` | 继续 / 暂停呼吸；不会改变 `breathing` 配置 |
| `resetTime()` | 重置呼吸进度 |
| `show()` / `hide()` | 显示并恢复原播放状态 / 隐藏并暂停推进 |
| `removeLayer(entity)` | 移除指定 Entity |
| `removeLayerById(id)` | 按业务 ID 移除，返回移除数量 |
| `clearLayer()` | 清空本图层数据与效果 |
| `destroy()` / `isDestroyed()` | 销毁图层 / 检查是否已销毁 |
