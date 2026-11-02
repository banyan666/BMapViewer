---
layout: home

hero:
  name: BMapViewer
  text: Vue 3 + Cesium 可视化 SDK
  tagline: 用独立的底图、图层、工具与天气模块组织 Cesium 业务能力。
  image:
    src: /background.png
    alt: BMapViewer
  actions:
    - theme: brand
      text: 快速开始
      link: /getting-started
    - theme: alt
      text: 在线预览
      link: https://banyan666.github.io/BMapViewer/

features:
  - icon: 🧩
    title: Viewer 生命周期
    details: 通过 Vue 3 组件创建、控制并可靠销毁 Cesium Viewer。
  - icon: 🌍
    title: 多源底图
    details: 支持本地 TMS、高德、百度、腾讯、天地图、Google、GeoVis 与自定义切片。
  - icon: ✨
    title: 可组合图层
    details: 内置点、线、面、气泡、热力图、雷达和动态材质图层。
  - icon: 🛠️
    title: 交互与空间分析
    details: 提供 PickTools 拾取绘制，以及 SpatialAnalysis 测量、缓冲区、空间查询与区域运算。
  - icon: 🌦️
    title: 天气粒子系统
    details: 提供雨、雪、雾、沙尘、云层和闪电屏幕空间效果。
  - icon: ⛰️
    title: 三维地形分析
    details: 基于真实地形完成高程剖面、贴地测量、坡度坡向、通视、挖填方和淹没估算，支持动态水位展示。
---

## 从一个 Viewer 开始

BMapViewer 负责场景初始化与生命周期，`BaseMaps` 管理地理背景，`MapLayers` 组织业务图层，`PickTools` 处理地图交互，`SpatialAnalysis` 基于 Turf 提供空间计算，`TerrainAnalysis` 采样真实地形进行三维分析，`WeatherEffects` 合成天气画面。各模块可以独立使用，也可以围绕同一个 Viewer 组合。

## 在线资源

| 入口 | 地址 | 内容 |
| --- | --- | --- |
| 在线预览 | [banyan666.github.io/BMapViewer](https://banyan666.github.io/BMapViewer/) | 可编辑运行的底图、图层、工具与天气案例 |
| 在线文档 | [banyan666.github.io/BMapViewer/docs](https://banyan666.github.io/BMapViewer/docs/) | 接入指南、API、底图、图层、工具与天气说明 |

::: tip 推荐阅读顺序
[快速开始](/getting-started) → [底图模块](/base-maps) → [图层模块](/layers) → [拾取与绘制](/tools/pick-tool) → [天气粒子](/weather)
:::
