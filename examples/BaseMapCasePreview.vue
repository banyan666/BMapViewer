<script setup>
import { computed, nextTick, onBeforeUnmount, ref } from 'vue'
import * as Cesium from 'cesium'
import { BaseMaps, BMapViewer } from '../src/sdk/index.js'
import { baseMapExamples } from './base-maps/index.js'
import { createBaseMapExampleSession } from './base-maps/runtime.js'

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

const mapRef = ref(null)
let viewer = null
let activeSession = null
let version = 0

function destroyBaseMap() {
  activeSession?.destroy()
  activeSession = null
}

async function runExample() {
  if (!viewer || viewer.isDestroyed()) return
  const current = ++version
  destroyBaseMap()
  const session = createBaseMapExampleSession({ Cesium, BaseMaps, viewer, tileUrl })
  activeSession = session
  if (!example.value.managesCamera) mapRef.value?.flyTo(HOME_CAMERA, 0)

  try {
    await session.execute(example.value.code)
  } catch (error) {
    if (current !== version) return
    session.destroy()
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
