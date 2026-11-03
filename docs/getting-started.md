# 快速开始

本页将完成依赖安装、Vite 配置和第一个 Cesium 场景。开始前请确保应用使用 Vue 3 与 Vite。

## 安装依赖

BMapViewer 将 Vue 与 Cesium 声明为 peer dependencies，需要与 SDK 一起安装：

```bash
npm install b-map-viewer vue cesium vite-plugin-cesium
```

需要在本地联调源码时，可以安装相邻目录：

```bash
npm install ../BMapViewer
```

## 配置 Vite

`vite-plugin-cesium` 会处理 Cesium 的 Workers、Assets、Widgets 和 ThirdParty 静态资源：

```ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import cesium from 'vite-plugin-cesium'

export default defineConfig({
  plugins: [vue(), cesium()],
})
```

## 引入组件

```js
import { BaseMaps, BMapViewer } from 'b-map-viewer'
import 'b-map-viewer/style.css'
```

::: warning 容器高度
组件容器必须具有明确高度，否则 Cesium 画布高度会是 `0`。
:::

```vue
<script setup>
import { ref } from 'vue'
import { BaseMaps, BMapViewer } from 'b-map-viewer'
import 'b-map-viewer/style.css'

const mapRef = ref(null)
const camera = {
  longitude: 125.83372000975274,
  latitude: 44.14712267403385,
  height: 12000,
  pitch: -45,
}

function onReady(viewer) {
  new BaseMaps.BaseMap(viewer, {
    type: 'offline',
    url: '/tiles/{z}/{x}/{reverseY}.png',
    crs: 'GCJ02',
    minimumLevel: 1,
    maximumLevel: 12,
  })
}
</script>

<template>
  <div class="map-container">
    <BMapViewer ref="mapRef" :camera="camera" :scene-mode="1" @ready="onReady" />
  </div>
</template>

<style scoped>
.map-container {
  width: 100%;
  height: 600px;
}
</style>
```

完整示例见 GitHub 中的 [`examples/BasicExample.vue`](https://github.com/banyan666/BMapViewer/blob/main/examples/BasicExample.vue)。

## 下一步

- 查看 [BMapViewer 组件 API](/api)
- 配置 [BaseMaps 底图模块](/base-maps)
- 浏览 [可视化图层](/layers)
- 使用 [PickTools 拾取与绘制](/tools/pick-tool)
- 添加 [WeatherEffects 天气系统](/weather)
- 了解 [GeoJSON 数据约定](/data)
