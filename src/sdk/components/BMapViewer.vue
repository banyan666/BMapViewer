<template>
  <div class="cesium-container">
    <div ref="cesiumContainer" class="cesium-viewer" :id="id"></div>
    <slot name="tool"></slot>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue'
import * as Cesium from 'cesium'
import { useCesium } from '../composables/useCesium'

const props = defineProps({
  id: {
    type: String,
    default: undefined
  },
  camera: {
    type: Object,
    default: null
  },
  sceneMode:{
    type: Number,
    default: 0
  },
  baseColor:{
    type: String,
    default: '#112441'
  },
})

const emit = defineEmits(['ready', 'error', 'click'])

const cesiumContainer = ref(null)
let handler = null
let viewer = null
let initPromise = null
let hasEmittedReady = false
let isUnmounted = false
const {
  initCesium,
  destroyCesium,
  flyTo,
  getViewer,
  getCameraHeightRange,
  setCameraHeightRange,
  restrictMaxiHeight,
} = useCesium()

// 初始化 Cesium
onMounted(async () => {
  if (hasCameraConfig(props.camera)) await initMap(props.camera)
})

const hasCameraConfig = (config) => {
  if (!config || typeof config !== 'object' || Array.isArray(config)) return false
  return Object.values(config).some((value) =>
    value !== undefined && value !== null && value !== '')
}

const initMap = async (mapConfig, options = {}) =>{
  if (initPromise) return initPromise

  const force = options?.force === true
  const currentViewer = viewer && !viewer.isDestroyed() ? viewer : null
  if (currentViewer && !force) return currentViewer

  const nextMapConfig = mapConfig === undefined ? props.camera : mapConfig
  if (!hasCameraConfig(nextMapConfig)) {
    const error = new TypeError('初始化地图需要传入有效的 camera 配置')
    if (!isUnmounted) emit('error', error)
    return null
  }

  const initialization = (async () => {
    await nextTick() // 确保 DOM 已渲染
    if (isUnmounted || !cesiumContainer.value) return null

    destroyHandler()
    destroyCesium()
    viewer = null

    const nextViewer = await initCesium(cesiumContainer.value, {
      ...props,
      mapConfig: nextMapConfig,
    })

    if (isUnmounted) {
      destroyCesium()
      return null
    }

    viewer = nextViewer
    handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas)

    // 关闭太阳月亮天空盒
    viewer.scene.moon.show =  false
    viewer.scene.fog.enabled = false
    viewer.scene.sun.show = false
    //抗锯齿
    // viewer.scene.fxaa = true;
    // viewer.scene.postProcessStages.fxaa.enabled = true;

    // 是否支持图像渲染像素化处理
    if(Cesium.FeatureDetection.supportsImageRenderingPixelated()){
      viewer.resolutionScale = window.devicePixelRatio;
    }
    startClick()

    // ready 代表当前组件实例首次可用；重复调用 initMap 只复用同一个 Viewer。
    if (!hasEmittedReady) {
      hasEmittedReady = true
      emit('ready', viewer)
    }
    return viewer
  })()

  initPromise = initialization
  try {
    return await initialization
  } catch (err) {
    if (!isUnmounted) emit('error', err)
    return null
  } finally {
    if (initPromise === initialization) initPromise = null
  }
}

// 显式重建 Viewer；返回新实例，但 ready 在单次组件生命周期内仍只触发一次。
const reinitializeMap = (mapConfig = props.camera) => initMap(mapConfig, { force: true })

//开启点击监听
const startClick = () =>{
  if (!handler || handler.isDestroyed()) return
  handler.setInputAction((e)=>{
    const clickPosition = viewer.scene.camera.pickEllipsoid(
      e.position,
      viewer.scene.globe.ellipsoid,
    )
    if (!clickPosition) return
    const randiansPos = Cesium.Cartographic.fromCartesian(clickPosition);
    // 鼠标拾取
    const feature = viewer.scene.pick(e.position);
    if(Cesium.defined(feature)){
      emit('click', {
        lon: Cesium.Math.toDegrees(randiansPos.longitude),
        lat: Cesium.Math.toDegrees(randiansPos.latitude),
        feature: feature
      })
    }else{
      emit('click', {lon: Cesium.Math.toDegrees(randiansPos.longitude), lat: Cesium.Math.toDegrees(randiansPos.latitude)})
    }

  }, Cesium.ScreenSpaceEventType.LEFT_CLICK)
}
const stopClick = () =>{
  if (!handler || handler.isDestroyed()) return
  handler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_CLICK)
}

const destroyHandler = () => {
  if (handler && !handler.isDestroyed()) handler.destroy()
  handler = null
}

// 清理资源
onUnmounted(() => {
  isUnmounted = true
  destroyHandler()
  destroyCesium()
  viewer = null
  initPromise = null
})

// 暴露方法给父组件
defineExpose({
  initMap,
  reinitializeMap,
  flyTo,
  getViewer,
  getCameraHeightRange,
  setCameraHeightRange,
  restrictMaxiHeight,
  startClick,
  stopClick,
})
</script>

<style scoped>
.cesium-container {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
}
.cesium-viewer{
  width: 100%;
  height: 100%;
}
:deep(.cesium-viewer-bottom){
  display: none;
}

</style>
