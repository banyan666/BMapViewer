# BMapViewer
基于Vue3、Vite、Cesium封装的地理信息可视化库。

如何使用,将BMapViewer复制到你的项目组件库中，确保你的项目有Cesium库，因为该组件依赖Cesium；
并且按照如下配置。
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

你就可以使用

`文档地址`：还在编写



该组件若不满足你的需求，可联系作者提供需求，作者会进行开发补充。
