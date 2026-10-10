# IconClusterLayer 图标聚合图层

`IconClusterLayer` 用于展示数量较多、分布密集的点位。图层基于 `Cesium.CustomDataSource` 和 `EntityCluster` 实现：相邻图标会按照屏幕像素距离合并为带数量的聚合图标，放大地图后自动拆分为单个图标。

适合设备点位、事件位置、门店、车辆和监测站等大批量点数据。

## 组件案例

<LayerExamplePreview example="icon-cluster" title="IconClusterLayer 图标聚合" />

## 构造函数

```js
new MapLayers.IconClusterLayer(viewer, config)
```

| 参数 | 类型 | 描述 |
| --- | --- | --- |
| `viewer` | `Cesium.Viewer` | Cesium Viewer 实例 |
| `config` | `object` | 图标和聚合配置 |

### config 配置

| 参数 | 类型 | 默认值 | 描述 |
| --- | --- | --- | --- |
| `enabled` | `boolean` | `true` | 是否启用聚合 |
| `pixelRange` | `number` | `36` | 参与聚合的屏幕像素范围，数值越大越容易聚合 |
| `minimumClusterSize` | `number` | `2` | 形成聚合图标所需的最少点数 |
| `icon` | `string / Canvas / Image` | 内置定位图标 | 单个点位的默认图标 |
| `width` | `number` | `34` | 单个图标宽度 |
| `height` | `number` | `42` | 单个图标高度 |
| `color` | `string` | `#ffffff` | 单个图标的叠加颜色 |
| `offset` | `[number, number]` | `[0, 0]` | 单个图标的像素偏移 |
| `disableDepthTestDistance` | `number` | `Infinity` | 超过此距离后关闭深度测试 |
| `clusterStyles` | `Array` | 见下方 | 根据聚合数量设置图标或数字圆标 |
| `clusterTextColor` | `string` | `#ffffff` | 聚合数量文字颜色 |
| `clusterStrokeColor` | `string` | `#d9f8ffff` | 聚合图标描边颜色 |
| `clusterStrokeWidth` | `number` | `2` | 聚合图标描边宽度 |
| `clusterFontSize` | `number` | `15` | 聚合数量的基础字号 |
| `clusterShowText` | `boolean` | `true` | 聚合文字的总开关，false 隐藏所有统计文字 |
| `clusterText` | `string / function` | `'{count}'` | 统计文字模板，支持 `{count}` 或 `(count, entities) => string` |
| `clusterTextPosition` | `string` | `'top'` | 图标模式的文字位置：top、bottom、left、right |
| `clusterTextGap` | `number` | `6` | 图标与文字的间距，单位为像素 |
| `clusterTextOffset` | `[number, number]` | `[0, 0]` | 图标模式文字的额外像素偏移，x 向右、y 向下 |
| `clusterTextOutlineColor` | `string` | `'#071b28'` | 图标模式文字的描边颜色 |
| `clusterTextOutlineWidth` | `number` | `2` | 图标模式文字的描边宽度 |

`clusterStyles` 按 `min` 从小到大匹配。例如聚合数量为 75 时，会使用 `min: 50` 对应的样式。

```js
clusterStyles: [
  { min: 2, size: 34, color: '#1c86d1dd' },
  { min: 50, size: 40, color: '#43b86add' },
  { min: 100, size: 46, color: '#f56c6cdd' },
  { min: 200, size: 52, color: '#e6a23cdd' },
]
```

为了兼容常见 Cesium 聚合案例，也可以使用 `colorArr`，其中的 `num` 等同于 `clusterStyles.min`。

### 图标与统计文字

`clusterStyles` 中传入 `icon` 后，聚合结果显示该图标，并在图标上方显示统计文字。未传 `icon` 时继续使用数字圆标。

| 样式字段 | 类型 | 默认值 | 作用 |
| --- | --- | --- | --- |
| `min` | `number` | 按档位设置 | 使用该样式的最少聚合数量 |
| `icon` | `string / Canvas / Image` | 未设置 | 聚合后的图标 |
| `width` / `height` | `number` | `size` | 聚合图标宽高，单位为像素 |
| `size` | `number` | `34` | 数字圆标直径，以及未设置宽高时的图标尺寸 |
| `color` | `string` | `'#1c86d1dd'` | 数字圆标的填充色，不改变 icon 的颜色 |
| `showText` | `boolean` | `true` | 是否显示当前档位的统计文字；总开关关闭时均隐藏 |
| `text` | `string / function` | `clusterText` | 当前档位的统计文字模板或格式化函数 |
| `textPosition` | `string` | `clusterTextPosition` | 图标模式文字位置：top、bottom、left、right |
| `textGap` | `number` | `clusterTextGap` | 图标与文字的间距 |
| `textOffset` | `[number, number]` | `clusterTextOffset` | 图标模式文字的额外偏移 |
| `textColor` / `fontSize` | `string / number` | 对应全局字段 | 文字颜色和字号 |
| `textOutlineColor` / `textOutlineWidth` | `string / number` | 对应全局字段 | 图标模式文字描边颜色和宽度 |

```js
clusterStyles: [
  {
    min: 2,
    icon: '/images/device-marker.png',
    width: 36,
    height: 46,
    showText: true,
    textPosition: 'top',
    textGap: 6,
    text: '设备 {count} 台',
    textColor: '#ffffff',
    fontSize: 14,
  },
  {
    min: 50,
    icon: '/images/device-cluster.png',
    width: 44,
    height: 54,
    textPosition: 'right',
    text: (count, entities) => '共 ' + count + ' 台设备',
  },
]
```

样式中的文字配置优先于全局默认值。`{count}` 会替换为当前聚合数量；函数的第二个参数是该组的 `Cesium.Entity[]`。数字圆标的文字保持居中，`textPosition`、间距、额外偏移和文字描边用于图标模式。

## 数据格式

`setData` 接受 BMapViewer 点数据数组，也支持 GeoJSON `FeatureCollection`。单个点位的 `properties.icon`、`width`、`height`、`color` 和 `offset` 可以覆盖全局配置。

```js
layer.setData([
  {
    geometry: {
      type: 'Point',
      coordinates: [125.834, 44.147, 0],
    },
    properties: {
      id: 'device-001',
      name: '一号监测设备',
      color: '#8eeeff',
    },
  },
])
```

## 方法

### `setData(data)`

清空旧数据并批量加载点位。返回创建成功的 `Cesium.Entity[]`。

### `load(dataOrUrl)`

异步加载 GeoJSON 对象、URL 或 `Cesium.Resource`。

```js
await layer.load('/data/devices.geojson')
```

### `addLayer(options)`

添加单个点位并返回对应的 `Cesium.Entity`。

### `getLayerById(id)` / `removeLayerById(id)`

根据数据中的 `properties.id` 查询或移除点位。

### `setEnabled(enabled)`

动态开启或关闭聚合。关闭后显示全部单点图标。

### `updateConfig(config)`

更新 `pixelRange`、`minimumClusterSize`、`clusterStyles` 和统计文字配置，并立即触发重新聚合。

```js
// 调整未在样式中单独指定的位置与文字模板
layer.updateConfig({ clusterTextPosition: 'right', clusterText: '共 {count} 台' })

// 隐藏全部聚合文字，保留聚合图标
layer.updateConfig({ clusterShowText: false })
```

### `show()` / `hide()`

显示或隐藏整个数据源。

### `clearLayer()` / `destroy()`

清空数据，或销毁图层并解除聚合事件监听。

## 完整示例

```js
import { MapLayers } from 'b-map-viewer'

const layer = new MapLayers.IconClusterLayer(viewer, {
  icon: '/images/device-marker.png',
  width: 32,
  height: 40,
  pixelRange: 48,
  minimumClusterSize: 2,
  clusterStyles: [
    { min: 2, size: 34, color: '#1c86d1dd' },
    { min: 20, size: 42, color: '#43b86add' },
    { min: 80, size: 50, color: '#f56c6cdd' },
  ],
})

layer.setData(points)

// 页面卸载时
layer.destroy()
```
