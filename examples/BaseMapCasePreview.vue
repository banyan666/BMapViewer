<script setup>
import { computed, nextTick, onBeforeUnmount, ref } from 'vue'
import * as Cesium from 'cesium'
import { BaseMaps, BMapViewer } from '../src/sdk/index.js'
import { baseMapExamples } from './base-maps/index.js'

const HOME_CAMERA = {
  longitude: 125.83372000975274,
  latitude: 44.14712267403385,
  height: 7600,
  pitch: -56,
  minHeight: 40,
  maxHeight: 800000,
}

const queryId = new URLSearchParams(window.location.search).get('base-map-preview')
const example = computed(() => baseMapExamples.find((item) => item.id === queryId) || baseMapExamples[0])
const publicRoot = new URL(import.meta.env.BASE_URL, window.location.href)
const tileUrl = new URL('tiles/{z}/{x}/{reverseY}.png', publicRoot).href
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor

const mapRef = ref(null)
let viewer = null
let activeBaseMap = null
let version = 0

function destroyBaseMap() {
  try {
    if (typeof activeBaseMap === 'function') activeBaseMap()
    else if (typeof activeBaseMap?.destroy === 'function') activeBaseMap.destroy()
    else if (typeof activeBaseMap?.remove === 'function') activeBaseMap.remove()
  } catch (error) {
    console.warn('底图案例资源清理失败：', error)
  }
  activeBaseMap = null
}

async function runExample() {
  if (!viewer || viewer.isDestroyed()) return
  const current = ++version
  destroyBaseMap()
  mapRef.value?.flyTo(HOME_CAMERA, 0)

  try {
    const execute = new AsyncFunction(
      'Cesium',
      'BaseMaps',
      'viewer',
      'tileUrl',
      `'use strict';\n${example.value.code}`,
    )
    const result = await execute(Cesium, BaseMaps, viewer, tileUrl)
    if (current !== version) {
      if (typeof result === 'function') result()
      else result?.destroy?.()
      return
    }
    activeBaseMap = result
    if (result?.readyPromise) await result.readyPromise
  } catch (error) {
    if (current !== version) return
    destroyBaseMap()
    console.error('底图案例运行失败：', error)
  }
}

async function handleViewerReady(readyViewer) {
  viewer = readyViewer
  await nextTick()
  runExample()
}

function handleViewerError(error) {
  console.error('Cesium 初始化失败：', error)
}

onBeforeUnmount(() => {
  version += 1
  destroyBaseMap()
  viewer = null
})
</script>

<template>
  <main class="case-preview">
    <BMapViewer
      id="base-map-case"
      ref="mapRef"
      :camera="HOME_CAMERA"
      :scene-mode="1"
      base-color="#102332"
      @ready="handleViewerReady"
      @error="handleViewerError"
    />
  </main>
</template>

<style scoped>
.case-preview {
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #102332;
}
</style>
