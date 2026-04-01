# BMapViewer是什么？
## 介绍
BMapViewer是基于Cesium 1.118.2版本和vue3封装的离线地理信息可视化库，可以用来展示基于地理信息格式的点线面数据；
简化Cesium的使用，降低前端人员对地图可视化的使用门槛，能够在地图上实现一些三维数据展示效果；并且组件库封装了很多方法，帮助前端快速实现对地图的相关操作。
如果你的项目是`vite`+`vue3`，那么你可以选择使用BMapViewer。
## 应用场景
- 快速开发三维地图
- 快速开发三维可视化效果
- 部署离线地图
- 可视化大屏
## 准备
1. 项目终端执行以下命令下载对应的cesium库和vite-plugin-cesium插件。
```shell
pnpm install cesium@1.118.2 vite-plugin-cesium@1.2.22
```
2. 进入项目的vite.config.js文件中，使用注册vite-plugin-cesium插件
```js
// vite.config.js
import { defineConfig } from 'vite'
import cesium from 'vite-plugin-cesium'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
    plugins:[
        vue(),
        cesium()
    ]
})

```
3. 进入到main.js中引入cesium，并将cesium实例挂载到window对象中，方便后续使用。
```js
// main.js
import * as Cesium from "cesium";
import 'cesium/Build/Cesium/Widgets/widgets.css'
window.Cesium = Cesium

```

4. 使用
```vue
<template>
  <div class="map-box">
    <BMapViewer :sceneMode="0" :camera="mapConfig" @ready="ready" @click="onClick" ref="cesiumRef"></BMapViewer>
  </div>
</template>

<script setup>
  import {BMapViewer, MapLayers} from "@/components/BMapViewer/b-map-viewer.js";
  import '@/components/BMapViewer/style.css'

  const cesiumRef = ref(null)
  const baseMapConfig = {
    url: 'http://192.168.31.216:8095/file/terrain/{z}/{x}/{reverseY}.jpg',
    maximumLevel: 18,
    minimumLevel: 3,
    themeColor: '#2f62af'
  }
  const mapConfig = {
    longitude: 125.83372000975274,
    latitude: 44.14712267403385,
    height: 8000,
    pitch: 0
  }
  let baseMapLayer = null
  const ready = (viewer) => {
    console.log(viewer.scene, 'viewer')
    baseMapLayer = new MapLayers.BaseMapLayer(viewer, baseMapConfig)
  }
  const onClick = (e) => {
    console.log(e, 'e')
  }
</script>

<style scoped>
  .map-box {
    width: 100%;
    height: 100%;
  }
</style>

```
