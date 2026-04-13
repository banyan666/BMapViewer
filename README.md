# BMapViewer
基于Vue3、Vite、Cesium封装的地理信息可视化库。

## 如何使用
1. 确保你的项目有Cesium库，因为该组件依赖Cesium(目前依赖1.118.2版本，其他版本未验证)。
2. 将BMapViewer复制到你的项目组件库中。
3. 并且按照如下配置。
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
```js
// main.js
import * as Cesium from "cesium";
import 'cesium/Build/Cesium/Widgets/widgets.css'
window.Cesium = Cesium

```
4. 使用组件
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
    url: 'http://192.168.31.13:8095/terrain/{z}/{x}/{reverseY}.png',
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


`文档地址`：[docs](https://banyan666.github.io/BMapViewer-docs/)


该组件若不满足你的需求，可联系作者提供需求，作者会进行开发补充。

# 联系我
## 邮箱：<EMAIL>15029296293@163.com
## 微信：bryan_by666
## QQ：1449301027

# 打赏
<img src="ds_wx.jpg" width="350" />
<img src="ds_zfb.jpg" width="350" />
