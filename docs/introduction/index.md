---
next:
  text: 快速开始
  link: /getting-started
---

# BMapViewer 是什么？

BMapViewer 是面向 Vue 3 应用的 Cesium 地理信息可视化 SDK。它将 Viewer 生命周期、底图管理、业务图层和地图交互整理为清晰、可组合的 API，让业务代码专注于数据与场景表达。

通过 `BMapViewer` 组件可以快速创建 Cesium 场景；通过 `BaseMaps` 可以加载离线瓦片、多源互联网底图和三维地形；通过 `MapLayers` 可以加载点、线、面、气泡、热力图、3D Tiles 和动态效果；通过 `PickTools` 与 `SpatialAnalysis` 可以完成拾取、绘制、距离分析和面积分析；通过 `WeatherEffects` 可以加入雨、雪、雾、沙尘、云层和闪电天气。

::: tip 一句话理解
BMapViewer 为 Cesium 提供 Vue 3 组件入口，并为常见 GIS 能力提供统一的创建、更新与销毁方式。
:::

## 重点能力

| 模块 | 解决的问题 |
| --- | --- |
| `BMapViewer` | Viewer 初始化、相机配置、点击事件与生命周期管理 |
| `BaseMaps` | 离线瓦片、多源影像、Cesium ion 与天地图地形 Provider、坐标纠偏和自定义切片方案 |
| `MapLayers` | 点线面、标注、气泡、热力图、3D Tiles 和动态效果 |
| `WeatherEffects` | 雨雪、距离雾、高度雾、沙尘、体积云与闪电，以及统一的效果生命周期管理 |
| `PickTools` | 点、图标点、线、多边形及规则图形绘制，支持拖拽编辑 |
| Turf | GeoJSON 数据处理、距离计算、缓冲和空间关系分析 |
| SpatialAnalysis | 测量、缓冲区、空间查询、区域运算、穿越与几何覆盖，计算与地图显示分离 |
| TerrainAnalysis | 真实地形采样、高程剖面、贴地距离与面积、坡度坡向、通视、挖填方及淹没估算，配合 FloodLayer 动态展示 |
| 示例工作台 | 浏览、修改并重新运行每个能力的示例代码 |

## 应用场景

- 二维与三维 GIS 应用
- 离线地图与内网部署
- 园区、设备和事件态势展示
- 点、线、面与动态效果的批量可视化
- 地图拾取、几何绘制与空间分析
- 大范围雨雪、低能见度与极端天气场景表达

## 设计特点

- **组件化**：使用 Vue 生命周期管理 Cesium Viewer。
- **可组合**：底图、图层和工具围绕同一个 Viewer 按需接入。
- **可回收**：图层提供清理或销毁方法，降低页面切换时的资源残留。
- **可验证**：在线示例支持查看、编辑并重新运行当前代码。
- **离线友好**：支持本地瓦片、3D Tiles 和静态资源。

## 安装

```shell
npm install b-map-viewer cesium vite-plugin-cesium
```

当前验证版本为 Cesium 1.118.2。详细配置与组件示例请继续阅读[快速开始](/getting-started)。

## zip.js 兼容说明

Cesium 1.118 的 KML 模块使用了 `@zip.js/zip.js/lib/zip-no-worker.js` 子路径。BMapViewer 已固定兼容的 `@zip.js/zip.js@2.7.73`，正常安装 SDK 时不需要额外处理。

如果应用强制覆盖了该依赖，请确保最终解析版本仍为 2.7.x：

```shell
npm ls @zip.js/zip.js
```
