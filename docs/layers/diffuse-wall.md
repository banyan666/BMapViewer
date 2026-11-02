# DiffuseWallLayer 扩散墙

`DiffuseWallLayer` 用于在指定点位展示环形扩散墙，适用于事件提示、警戒范围与区域辐射展示。

## 组件案例

<LayerExamplePreview example="diffuse-wall" title="DiffuseWallLayer 扩散墙" :height="500" />


## 基本用法

```js
import { MapLayers } from 'b-map-viewer'

const layer = new MapLayers.DiffuseWallLayer(viewer, {
  color: '#ff4455',
  opacity: 0.8,
  radius: 1000,
  minRadius: 80,
  height: 350,
  heightChange: false,
  duration: 3000,
})

layer.setData([{
  geometry: { type: 'Point', coordinates: [125.834, 44.1475, 0] },
  properties: { id: 'wall-1', name: '警戒范围' },
}])

// 修改参数
layer.setOptions({ color: '#00e7ff', radius: 1500 })

// 开启高度变化
layer.setOptions({ heightChange: true, minHeight: 30 })

// 暂停、继续、重置进度
layer.stop()
layer.start()
layer.resetTime()

// 页面退出时销毁
layer.destroy()
```

## 配置项

| 字段 | 默认值 | 作用 |
| --- | --- | --- |
| `color` | `'#ff4455'` | 墙体颜色，支持 CSS 颜色和 `Cesium.Color` |
| `opacity` | `0.8` | 墙体透明度，范围 0～1，与颜色 alpha 相乘 |
| `radius` | `300` | 最大扩散半径，米，须大于 `minRadius` |
| `minRadius` | `10` | 起始扩散半径，米，须大于 0 |
| `height` | `300` | 初始墙高，米，须大于 0 |
| `heightChange` | `false` | 是否在向外扩散时逐渐降低墙高；关闭时保持 `height` |
| `minHeight` | `30` | 开启高度变化时的最小墙高，米，须大于 0 且不大于 `height` |
| `baseHeight` | `0` | 墙底高程，米 |
| `duration` | `3000` | 单次扩散周期，毫秒，须大于 0 |
| `speed` | `1` | 播放倍速；2 为双倍速，0 为静止在起始状态 |
| `slices` | `128` | 圆周分段数，3～4096 的整数 |
| `autoStart` | `true` | 加载数据后是否自动播放 |

每个周期结束后，半径恢复到 `minRadius` 并重新扩散。开启 `heightChange` 时，墙高也会恢复到 `height`。

## 数据格式

传入 SDK `{ geometry, properties }` 数组。`geometry.type` 使用 `Point`，坐标为 WGS84 `[经度, 纬度, 墙底高程?]`。未传第三维时使用 `baseHeight`，单项 `properties.baseHeight` 优先。

`properties.id` 为业务标识，支持字符串或数字，同一图层内不可重复；省略时自动生成。同名 `properties` 配置优先于全局配置，播放与显隐由图层统一控制。

```js
layer.setData([
  {
    geometry: { type: 'Point', coordinates: [125.834, 44.1475, 0] },
    properties: { id: 'warning-a', color: '#ff4455', radius: 1000 },
  },
  {
    geometry: { type: 'Point', coordinates: [125.85, 44.16, 20] },
    properties: {
      id: 'warning-b',
      color: '#00e7ff',
      radius: 600,
      height: 200,
      heightChange: true,
      minHeight: 20,
    },
  },
])
```

## 方法

| 方法 | 作用 |
| --- | --- |
| `setData(data)` | 替换全部数据并重置扩散进度，保留当前播放和显隐状态 |
| `addLayer(item)` | 添加一个点位，返回对应的 Primitive |
| `setOptions(options)` | 修改全局配置；单项配置优先 |
| `getOptions()` | 获取全局配置 |
| `getLayerById(id)` | 按业务 ID 获取 Primitive |
| `getLayerDataById(id)` | 获取业务数据 |
| `getState(id)` | 获取当前的 `id`、`center`、`phase`、`radius`、`height`；半径和墙高单位为米，进度范围为 0～1 |
| `start()` / `stop()` | 播放或继续 / 暂停 |
| `resetTime()` | 重置所有点位的扩散进度 |
| `show()` / `hide()` | 显示并恢复播放 / 隐藏并暂停推进；已暂停的图层显示后仍保持暂停 |
| `removeLayer(primitive)` | 移除指定 Primitive |
| `removeLayerById(id)` | 按业务 ID 移除，返回移除数量 |
| `clearLayer()` | 清空本图层的数据和效果 |
| `destroy()` / `isDestroyed()` | 销毁图层 / 检查是否已销毁 |
