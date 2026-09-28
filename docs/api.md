# BMapViewer API

## Props

| 名称 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `id` | `String` | `undefined` | 可选的内部容器 id |
| `camera` | `Object \| null` | `null` | 初始相机参数；有有效值时组件挂载后自动初始化，否则等待调用 `initMap` |
| `sceneMode` | `Number` | `0` | `0` 为 2D，其他值为 3D |
| `baseColor` | `String` | `#112441` | 无影像时的地球基础颜色 |

`camera` 支持以下字段：

| 字段 | 默认值 | 说明 |
| --- | --- | --- |
| `longitude` | `125.83372000975274` | 经度 |
| `latitude` | `44.14712267403385` | 纬度 |
| `height` | `10000` | 相机高度 |
| `pitch` | `0` | 俯仰角（度） |
| `minHeight` | `1` | 最小相机高度 |
| `maxHeight` | `1500000` | 最大相机高度 |

## Events

| 名称 | 参数 | 说明 |
| --- | --- | --- |
| `ready` | `Cesium.Viewer` | 当前组件实例首次初始化完成；每次挂载只触发一次 |
| `error` | `Error` | 初始化失败 |
| `click` | `{ lon, lat, feature? }` | 点击到地球表面时触发 |

## Exposed methods

通过组件 `ref` 调用：

| 方法 | 说明 |
| --- | --- |
| `initMap(camera)` | 传入相机参数并幂等初始化 Viewer；初始化中复用同一 Promise，完成后重复调用返回现有实例 |
| `reinitializeMap(camera)` | 传入相机参数，显式销毁并重建 Viewer；返回新实例，但不会重复触发 `ready` |
| `flyTo(destination, duration?)` | 飞行到经纬度位置 |
| `startClick()` | 开启左键拾取 |
| `stopClick()` | 关闭左键拾取 |
| `getViewer()` | 获取当前 `Cesium.Viewer` |
| `setCameraHeightRange({ minHeight?, maxHeight? })` | 动态修改高度范围并立即应用到当前相机 |
| `getCameraHeightRange()` | 获取当前 `{ minHeight, maxHeight }` |
| `restrictMaxiHeight()` | 立即按当前范围约束一次相机高度 |

```js
mapRef.value.flyTo(
  { longitude: 125.83372000975274, latitude: 44.14712267403385, height: 8000, pitch: -45 },
  1.5,
)

mapRef.value.setCameraHeightRange({
  minHeight: 100,
  maxHeight: 120000,
})
```

### 初始化方式

传入有效的 `camera` 时，组件会在 `onMounted` 后自动初始化：

```vue
<BMapViewer :camera="camera" @ready="handleReady" />
```

不传 `camera` 时，组件只渲染地图容器，不会创建 `Cesium.Viewer`。使用者需要通过组件 `ref` 主动调用 `initMap(camera)`：

```vue
<script setup>
import { onMounted, ref } from 'vue'
import { BMapViewer } from 'b-map-viewer'

const mapRef = ref(null)

onMounted(async () => {
  const viewer = await mapRef.value.initMap({
    longitude: 125.8337,
    latitude: 44.1471,
    height: 12000,
    pitch: -45,
  })
  // viewer 可在这里直接使用；组件仍会正常触发一次 ready 事件。
})
</script>

<template>
  <BMapViewer ref="mapRef" :scene-mode="1" @ready="handleReady" />
</template>
```

首次初始化时如果没有传入有效参数，`initMap` 返回 `null` 并触发 `error` 事件。Viewer 已存在时重复调用 `initMap` 会直接返回当前实例，不会重复创建 Viewer 或触发 `ready`。

## SDK 模块导出

| 导出 | 说明 |
| --- | --- |
| `BMapViewer` | Vue 3 Viewer 组件 |
| `useCesium` | Viewer 生命周期与相机 Hook |
| `BaseMaps` | 底图管理器、Provider、样式别名、投影与切片方案 |
| `MapLayers` | 点、线、面、气泡、热力图和三维业务图层 |
| `WeatherEffects` | 雨、雪、雾、沙尘、云层、闪电效果与统一天气管理器 |
| `PickTools` | 拾取与绘制工具 |
| `EarthColor` | 场景颜色处理工具 |
| `turf` | Turf 空间分析命名空间 |

## Slot

`tool` 插槽渲染在 Viewer 容器内部，可用于地图工具栏、图例或状态面板。
