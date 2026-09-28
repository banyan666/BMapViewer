# 交互示例中心

在线案例提供独立的底图、图层、工具和天气工作台。运行 `npm run dev` 后，可以完成案例切换、代码修改、重新运行和地图效果检查。

## 工作台结构

- **底图目录**：单独展示离线瓦片、多源地图 Provider、坐标纠偏和自定义切片方案。
- **图层目录**：按点位标注、线面图层、三维场景、动态效果和专题分析分类展示业务图层。
- **天气目录**：展示雨、雪、雾、沙尘、云层和闪电六类后处理效果。
- **代码轨道**：默认折叠在目录右侧；点击 `›` 展开 CodeMirror 6 编辑器，提供 JavaScript 语法高亮、行号、代码折叠、括号匹配、搜索和撤销重做，点击 `‹` 可再次收起。
- **运行控制**：按 `Ctrl/Cmd + Enter` 或点击“运行当前示例”即可重新执行代码；切换案例或恢复默认代码时，编辑器内容会同步更新。
- **地图预览**：持续显示 Cesium 运行结果、执行状态、耗时和地图坐标。

每次切换或重新运行示例时，工作台会清理上一次示例创建的 Entity、DataSource、Primitive、ImageryLayer 和 DOM 资源，避免重复叠加。

## 底图示例模块

示例底图统一读取 `public/tiles` 目录：

```text
public/tiles/{z}/{x}/{reverseY}.png
```

现有瓦片采用 TMS 行号，所以 URL 中使用 Cesium 的 `{reverseY}` 模板变量。离线底图是 `examples/base-maps` 中的默认示例，不再作为 `MapLayers` 图层出现。

底图工作台包含本地瓦片、自定义 Provider、高德、百度、腾讯、ArcGIS、Google、天地图和 GeoVis 示例。需要 Key 的服务会在编辑器中提示填写凭证。

## 图层示例模块

每个 SDK 图层都有一个独立示例模块，统一放在 `examples/layers` 中：

| 分类 | 示例模块 |
| --- | --- |
| 点位标注 | `IconGroupLayer`、`IconClusterLayer`、`LabelGroupLayer`、`TextGroupLayer`、`BubbleLayer`、`BubbleGroupLayer` |
| 线面图层 | `LineGroupLayer`、`LinePrimitiveLayer`、`PolygonPrimitiveLayer`、`LineMaterialLayer`、`CircleGroupLayer`、`MaskLayer` |
| 三维场景 | `Build3DLayer`、`GradientWallLayer`、`DynamicWaterLayer`、`Heatmap3DLayer`、`RadarScanner3DLayer` |
| 动态效果 | `CircleWaveLayer`、`CircleExplosionLayer`、`PointRippleLayer` |
| 专题分析 | `HeatmapLayer`、`HeatmapPrimitiveLayer` |

`Build3DLayer` 直接使用 `public/3d-tiles/tileset.json` 及其关联的本地 GLB 数据，不依赖远程 3D Tiles 服务。

## 编辑器运行上下文

编辑器中的代码是异步函数体，可直接访问以下变量：

```js
viewer          // 当前 Cesium.Viewer
Cesium          // Cesium 命名空间
MapLayers       // SDK 图层模块
buildingTilesetUrl // public/3d-tiles/tileset.json 地址
```

建议在代码最后返回图层实例或清理函数：

```js
const layer = new MapLayers.CircleGroupLayer(viewer, {
  radius: 700,
  fillColor: '#00d9e7',
})

layer.setData([
  {
    geometry: { type: 'Point', coordinates: [125.833, 44.147] },
    properties: { id: 'circle-demo' },
  },
])

return layer
```

工作台会优先调用返回值的 `destroy()`、`removeLayer()` 或清理函数，并对遗漏的 Cesium 资源执行兜底回收。

底图编辑器的运行上下文则提供：

```js
BaseMaps // SDK 底图模块
viewer   // 当前 Cesium.Viewer
tileUrl  // public/tiles 的离线瓦片模板地址
```

天气编辑器的运行上下文提供：

```js
WeatherEffects // SDK 天气模块
viewer         // 当前 Cesium.Viewer
```

天气代码应返回效果实例或清理函数。工作台会在重新运行和切换效果时销毁新建的 `PostProcessStage`，防止多个天气阶段意外叠加。
