# TextGroupLayer Canvas 文字组图层

`TextGroupLayer` 用于在 Cesium 中批量渲染高 DPI Canvas 文字。图层基于 `Cesium.BillboardCollection`，每条文字先绘制到 Canvas，再作为 Billboard 贴图加入场景，适合城市名称、设备名称、专题标注等需要自定义字体、背景和边框的大批量文字场景。

图层内置屏幕空间碰撞检测。相机移动或缩放时会重新计算文字矩形，自动隐藏发生明显重叠的文字，避免密集数据全部堆叠在一起。

## 组件案例

<LayerExamplePreview example="text-group" title="TextGroupLayer Canvas 文字与碰撞检测" />

## 构造函数

```js
new MapLayers.TextGroupLayer(viewer, config)
```

| 参数 | 类型 | 描述 |
| --- | --- | --- |
| `viewer` | `Cesium.Viewer` | Cesium Viewer 实例 |
| `config` | `object` | 全局文字样式、距离缩放和碰撞配置 |

## config 参数

### Canvas 文字样式

| 参数 | 类型 | 默认值 | 描述 |
| --- | --- | --- | --- |
| `text` | `string` | `'text'` | 数据未提供文字时使用的默认内容 |
| `dpr` | `number` | `1` | Canvas 清晰度倍率，会与设备像素比相乘 |
| `maxWidth` | `number` | `180` | 文字最大宽度，超出部分使用省略号 |
| `fontSize` | `number` | `18` | 字号，单位为 CSS 像素 |
| `fontFamily` | `string` | Microsoft YaHei 等 | Canvas 字体族 |
| `fontWeight` | `number \| string` | `600` | 字重 |
| `fontStyle` | `string` | `'normal'` | 字体样式 |
| `lineHeight` | `number` | `1.25` | 文字行高倍数 |
| `color` | `string` | `'#ffffff'` | 文字颜色 |
| `showBackground` | `boolean` | `false` | 是否绘制文字背景 |
| `backgroundColor` | `string` | `'transparent'` | Canvas 背景色 |
| `padding` | `number \| number[]` | `[6, 3]` | 水平、垂直内边距；传数字时两方向相同 |
| `border` | `boolean` | `false` | 是否绘制边框 |
| `borderColor` | `string` | `'#ffffff'` | 边框颜色 |
| `borderWidth` | `number` | `1` | 边框宽度 |
| `borderRadius` | `number` | `2` | 背景和边框圆角 |
| `textAlign` | `string` | `'center'` | 文字对齐：`left`、`center`、`right` |
| `overflowMode` | `string` | `'ellipsis'` | 超过 `maxWidth` 时使用 `ellipsis` 省略或 `wrap` 自动换行 |
| `shadowColor` | `string` | `rgba(0,0,0,.65)` | 文字阴影颜色 |
| `shadowBlur` | `number` | `2` | 文字阴影模糊半径 |

### Billboard 与距离控制

| 参数 | 类型 | 默认值 | 描述 |
| --- | --- | --- | --- |
| `offset` | `number[]` | `[0, 0]` | 屏幕像素偏移 `[x, y]` |
| `scale` | `number` | `1` | Billboard 基础缩放值 |
| `scaleByDistance` | `Cesium.NearFarScalar \| number[] \| object` | `[150000, 1, 400000, 0.5]` | 按相机距离缩放，可使用 `[near, nearValue, far, farValue]` |
| `pixelOffsetScaleByDistance` | 同上 | `null` | 按相机距离缩放像素偏移 |
| `distanceDisplayCondition` | `Cesium.DistanceDisplayCondition \| number[] \| object` | `null` | 显示距离范围，可使用 `[near, far]` |
| `horizontalOrigin` | Cesium 枚举或字符串 | `CENTER` | 水平锚点，也支持 `left/center/right` |
| `verticalOrigin` | Cesium 枚举或字符串 | `CENTER` | 垂直锚点，也支持 `top/center/bottom` |
| `disableDepthTestDistance` | `number` | `Infinity` | 超过该距离后禁用深度测试 |
| `allowClick` | `boolean` | `false` | 是否允许 Billboard 参与拾取 |

### 碰撞检测

| 参数 | 类型 | 默认值 | 描述 |
| --- | --- | --- | --- |
| `enableCollisionDetection` | `boolean` | `true` | 是否启用文字碰撞检测 |
| `collisionThreshold` | `number` | `0.2` | 相交面积占较小文字面积的阈值，范围 `0-1` |
| `collisionPadding` | `number` | `2` | 每个文字碰撞矩形向外扩展的像素数 |
| `collisionCellSize` | `number` | `96` | 碰撞候选网格尺寸，单位为屏幕像素 |
| `hideStrategy` | `string` | `'distance'` | 保留策略：`distance`、`smaller`、`newer`、`priority` |

策略说明：

- `distance`：优先显示更靠近屏幕中心的文字；
- `smaller`：优先显示占用屏幕面积更大的文字；
- `newer`：优先显示更早加入图层的文字；
- `priority`：优先显示 `properties.priority` 数值更高的文字。

无论使用哪种策略，`properties.priority` 都会作为第一优先级，数值越高越不容易被隐藏。

## 数据格式

`setData` 接收符合 SDK [点数据规范](/data.html#点)的数组，也支持 GeoJSON `Feature` 和 `FeatureCollection`。坐标统一使用 `[经度, 纬度, 高度]`：

```js
[
  {
    geometry: {
      type: 'Point',
      coordinates: [125.8337, 44.1471, 30],
    },
    properties: {
      id: 'jiutai-center',
      text: '九台城区',
      color: '#8ff7ff',
      priority: 10,
    },
  },
]
```

每条数据的 `properties` 可以覆盖全局的文字样式、距离控制和 Billboard 参数。文字内容按以下顺序读取：

```text
properties.text → properties.name → item.text → item.name → config.text
```

## 方法

### `setData(data)`

清空现有数据并批量添加文字，返回创建成功的 `Cesium.Billboard[]`。

### `addLayer(item)`

添加单条 SDK 点数据，返回 `Cesium.Billboard | null`。

### `updateLayerById(id, options)`

根据 ID 更新坐标、文字或单项样式，并重新生成对应 Canvas。

```js
layer.updateLayerById('jiutai-center', {
  properties: {
    text: '九台区中心',
    color: '#ffe082',
    priority: 20,
  },
})
```

### `getLayerById(id)`

返回对应的 `Cesium.Billboard`，找不到时返回 `null`。

### `removeLayer(billboard)` / `removeLayerById(id)`

移除指定文字。

### `setCollisionEnabled(enabled)`

运行时开启或关闭碰撞检测。

### `setCollisionThreshold(value)`

运行时设置 `0-1` 之间的碰撞阈值。

### `updateConfig(config, redraw = true)`

合并全局配置。默认重新绘制现有文字；第二个参数传 `false` 时只更新配置。

### `show()` / `hide()`

显示或隐藏整个文字图层。

### `clearLayer()` / `destroy()`

清空文字，或销毁图层并移除 `postRender` 碰撞监听。

## 使用示例

```js
import { MapLayers } from 'b-map-viewer'

const textLayer = new MapLayers.TextGroupLayer(viewer, {
  dpr: 1.4,
  fontSize: 18,
  color: '#dffaff',
  showBackground: true,
  backgroundColor: 'rgba(4, 28, 42, 0.72)',
  padding: [9, 5],
  border: true,
  borderColor: '#37e0eb',
  overflowMode: 'wrap',
  enableCollisionDetection: true,
  collisionThreshold: 0.2,
  hideStrategy: 'priority',
  scaleByDistance: [3000, 1, 80000, 0.55],
})

textLayer.setData([
  {
    geometry: { type: 'Point', coordinates: [125.8337, 44.1471, 30] },
    properties: { id: 'center', text: '九台城区', priority: 10 },
  },
  {
    geometry: { type: 'Point', coordinates: [125.839, 44.149, 30] },
    properties: { id: 'station', text: '九台站', priority: 5 },
  },
])
```

## 性能说明

- 图层使用一个 `BillboardCollection` 批量提交文字，避免为每条数据创建 DOM；
- Canvas 按“文字 + 样式”缓存，相同内容和样式可以复用纹理；
- 碰撞检测使用屏幕网格筛选相邻候选，避免对所有文字进行无差别的两两比较；
- `dpr` 越大文字越清晰，但 Canvas 内存和纹理上传成本也越高，大数据量建议保持在 `1-1.5`；
- 碰撞检测只处理当前屏幕内的文字；大量数据下可适当增大 `collisionPadding`，或配合 `distanceDisplayCondition` 限制显示距离；
- 页面卸载时必须调用 `destroy()`，以释放 Primitive、Canvas 缓存和场景事件监听。
