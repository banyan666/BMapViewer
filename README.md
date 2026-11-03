# BMapViewer

BMapViewer 是面向 Vue 3 应用的 Cesium 地理信息可视化 SDK。它统一管理 Viewer 初始化、相机控制与资源销毁，并提供职责独立的多源底图、业务图层、拾取绘制、空间分析和天气效果能力。

仓库同时提供 SDK 源码、可编辑在线示例、VitePress 技术文档和多格式构建产物，适合用于三维 GIS、离线地图、园区态势、设备监控与专题分析等场景。

## 在线资源

- [在线预览](https://banyan666.github.io/BMapViewer/)：浏览底图、图层、拾取绘制与天气模块，并在线编辑运行示例代码。
- [在线文档](https://banyan666.github.io/BMapViewer/docs/)：查看快速开始、组件 API、底图、图层和工具使用指南。

## 核心能力

| 能力 | 说明 |
| --- | --- |
| Viewer 生命周期 | 通过 Vue 组件创建、控制和销毁 `Cesium.Viewer` |
| 底图与地形 | 通过 `BaseMaps` 管理离线瓦片、多源互联网地图、自定义切片、Cesium World Terrain 与天地图三维地形 |
| 可视化图层 | 提供点、线、面、气泡、热力图、3D Tiles 与动态效果图层 |
| 拾取与绘制 | 支持点、图标点、线、多边形、正方形、矩形、圆形、椭圆绘制及控制点拖拽编辑 |
| 空间分析 | SpatialAnalysis 基于 Turf 提供测量、缓冲区、范围统计、周边查询、最近距离、区域差集/合并、线面穿越和几何覆盖，含可编辑拾取示例 |
| 三维分析 | TerrainAnalysis 采样真实地形，支持高程、剖面、贴地测量、坡度坡向、地形通视、挖填方与淹没估算，配合 FloodLayer 动态展示水位升降 |
| 天气系统 | 通过 `WeatherEffects` 提供雨、雪、距离雾、高度雾、沙尘、云层和闪电效果 |
| 离线资源 | 支持本地 TMS 瓦片、3D Tiles 与自定义静态资源 |

## 目录结构

```text
BMapViewer/
├─ src/sdk/base-map/        # BaseMaps 底图模块
├─ src/sdk/layer/           # MapLayers 业务图层
├─ src/sdk/weather/         # WeatherEffects 天气模块
├─ packages/cloud-ultra/    # @b-map-viewer/cloud-ultra 独立包
├─ examples/                # 可编辑运行示例
├─ docs/                    # 接入、API 与开发文档
├─ BMapViewer/              # npm run build:lib 生成的库文件
├─ demo-dist/               # npm run build:demo 生成的示例站点
├─ vite.config.ts           # 示例工程配置
├─ vite.lib.config.ts       # 主包构建配置
└─ vite.cloud-ultra.config.ts # Ultra 独立包构建配置
```

## 本地运行

```bash
npm install
npm run dev
```

浏览器打开终端中 Vite 输出的地址即可查看基础示例。

示例站以模块主页作为统一入口，当前包含：

- `#/base-maps`：离线瓦片、多源 Provider 与三维地形的可编辑示例
- `#/layers`：业务图层目录与可编辑运行示例
- `#/pick-tools`：点、图标点、线和多边形拾取示例
- `#/weather`：天气效果、体积云 Ultra 与可编辑运行示例

主页文档链接默认指向 GitHub 仓库中的 Markdown 文件。部署独立文档站时，可以通过 `VITE_DOCS_BASE_URL` 指定文档站根地址：

```bash
VITE_DOCS_BASE_URL=https://example.com/BMapViewer npm run build:demo
```

运行技术文档站点：

```bash
npm run docs:dev
```

## 构建

```bash
# 同时构建 SDK 和示例站点
npm run build

# 只构建主包（不包含 Ultra）
npm run build:lib

# 构建 Ultra 独立包
npm run build:cloud-ultra

# 只构建示例站点
npm run build:demo
```

主包构建结果位于 `BMapViewer/`，包含 ES Module、UMD 和样式文件。Ultra 独立包产物位于 `packages/cloud-ultra/dist/`，两者分别发布。


## 在 Vue 3 项目中使用

安装本地包或发布后的包，并确保项目已安装 `vue`、`cesium` 和 `vite-plugin-cesium`：

```bash
npm install b-map-viewer cesium vite-plugin-cesium
```

Vite 配置：

```ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import cesium from 'vite-plugin-cesium'

export default defineConfig({
  plugins: [vue(), cesium()],
})
```

组件中使用：

```vue
<script setup>
import { ref } from 'vue'
import { BaseMaps, BMapViewer, MapLayers } from 'b-map-viewer'
import 'b-map-viewer/style.css'

const mapRef = ref(null)
const camera = {
  longitude: 125.83372000975274,
  latitude: 44.14712267403385,
  height: 12000,
  pitch: -45,
}

function handleReady(viewer) {
  new BaseMaps.BaseMap(viewer, {
    type: 'offline',
    url: '/tiles/{z}/{x}/{reverseY}.png',
    crs: 'GCJ02',
  })

  const circles = new MapLayers.CircleGroupLayer(viewer, {
    radius: 300,
    fillColor: '#37d6ff',
  })

  circles.setData([
    {
      geometry: { coordinates: [125.834, 44.147] },
      properties: { id: 'center' },
    },
  ])
}
</script>

<template>
  <div style="width: 100%; height: 600px">
    <BMapViewer
      ref="mapRef"
      :camera="camera"
      :scene-mode="1"
      @ready="handleReady"
    />
  </div>
</template>
```

SDK 内部已经显式导入 Cesium，不需要再执行 `window.Cesium = Cesium`。

## 可选：Ultra 体积云

只有需要 Ultra 时才安装独立包：

```bash
npm install @b-map-viewer/cloud-ultra
```

```js
import { CloudUltraEffect } from '@b-map-viewer/cloud-ultra'

const cloud = new CloudUltraEffect(viewer, { coverage: 0.3 })
await cloud.readyPromise
cloud.setOptions({ windSpeed: 15 })
// 页面卸载或切换效果时：cloud.destroy()
```

也可使用 `await import('@b-map-viewer/cloud-ultra')` 按需加载。资源由效果内部管理，不需要额外配置资源路径或 Vite 插件。

主包不再包含 Ultra 代码和大气、噪声资源，也不依赖该独立包。旧的 `WeatherEffects.CloudUltraEffect`、主包直接导出和 `WeatherSystem.load('cloud-ultra')` 请迁移到独立包调用。普通 `WeatherEffects.CloudEffect` 保持不变。

详见 [Ultra 文档](docs/weather/cloud-ultra.md) 和 [独立包发布步骤](docs/development.md#ultra-独立包发布)。

## 文档

- [在线文档](https://banyan666.github.io/BMapViewer/docs/)
- [在线预览](https://banyan666.github.io/BMapViewer/)
- [完整技术文档站点](docs/index.md)
- [快速开始](docs/getting-started.md)
- [组件 API](docs/api.md)
- [底图模块](docs/base-maps.md)
- [图层模块](docs/layers.md)
- [天气系统](docs/weather.md)
- [开发与构建](docs/development.md)

## 兼容性

- Vue 3.4+
- Cesium 1.118.x（当前验证版本为 1.118.2）
- Vite 5+

## License

[Apache License 2.0](LICENSE)
