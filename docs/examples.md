# 交互示例中心

在线案例提供独立的底图、图层、工具、空间分析和天气工作台。运行 `npm run dev` 后，可以完成案例切换、代码修改、重新运行和地图效果检查。

## 工作台结构

- **底图目录**：单独展示离线瓦片、多源地图 Provider、坐标纠偏和自定义切片方案。
- **图层目录**：按点位标注、线面图层、三维场景、动态效果和专题分析分类展示业务图层。
- **天气目录**：展示雨、雪、雾、沙尘、云层和闪电六类后处理效果。
- **空间分析目录**：通过 PickTools 拾取点、线、面和圆，演示测量、缓冲区、范围查询、最近距离、区域运算、穿越与覆盖分析。
- **代码轨道**：默认折叠在目录右侧；点击 `›` 展开 CodeMirror 6 编辑器，提供 JavaScript 语法高亮、行号、代码折叠、括号匹配、搜索和撤销重做，点击 `‹` 可再次收起。
- **运行控制**：按 `Ctrl/Cmd + Enter` 或点击“运行当前示例”即可重新执行代码；切换案例或恢复默认代码时，编辑器内容会同步更新。
- **地图预览**：持续显示 Cesium 运行结果、执行状态、耗时和地图坐标。

每次切换或重新运行示例时，工作台会清理上一次示例创建的 Entity、DataSource、Primitive、ImageryLayer 和 DOM 资源，避免重复叠加。

## 底图示例模块

示例默认读取 `public/tiles` 目录作为离线底图；流动线案例使用 ArcGIS 卫星影像展示城市路网：

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
| 线面图层 | `LineGroupLayer`、`LinePrimitiveLayer`、`PolygonPrimitiveLayer`、`LineMaterialLayer`、`FlowLineLayer`、`CircleGroupLayer`、`MaskLayer` |
| 三维场景 | `Build3DLayer`、`GradientWallLayer`、`Heatmap3DLayer`、`RadarScanner3DLayer` |
| 动态效果 | `DynamicWaterLayer`、`CircleWaveLayer`、`CircleExplosionLayer`、`PointRippleLayer`、`RadarScanLayer` |
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

## 空间分析示例模块

空间分析包含 12 个计算方法及 14 个案例，其中缓冲区分别提供点、线、面案例。新增案例也支持左侧代码编辑、重新运行、返回数据打印与文档纯地图预览。所有业务数据为本地生成，不依赖第三方业务接口。

| 方法 | 示例标识 |
| --- | --- |
| getBuffer | buffer-point、buffer-line、buffer-polygon |
| getPointsInPolygon | points-in-polygon |
| getNearestPointOnLine | nearest-point-on-line |
| getNearbyFeatures | nearby-features |
| getDifferenceArea | difference-area |
| getUnionArea | union-area |
| getLineInPolygon | line-in-polygon |
| getCoverage | coverage |

在预览链接中使用 `?analysis-preview=<示例标识>` 可加载对应纯地图案例。编辑器中的 `createScene` 等函数是当前示例代码自带的图层辅助函数，不属于 SDK 分析 API；可在编辑器中展开阅读和修改，使用后会销毁自己创建的图层、实体与监听。

全部空间 API 与输入输出约定详见[分析总览](/analysis/)。

## 三维分析示例

主页的“三维分析”提供 8 个可编辑案例：地形高程、地形剖面、贴地距离、地表面积、坡度坡向、地形通视、挖填方和动态淹没分析。

所有案例使用 ArcGIS 影像与 Cesium World Terrain，默认镜头定位 117.93234、43.78764。地形就绪后自动进入 `PickTools` 拾取状态，**不使用预置坐标自动计算**。点位单击完成，线、面双击结束后分析；保留控制点供拖拽修改，结束拖动后自动更新结果。“重新绘制”会清空旧结果并重新拾取。

结果按 SDK 的 `{ geometry, properties }` 规范交给 `MapLayers.TextGroupLayer`、`LineGroupLayer` 和 `PolygonPrimitiveLayer` 展示；山区面色块使用 `clampToGround: true`，淹没水面使用固定水位高度。代码编辑器可修改采样间距、网格大小、设计高程、水位或观察点高度，返回数据同步显示在回调区。挖填方设计面和淹没水位的初始参考高程取自本次绘制的首个顶点，不使用固定地理位置。

每个案例独立展示 `PickTools → TerrainAnalysis → MapLayers` 调用，不附带其他分析方法的渲染分支。`PickTools` 通过 `includeHeight: true` 返回含高程的坐标；任务取消、拾取实体隔离和切换清理由工作台统一处理。

地形剖面与贴地距离案例显示高程剖面图；文档组件案例只显示地图。采样计算、单位及精度限制见[三维分析文档](/analysis/terrain)。

从主页进入“空间分析”，可运行 `examples/analysis` 下的距离、多边形面积、圆面积和面积叠加分析，目录副标题对应 `getDistance`、`getArea`、`getCircleArea` 和 `getOverlapArea`。`pickLine`、`pickPolygon` 返回的坐标直接传给对应分析方法；圆面积示例统一使用 `unit: 'km'`、`areaUnit: 'km2'`。叠加示例先绘制红色默认区域，再通过 `pickPolygon` 绘制绿色区域，使用面图层高亮蓝色交集。编辑器提供 `SpatialAnalysis`、`PickTools`、`MapLayers`、`viewer`、`onResult` 和 `onError`。

`onResult(result)` 用于更新工作台结果面板和 `CALLBACK RESULT` JSON 面板；示例同时在控制台打印完整返回数据。`onError(error)` 显示错误并清空旧结果。分析类本身只计算数据，文字由 `TextGroupLayer` 展示，交集由 `PolygonPrimitiveLayer` 绘制。文档组件案例通过 `analysis-preview=distance-pick`、`analysis-preview=area-pick`、`analysis-preview=circle-area-pick` 或 `analysis-preview=overlap-area-pick` 加载对应分析，仅展示地图、图层与结果标注。

完整配置和返回结构见[距离分析](/analysis/distance)、[面积分析](/analysis/area)、[圆面积分析](/analysis/circle-area)和[面积叠加分析](/analysis/overlap-area)。
