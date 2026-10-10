<script setup>
import { computed, nextTick, onBeforeUnmount, ref } from 'vue'
import * as Cesium from 'cesium'
import { BaseMaps, BMapViewer, MapLayers } from '../src/sdk/index.js'
import { layerExamples } from './layers/index.js'

const HOME_CAMERA = {
  longitude: 125.83372000975274,
  latitude: 44.14712267403385,
  height: 7600,
  pitch: -56,
  minHeight: 40,
  maxHeight: 800000,
}

const queryId = new URLSearchParams(window.location.search).get('layer-preview')
const hashId = window.location.hash.replace(/^#\/?layer-preview\/?/, '').split('/')[0] || ''
const routeId = decodeURIComponent(queryId || hashId)
const example = computed(() => layerExamples.find((item) => item.id === routeId) || layerExamples[0])
const publicRoot = new URL(import.meta.env.BASE_URL, window.location.href)
const tileUrl = new URL('tiles/{z}/{x}/{reverseY}.png', publicRoot).href
const buildingTilesetUrl = new URL('3d-tiles/tileset.json', publicRoot).href
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor

const mapRef = ref(null)

let viewer = null
let baseMap = null
let activeResult = null

async function destroyResult(result) {
  if (!result) return
  try {
    if (typeof result === 'function') await result()
    else if (typeof result.destroy === 'function') result.destroy()
    else if (typeof result.removeLayer === 'function') result.removeLayer()
    else if (typeof result.clearLayer === 'function') result.clearLayer()
  } catch (error) {
    console.warn('图层案例资源清理失败：', error)
  }
}

async function runExample() {
  if (!viewer || viewer.isDestroyed()) return
  await destroyResult(activeResult)
  activeResult = null

  if (example.value.id !== 'build-3d') mapRef.value?.flyTo(example.value.camera || HOME_CAMERA, 0)

  try {
    const execute = new AsyncFunction(
      'Cesium',
      'MapLayers',
      'viewer',
      'tileUrl',
      'buildingTilesetUrl',
      `'use strict';\n${example.value.code}`,
    )
    activeResult = await execute(Cesium, MapLayers, viewer, tileUrl, buildingTilesetUrl)
  } catch (error) {
    console.error('图层案例运行失败：', error)
  }
}

async function handleViewerReady(readyViewer) {
  viewer = readyViewer
  baseMap = new BaseMaps.BaseMap(viewer, example.value.baseMap || {
    type: 'offline',
    url: tileUrl,
    crs: 'GCJ02',
    minimumLevel: 1,
    maximumLevel: 12,
    themeColor: '#34A4FF',
  })
  await nextTick()
  runExample()
}

function handleMapError(error) {
  console.error('Cesium 初始化失败：', error)
}

onBeforeUnmount(() => {
  destroyResult(activeResult)
  activeResult = null
  baseMap?.destroy()
  baseMap = null
  viewer = null
})
</script>

<template>
  <main class="case-preview">
    <BMapViewer
      id="layer-case-map"
      ref="mapRef"
      :camera="example.camera || HOME_CAMERA"
      :scene-mode="1"
      @ready="handleViewerReady"
      @error="handleMapError"
    />
  </main>
</template>

<style scoped>
.case-preview {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #071118;
}
</style>
