# CesiumViewer组件
## 组件介绍
CesiumViewer组件是对cesium在vue3下封装的vue组件,能够快速搭建地图应用实现3D地图以及数据可视化能力。
组件内部还添加了一些工具类方法。

## 使用方法
```vue
<template>
  <div class="map-box">
    <CesiumViewer :sceneMode="1" @ready="ready" @click="onClick" ref="cesiumRef"></CesiumViewer>
  </div>
</template>
<script setup>
  const mapCenter={
    longitude: 125.83372000975274,
    latitude: 44.14712267403385,
    height: 8000,
    pitch:-55
  }
  onMounted(async ()=>{
    nextTick(()=>{
      cesiumRef.value.initMap(mapCenter)
    })
  })
</script>
```



# 组件文档地址
https://docs.qq.com/doc/DSnJtQW5rRXR0VEp4