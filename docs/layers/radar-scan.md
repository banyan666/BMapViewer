# RadarScanLayer 雷达扫描图层

`RadarScanLayer` 根据场景深度将旋转扫描区域投射到可见地表与模型表面。它是二维雷达扫描后处理效果，与半球实体实现的 `RadarScanner3DLayer` 独立。

## 组件案例

<LayerExamplePreview example="radar-scan" title="RadarScanLayer 雷达扫描" />

## 构造函数

`new MapLayers.RadarScanLayer(viewer, config)`

| 参数 | 类型 | 默认值 | 作用 |
| --- | --- | --- | --- |
| `viewer` | `Cesium.Viewer` | 必填 | 承载后处理阶段的 Viewer |
| `config.radius` | `number` | `1000` | 扫描半径，单位为米 |
| `config.color` | CSS 颜色或 `Cesium.Color` | `'#00f5dc'` | 扫描颜色 |
| `config.opacity` | `number` | `0.8` | 扫描透明度，范围 0–1；与颜色自身的 alpha 相乘 |
| `config.duration` | `number` | `3000` | 完成一圈扫描所需时间，单位为毫秒 |
| `config.showOuterRing` | `boolean` | `true` | 是否显示扫描半径处的外圈 |
| `config.direction` | `string` | `'clockwise'` | `'clockwise'` 顺时针，`'counterclockwise'` 逆时针 |
| `config.startAngle` | `number` | `0` | 初始扫描方向，正北为 0°，顺时针为正 |
| `config.autoStart` | `boolean` | `true` | 加载数据后是否立即旋转 |

## 数据格式

传入符合 SDK [点数据规范](/data#点) 的数组。`geometry.coordinates` 为 `[经度, 纬度, 高度?]`，高度默认 0 米；`properties` 可使用与构造函数相同的字段覆盖单个扫描点的样式，并可指定 `id`。

```js
const layer = new MapLayers.RadarScanLayer(viewer, {
  radius: 1800,
  color: '#2de8dc',
  showOuterRing: true,
  direction: 'clockwise',
})

layer.setData([
  {
    geometry: { type: 'Point', coordinates: [125.8337, 44.1471, 0] },
    properties: { id: 'radar-a', duration: 3600 },
  },
  {
    geometry: { type: 'Point', coordinates: [125.8500, 44.1550, 0] },
    properties: {
      id: 'radar-b',
      radius: 900,
      color: '#70aaff',
      showOuterRing: false,
      direction: 'counterclockwise',
    },
  },
])
```

## 方法

| 方法 | 作用 |
| --- | --- |
| `setData(features)` | 替换全部扫描点，返回图层实例 |
| `addLayer(feature)` | 添加一个点，返回对应 `Cesium.PostProcessStage` |
| `setOptions(options)` | 修改全局参数；已加载且未单独覆盖的点会立即更新 |
| `getLayerById(id)` | 获取对应的后处理阶段 |
| `getLayerDataById(id)` | 获取对应的原始数据 |
| `removeLayer(stage)` / `removeLayerById(id)` | 移除指定扫描点 |
| `start()` / `stop()` | 开始或暂停旋转，暂停时保留当前角度 |
| `show()` / `hide()` | 显示或隐藏全部扫描效果 |
| `clearLayer()` | 清空全部后处理阶段 |
| `destroy()` | 清理阶段、动画定时器与 Viewer 引用 |

扫描依赖 Cesium 的深度纹理，只对深度纹理中可见的场景表面着色，天空不会被扫描效果覆盖。图层加载时会临时开启 `viewer.scene.globe.depthTestAgainstTerrain`，全部扫描点移除后恢复原值；多个 `RadarScanLayer` 共用同一 Viewer 时会等最后一个图层清理后再恢复。
