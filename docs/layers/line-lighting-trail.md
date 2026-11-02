# LineLightingTrailLayer 穿梭线

`LineLightingTrailLayer` 沿折线路径展示高亮线芯和流动光晕，适用于线路流向、通道连接和轨迹展示。

## 组件案例

<LayerExamplePreview example="line-lighting-trail" title="LineLightingTrailLayer 穿梭线" :height="500" />

可在“图层示例 → 线面图层 → 穿梭线”中编辑代码并运行。

## 基本用法

```js
import { MapLayers } from 'b-map-viewer'

const layer = new MapLayers.LineLightingTrailLayer(viewer, {
  color: '#ffcc33',
  opacity: 0.8,
  width: 20,
  speed: 5,
  direction: 'forward',
  height: 20,
})

layer.setData([{
  geometry: {
    type: 'LineString',
    coordinates: [[125.789, 44.122], [125.831, 44.165], [125.884, 44.149]],
  },
  properties: { id: 'route-1', name: '连接线路' },
}])

layer.setOptions({ direction: 'reverse', speed: 8 })
layer.stop()
layer.start()

// 页面退出时销毁
layer.destroy()
```

## 配置项

| 字段 | 默认值 | 作用 |
| --- | --- | --- |
| `color` | `'#ffcc33'` | 光晕颜色，支持 CSS 颜色或 `Cesium.Color` |
| `opacity` | `0.8` | 透明度，范围 0～1，与颜色 alpha 相乘 |
| `width` | `20` | 线宽，像素，须大于 0 |
| `speed` | `5` | 穿梭速度，非负数；值越大越快，0 为静态 |
| `direction` | `'forward'` | 流动方向；`'forward'` 沿坐标顺序，`'reverse'` 反向 |
| `height` | `0` | 二维坐标的默认高程，米 |
| `clampToGround` | `false` | 是否贴地显示；开启时忽略坐标高程和 `height` |
| `image` | 内置 `lighting.png` | 光晕纹理图片地址 |
| `autoStart` | `true` | 加载数据后是否自动播放 |

## 数据格式

传入 SDK `{ geometry, properties }` 数组，支持 `LineString` 和 `MultiLineString`。坐标为 WGS84 `[经度, 纬度, 高程?]`，第三维为绝对高程；省略时使用 `height`。每条线至少包含两个不同点。

`properties.id` 为业务标识，支持字符串或数字，同一图层内不可重复；省略时自动生成。同名 `properties` 字段覆盖全局配置，播放和显隐由图层统一控制。

```js
layer.addLayer({
  geometry: {
    type: 'MultiLineString',
    coordinates: [
      [[125.80, 44.13, 50], [125.82, 44.15, 100]],
      [[125.83, 44.16], [125.85, 44.14], [125.86, 44.15]],
    ],
  },
  properties: { id: 'routes', color: '#00e7ff', width: 12, speed: 3 },
})
```

## 方法

| 方法 | 作用 |
| --- | --- |
| `setData(data)` | 替换全部数据并重置进度，保留播放和显隐状态 |
| `addLayer(item)` | 添加一项数据，返回 Entity 或多段线 Entity 数组 |
| `setOptions(options)` / `getOptions()` | 修改 / 获取全局配置；单项配置优先 |
| `getLayerById(id)` / `getLayersById(id)` | 获取业务项的首个 / 全部 Entity |
| `getLayerDataById(id)` | 获取业务数据 |
| `start()` / `stop()` | 继续 / 暂停播放 |
| `resetTime()` | 重置穿梭进度 |
| `show()` / `hide()` | 显示并恢复原播放状态 / 隐藏并暂停推进 |
| `removeLayer(entity)` | 移除该 Entity 所属的完整业务项 |
| `removeLayerById(id)` | 按业务 ID 移除，返回移除的 Entity 数量 |
| `clearLayer()` | 清空本图层数据与效果 |
| `destroy()` / `isDestroyed()` | 销毁图层 / 检查是否已销毁 |
