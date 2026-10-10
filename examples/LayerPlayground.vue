<script setup>
import { computed, nextTick, onBeforeUnmount, ref } from 'vue'
import * as Cesium from 'cesium'
import { BaseMaps, BMapViewer, MapLayers } from '../src/sdk/index.js'
import CodeExampleEditor from './CodeExampleEditor.vue'
import { layerExamples, layerGroups } from './layers/index.js'

const HOME_CAMERA = {
  longitude: 125.83372000975274,
  latitude: 44.14712267403385,
  height: 7600,
  pitch: -56,
  minHeight: 40,
  maxHeight: 800000,
}

const publicRoot = new URL(import.meta.env.BASE_URL, window.location.href)
const tileUrl = new URL('tiles/{z}/{x}/{reverseY}.png', publicRoot).href
const buildingTilesetUrl = new URL('3d-tiles/tileset.json', publicRoot).href
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
const OFFLINE_BASE_MAP = {
  type: 'offline',
  url: tileUrl,
  crs: 'GCJ02',
  minimumLevel: 1,
  maximumLevel: 12,
  themeColor: '#34A4FF',
}

const mapRef = ref(null)
const viewerReady = ref(false)
const isCodePanelOpen = ref(false)
const activeId = ref(layerExamples[0].id)
const code = ref(layerExamples[0].code)
const runState = ref('idle')
const runMessage = ref('等待 Cesium 初始化')
const runDuration = ref(0)
const coordinate = ref(null)

let viewer = null
let baseMap = null
let activeCleanup = null
let runVersion = 0
let resizeTimer = null

const activeExample = computed(() => layerExamples.find((item) => item.id === activeId.value) || layerExamples[0])
const groupedExamples = computed(() => layerGroups.map((group) => ({
  group,
  items: layerExamples.filter((item) => item.group === group),
})))

function getDisplayIndex(example) {
  let displayIndex = 0
  for (const section of groupedExamples.value) {
    for (const item of section.items) {
      displayIndex += 1
      if (item.id === example.id) return String(displayIndex).padStart(2, '0')
    }
  }
  return '--'
}
const isModified = computed(() => code.value !== activeExample.value.code)
const statusLabel = computed(() => ({
  idle: '待运行',
  running: '运行中',
  success: '运行成功',
  error: '运行失败',
}[runState.value]))

function readCollection(collection) {
  const values = []
  if (!collection || typeof collection.length !== 'number' || typeof collection.get !== 'function') return values
  for (let index = 0; index < collection.length; index += 1) values.push(collection.get(index))
  return values
}

function takeResourceSnapshot() {
  if (!viewer || viewer.isDestroyed()) return null
  const snapshot = {
    entities: new Set(viewer.entities.values),
    dataSources: new Set(readCollection(viewer.dataSources)),
    primitives: new Set(readCollection(viewer.scene.primitives)),
    imageryLayers: new Set(readCollection(viewer.imageryLayers)),
  }
  // DataSourceDisplay 的容器会在首个 CustomDataSource 加入时才挂到场景，
  // 它属于 Viewer 基础设施，不能被示例资源回收逻辑误删。
  if (viewer.dataSourceDisplay?._primitives) {
    snapshot.primitives.add(viewer.dataSourceDisplay._primitives)
  }
  return snapshot
}

async function cleanResult(result) {
  if (!result) return
  if (result.layer instanceof Cesium.CustomDataSource) {
    const dataSource = result.layer
    await removeDataSourceSafely(dataSource)
    result.layer = null
    result.viewer = null
    return
  }
  if (typeof result === 'function') {
    await result()
  } else if (typeof result.destroy === 'function') {
    result.destroy()
  } else if (typeof result.removeLayer === 'function') {
    result.removeLayer()
  } else if (typeof result.clearLayer === 'function') {
    result.clearLayer()
  }
}

function waitForSceneRender() {
  if (!viewer || viewer.isDestroyed()) return Promise.resolve()
  return new Promise((resolve) => {
    let finished = false
    const finish = () => {
      if (finished) return
      finished = true
      clearTimeout(timer)
      removeListener?.()
      resolve()
    }
    const removeListener = viewer.scene.postRender.addEventListener(finish)
    const timer = setTimeout(finish, 180)
    viewer.scene.requestRender()
  })
}

async function removeDataSourceSafely(dataSource) {
  if (!viewer || viewer.isDestroyed() || !viewer.dataSources.contains(dataSource)) return
  if (!dataSource._primitives) await waitForSceneRender()
  if (!viewer || viewer.isDestroyed()) return
  if (viewer.dataSources.contains(dataSource) && dataSource._primitives) {
    viewer.dataSources.remove(dataSource, true)
  }
}

async function removeResourcesAfter(snapshot) {
  if (!snapshot || !viewer || viewer.isDestroyed()) return
  viewer.entities.values
    .filter((entity) => !snapshot.entities.has(entity))
    .forEach((entity) => viewer.entities.remove(entity))

  const extraDataSources = readCollection(viewer.dataSources)
    .filter((item) => !snapshot.dataSources.has(item))
  for (const dataSource of extraDataSources) await removeDataSourceSafely(dataSource)

  readCollection(viewer.scene.primitives)
    .filter((item) => !snapshot.primitives.has(item))
    .forEach((item) => viewer.scene.primitives.remove(item))

  readCollection(viewer.imageryLayers)
    .filter((item) => !snapshot.imageryLayers.has(item))
    .forEach((item) => viewer.imageryLayers.remove(item, true))
}

async function disposeActive() {
  if (!activeCleanup) return
  const cleanup = activeCleanup
  activeCleanup = null
  try {
    await cleanup()
  } catch (error) {
    console.warn('示例资源清理失败：', error)
  }
}

function flyHome(duration = 0.7) {
  if (!viewerReady.value) return
  mapRef.value?.flyTo(activeExample.value.camera || HOME_CAMERA, duration)
}

async function runCode() {
  if (!viewer || viewer.isDestroyed() || runState.value === 'running') return
  const currentRun = ++runVersion
  runState.value = 'running'
  runMessage.value = `正在创建 ${activeExample.value.name}`
  runDuration.value = 0
  const startTime = performance.now()

  await disposeActive()
  if (currentRun !== runVersion) return

  const baseMapConfig = activeExample.value.baseMap || OFFLINE_BASE_MAP
  if (baseMap.config.type !== baseMapConfig.type) baseMap.load(baseMapConfig)

  if (activeExample.value.id !== 'build-3d') flyHome(0)
  const snapshot = takeResourceSnapshot()

  try {
    const execute = new AsyncFunction(
      'Cesium',
      'MapLayers',
      'viewer',
      'tileUrl',
      'buildingTilesetUrl',
      `'use strict';\n${code.value}`,
    )
    const result = await execute(Cesium, MapLayers, viewer, tileUrl, buildingTilesetUrl)
    const cleanup = async () => {
      try {
        await cleanResult(result)
      } finally {
        await removeResourcesAfter(snapshot)
      }
    }

    if (currentRun !== runVersion) {
      await cleanup()
      return
    }

    activeCleanup = cleanup
    runDuration.value = Math.round(performance.now() - startTime)
    runState.value = 'success'
    runMessage.value = `${activeExample.value.name} 已挂载到地图`
  } catch (error) {
    await removeResourcesAfter(snapshot)
    runDuration.value = Math.round(performance.now() - startTime)
    runState.value = 'error'
    runMessage.value = error?.message || String(error)
    console.error('示例代码运行失败：', error)
  }
}

async function selectExample(example) {
  if (activeId.value === example.id) return
  runVersion += 1
  await disposeActive()
  activeId.value = example.id
  code.value = example.code
  runState.value = 'idle'
  runMessage.value = '示例已切换，准备运行'
  await nextTick()
  runCode()
}

function resetCode() {
  code.value = activeExample.value.code
  runMessage.value = '已恢复默认示例代码'
}

async function handleViewerReady(readyViewer) {
  viewer = readyViewer
  viewerReady.value = true
  baseMap = new BaseMaps.BaseMap(viewer, OFFLINE_BASE_MAP)
  // viewer.scene.globe.depthTestAgainstTerrain = false
  runMessage.value = '离线瓦片已就绪'
  await nextTick()
  runCode()
}

function handleMapError(error) {
  runState.value = 'error'
  runMessage.value = error?.message || 'Cesium 初始化失败'
}

function handleMapClick(payload) {
  coordinate.value = `${payload.lon.toFixed(5)}, ${payload.lat.toFixed(5)}`
}

async function toggleCodePanel() {
  isCodePanelOpen.value = !isCodePanelOpen.value
  await nextTick()
  viewer?.resize()
  clearTimeout(resizeTimer)
  resizeTimer = setTimeout(() => viewer?.resize(), 460)
}

onBeforeUnmount(() => {
  clearTimeout(resizeTimer)
  runVersion += 1
  baseMap?.destroy()
  baseMap = null
  disposeActive()
  viewer = null
})
</script>

<template>
  <div class="layer-lab">
    <header class="lab-header">
      <div class="brand-block">
        <div class="brand-mark" aria-hidden="true">
          <span></span><span></span><span></span>
        </div>
        <div>
          <div class="brand-line">
            <strong>BMapViewer</strong>
            <span class="edition">LAYER LAB</span>
          </div>
          <p>Cesium 图层交互式示例工作台</p>
        </div>
      </div>

      <div class="header-metrics" aria-label="项目状态">
        <div><span>图层示例</span><strong>{{ layerExamples.length }}/{{ layerExamples.length }}</strong></div>
        <div><span>底图来源</span><strong>{{ activeExample.baseMap?.type === 'arcgis' ? 'ARCGIS / IMAGE' : 'PUBLIC / TMS' }}</strong></div>
        <div class="runtime-dot" :class="runState"><i></i><strong>{{ statusLabel }}</strong></div>
      </div>
    </header>

    <main class="lab-grid" :class="{ 'code-panel-open': isCodePanelOpen }">
      <aside class="catalog-panel">
        <div class="panel-kicker">LAYER INDEX</div>
        <div class="catalog-heading">
          <h1>图层目录</h1>
          <span>{{ layerExamples.length }}</span>
        </div>

        <nav class="layer-nav" aria-label="图层示例">
          <section v-for="section in groupedExamples" :key="section.group" class="layer-group">
            <h2>{{ section.group }}</h2>
            <button
              v-for="(example, index) in section.items"
              :key="example.id"
              type="button"
              class="layer-item"
              :class="{ active: activeId === example.id }"
              :aria-current="activeId === example.id ? 'page' : undefined"
              @click="selectExample(example)"
            >
              <span class="layer-index">{{ getDisplayIndex(example) }}</span>
              <span class="layer-copy"><strong>{{ example.title }}</strong><small>{{ example.name }}</small></span>
              <span class="layer-arrow">›</span>
            </button>
          </section>
        </nav>
      </aside>

      <section class="code-panel" :class="{ collapsed: !isCodePanelOpen }" aria-label="示例代码编辑器">
        <button
          type="button"
          class="code-panel-toggle"
          :aria-expanded="isCodePanelOpen"
          aria-controls="layer-code-panel-body"
          :title="isCodePanelOpen ? '收起示例代码' : '展开示例代码'"
          @click="toggleCodePanel"
        >
          <span class="toggle-arrow" :class="{ open: isCodePanelOpen }" aria-hidden="true">›</span>
          <span class="toggle-label">EDITABLE EXAMPLE</span>
        </button>

        <div id="layer-code-panel-body" class="code-panel-body" :aria-hidden="!isCodePanelOpen">
          <div class="panel-toolbar">
            <div>
              <span class="panel-kicker">EDITABLE EXAMPLE</span>
              <h2>{{ activeExample.name }}</h2>
            </div>
            <span v-if="isModified" class="changed-badge">已修改</span>
          </div>

          <p class="example-summary">{{ activeExample.summary }}</p>

          <div class="scope-line">
            <span>可用变量</span>
            <code>viewer</code><code>Cesium</code><code>MapLayers</code><code>tileUrl</code><code>buildingTilesetUrl</code>
          </div>

          <div class="editor-shell">
            <CodeExampleEditor
              v-model="code"
              accent="cyan"
              aria-label="可编辑 JavaScript 示例代码"
              @run="runCode"
            />
          </div>

          <div class="run-console" :class="runState">
            <div class="console-state"><i></i><span>{{ runMessage }}</span></div>
            <time v-if="runDuration">{{ runDuration }} ms</time>
          </div>

          <div class="editor-actions">
            <button type="button" class="run-button" :disabled="!viewerReady || runState === 'running'" @click="runCode">
              <span>▶</span>{{ runState === 'running' ? '运行中…' : '运行当前示例' }}
            </button>
            <button type="button" class="text-button" :disabled="!isModified" @click="resetCode">恢复代码</button>
            <kbd>Ctrl ↵</kbd>
          </div>
        </div>
      </section>

      <section class="map-panel" aria-label="Cesium 运行预览">
        <BMapViewer
          id="layer-playground-map"
          ref="mapRef"
          :camera="HOME_CAMERA"
          :scene-mode="1"
          @ready="handleViewerReady"
          @error="handleMapError"
          @click="handleMapClick"
        />

        <div class="map-title-card">
          <span>LIVE PREVIEW</span>
          <strong>{{ activeExample.title }}</strong>
          <small>{{ activeExample.name }}</small>
        </div>

        <button type="button" class="home-button" title="返回示例中心" @click="flyHome()">◎</button>

        <div class="map-footer">
          <span><i></i> {{ activeExample.baseMap?.type === 'arcgis' ? 'ARCGIS WORLD IMAGERY' : 'OFFLINE TILES · Z1—Z12' }}</span>
          <span v-if="coordinate">{{ coordinate }}</span>
          <span v-else>点击地图读取坐标</span>
        </div>
      </section>
    </main>
  </div>
</template>

<style scoped>
.layer-lab {
  --ink-0: #050b11;
  --ink-1: #08131c;
  --ink-2: #0c1c27;
  --line: rgba(129, 184, 201, 0.16);
  --muted: #7895a2;
  --text: #def4f6;
  --cyan: #44eee0;
  --amber: #ffc85c;
  width: 100%;
  height: 100%;
  overflow: hidden;
  color: var(--text);
  background: var(--ink-0);
  font-family: "Bahnschrift", "PingFang SC", "Microsoft YaHei", sans-serif;
}

.lab-header {
  position: relative;
  z-index: 10;
  height: 68px;
  padding: 0 22px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--line);
  background: linear-gradient(90deg, #07131d 0%, #081720 60%, #071117 100%);
}

.lab-header::after {
  position: absolute;
  right: 0;
  bottom: -1px;
  width: 34%;
  height: 1px;
  content: "";
  background: linear-gradient(90deg, transparent, rgba(68, 238, 224, 0.75));
}

.brand-block,
.brand-line,
.header-metrics,
.catalog-heading,
.panel-toolbar,
.scope-line,
.editor-actions,
.map-footer {
  display: flex;
  align-items: center;
}

.brand-block { gap: 13px; }
.brand-mark { position: relative; width: 34px; height: 34px; transform: rotate(30deg); }
.brand-mark span { position: absolute; inset: 4px; border: 1px solid var(--cyan); }
.brand-mark span:nth-child(2) { inset: 10px; opacity: 0.7; }
.brand-mark span:nth-child(3) { inset: 15px; background: var(--cyan); box-shadow: 0 0 18px var(--cyan); }
.brand-line { gap: 10px; }
.brand-line strong { font-size: 17px; letter-spacing: 0.04em; }
.edition { padding: 3px 6px; color: #061518; background: var(--cyan); font: 700 9px/1 "Cascadia Code", monospace; letter-spacing: 0.12em; }
.brand-block p { margin: 3px 0 0; color: var(--muted); font-size: 11px; letter-spacing: 0.08em; }

.header-metrics { align-self: stretch; }
.header-metrics > div { min-width: 126px; height: 100%; padding: 0 20px; display: flex; flex-direction: column; justify-content: center; border-left: 1px solid var(--line); }
.header-metrics span { margin-bottom: 4px; color: #65818d; font-size: 9px; letter-spacing: 0.14em; }
.header-metrics strong { color: #bcd5db; font: 600 11px/1.2 "Cascadia Code", monospace; letter-spacing: 0.08em; }
.header-metrics .runtime-dot { min-width: 112px; flex-direction: row; align-items: center; gap: 9px; }
.runtime-dot i,
.console-state i,
.map-footer i { width: 6px; height: 6px; border-radius: 50%; background: #71838b; }
.runtime-dot.success i,
.run-console.success i,
.map-footer i { background: var(--cyan); box-shadow: 0 0 10px var(--cyan); }
.runtime-dot.running i,
.run-console.running i { background: var(--amber); box-shadow: 0 0 10px var(--amber); animation: pulse 0.9s infinite alternate; }
.runtime-dot.error i,
.run-console.error i { background: #ff655f; box-shadow: 0 0 10px #ff655f; }

.lab-grid {
  height: calc(100% - 68px);
  display: grid;
  grid-template-columns: 218px 44px minmax(420px, 1fr);
  transition: grid-template-columns 240ms cubic-bezier(0.22, 1, 0.36, 1) 150ms;
}
.lab-grid.code-panel-open {
  grid-template-columns: 218px 430px minmax(420px, 1fr);
  transition-delay: 0ms;
}

.catalog-panel,
.code-panel { min-height: 0; border-right: 1px solid var(--line); background: var(--ink-1); }
.catalog-panel { padding: 22px 0 14px; display: flex; flex-direction: column; }
.panel-kicker { color: #4d6f7b; font: 700 9px/1 "Cascadia Code", monospace; letter-spacing: 0.18em; }
.catalog-panel > .panel-kicker,
.catalog-heading { margin-left: 18px; margin-right: 18px; }
.catalog-heading { margin-top: 8px; justify-content: space-between; }
.catalog-heading h1,
.panel-toolbar h2 { margin: 0; font-size: 18px; font-weight: 600; }
.catalog-heading span { color: var(--cyan); font: 700 12px "Cascadia Code", monospace; }
.layer-nav { margin-top: 18px; overflow: auto; scrollbar-width: thin; scrollbar-color: #21414d transparent; }
.layer-group { margin-bottom: 18px; }
.layer-group h2 { margin: 0 18px 6px; color: #5c7884; font-size: 10px; font-weight: 600; letter-spacing: 0.12em; }
.layer-item { position: relative; width: 100%; min-height: 48px; padding: 6px 12px 6px 18px; display: grid; grid-template-columns: 25px 1fr 10px; align-items: center; gap: 7px; border: 0; border-left: 2px solid transparent; color: #8eabb6; text-align: left; background: transparent; cursor: pointer; }
.layer-item:hover { background: rgba(87, 187, 194, 0.06); color: #d5eef0; }
.layer-item.active { border-left-color: var(--cyan); color: #efffff; background: linear-gradient(90deg, rgba(68, 238, 224, 0.13), transparent); }
.layer-item.active::after { position: absolute; right: 0; width: 1px; height: 55%; content: ""; background: var(--cyan); box-shadow: 0 0 13px var(--cyan); }
.layer-index { color: #496773; font: 10px "Cascadia Code", monospace; }
.layer-copy { display: flex; flex-direction: column; min-width: 0; }
.layer-copy strong { overflow: hidden; font-size: 12px; font-weight: 500; white-space: nowrap; text-overflow: ellipsis; }
.layer-copy small { margin-top: 3px; overflow: hidden; color: #4f6a75; font: 8px "Cascadia Code", monospace; white-space: nowrap; text-overflow: ellipsis; }
.layer-arrow { color: #365661; font-size: 18px; }

.code-panel { min-width: 0; display: grid; grid-template-columns: 44px minmax(0, 1fr); overflow: hidden; background: #07121a; }
.code-panel-toggle { position: relative; z-index: 2; width: 44px; min-height: 0; padding: 14px 0; display: flex; flex-direction: column; align-items: center; gap: 14px; border: 0; border-right: 1px solid #173541; color: #6c929e; background: linear-gradient(180deg, #0a1a24, #07121a); cursor: pointer; }
.code-panel-toggle:hover { color: var(--cyan); background: #0b2029; }
.toggle-arrow { width: 26px; height: 26px; display: grid; place-items: center; border: 1px solid #24505b; color: var(--cyan); background: #081821; font: 22px/1 "Cascadia Code", monospace; box-shadow: 0 0 16px rgba(68, 238, 224, 0.08); transition: transform 240ms cubic-bezier(0.22, 1, 0.36, 1), background-color 180ms ease; }
.toggle-arrow.open { transform: rotate(180deg); }
.toggle-label { writing-mode: vertical-rl; color: currentColor; font: 700 8px/1 "Cascadia Code", monospace; letter-spacing: 0.18em; }
.code-panel-body { box-sizing: border-box; min-width: 370px; min-height: 0; height: 100%; padding: 20px 18px 16px; display: flex; flex-direction: column; overflow: hidden; visibility: visible; opacity: 1; transform: translateX(0); transition: opacity 190ms ease 150ms, transform 230ms cubic-bezier(0.22, 1, 0.36, 1) 120ms, visibility 0s linear 0s; }
.code-panel.collapsed .code-panel-body { visibility: hidden; opacity: 0; transform: translateX(-10px); pointer-events: none; transition: opacity 140ms ease 0ms, transform 160ms ease 0ms, visibility 0s linear 140ms; }
.panel-toolbar { min-height: 38px; justify-content: space-between; }
.panel-toolbar h2 { margin-top: 7px; font: 600 15px "Cascadia Code", monospace; }
.changed-badge { padding: 4px 7px; border: 1px solid rgba(255, 200, 92, 0.45); color: var(--amber); font: 9px "Cascadia Code", monospace; }
.example-summary { min-height: 34px; margin: 11px 0 8px; color: #7f9ba6; font-size: 11px; line-height: 1.55; }
.scope-line { min-height: 27px; gap: 5px; overflow: hidden; }
.scope-line span { margin-right: 4px; color: #4d6b76; font-size: 9px; }
.scope-line code { padding: 2px 5px; color: #76b8bd; background: #0c202a; font: 9px "Cascadia Code", monospace; }

.editor-shell { min-height: 220px; flex: 1; overflow: hidden; border: 1px solid #16303a; background: #050d13; box-shadow: inset 0 1px 18px rgba(0, 0, 0, 0.25); }

.run-console { min-height: 38px; margin-top: 10px; padding: 8px 10px; display: flex; align-items: center; justify-content: space-between; gap: 10px; border-left: 2px solid #29424c; color: #73909a; background: #091821; font: 10px/1.4 "Cascadia Code", monospace; }
.run-console.success { border-left-color: var(--cyan); color: #98d7d4; }
.run-console.running { border-left-color: var(--amber); }
.run-console.error { border-left-color: #ff655f; color: #ffaaa6; }
.console-state { min-width: 0; display: flex; align-items: center; gap: 9px; }
.console-state span { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.run-console time { flex: 0 0 auto; color: #55717c; }
.editor-actions { padding-top: 12px; gap: 8px; }
.run-button,
.text-button,
.home-button { border: 0; cursor: pointer; }
.run-button { height: 34px; padding: 0 15px; display: inline-flex; align-items: center; gap: 8px; color: #052124; background: var(--cyan); font-size: 11px; font-weight: 700; box-shadow: 0 0 20px rgba(68, 238, 224, 0.15); }
.run-button:hover { background: #82fff4; }
.run-button:disabled { color: #52676a; background: #173238; cursor: not-allowed; box-shadow: none; }
.text-button { height: 34px; padding: 0 12px; border: 1px solid #1e3c47; color: #7e9ca6; background: transparent; font-size: 10px; }
.text-button:disabled { opacity: 0.35; cursor: default; }
.editor-actions kbd { margin-left: auto; color: #49646e; font: 9px "Cascadia Code", monospace; }

.map-panel { position: relative; min-width: 0; min-height: 0; overflow: hidden; background: #031018; }
.map-panel::after { position: absolute; inset: 0; z-index: 2; pointer-events: none; content: ""; box-shadow: inset 0 0 80px rgba(0, 12, 18, 0.38); }
.map-title-card { position: absolute; z-index: 4; top: 20px; left: 20px; min-width: 178px; padding: 12px 15px 13px; border-left: 2px solid var(--cyan); background: rgba(3, 17, 25, 0.82); backdrop-filter: blur(8px); }
.map-title-card span { display: block; color: var(--cyan); font: 8px "Cascadia Code", monospace; letter-spacing: 0.18em; }
.map-title-card strong { display: block; margin-top: 8px; font-size: 17px; font-weight: 500; }
.map-title-card small { display: block; margin-top: 4px; color: #668590; font: 9px "Cascadia Code", monospace; }
.home-button { position: absolute; z-index: 4; top: 20px; right: 20px; width: 36px; height: 36px; border: 1px solid rgba(99, 187, 194, 0.3); color: #a8dadb; background: rgba(4, 22, 31, 0.8); font-size: 20px; }
.home-button:hover { border-color: var(--cyan); color: var(--cyan); }
.map-footer { position: absolute; z-index: 4; right: 20px; bottom: 16px; left: 20px; justify-content: space-between; color: #73949f; font: 9px "Cascadia Code", monospace; letter-spacing: 0.06em; pointer-events: none; }
.map-footer span:first-child { display: flex; align-items: center; gap: 8px; }

@keyframes pulse { from { opacity: 0.4; } to { opacity: 1; } }

@media (max-width: 1180px) {
  .lab-grid { grid-template-columns: 188px 44px minmax(360px, 1fr); }
  .lab-grid.code-panel-open { grid-template-columns: 188px 350px minmax(360px, 1fr); }
  .code-panel-body { min-width: 306px; }
  .header-metrics > div:nth-child(2) { display: none; }
}

@media (max-width: 900px) {
  .layer-lab { overflow: auto; }
  .lab-header { position: sticky; top: 0; height: 60px; padding: 0 14px; }
  .brand-block p,
  .header-metrics > div:not(.runtime-dot) { display: none; }
  .header-metrics .runtime-dot { min-width: auto; padding: 0 10px; }
  .lab-grid { height: auto; min-height: calc(100% - 60px); grid-template-columns: 150px 44px minmax(540px, 1fr); }
  .lab-grid.code-panel-open { grid-template-columns: 150px 350px minmax(540px, 1fr); }
  .code-panel-body { min-width: 286px; }
  .catalog-panel,
  .code-panel,
  .map-panel { min-height: calc(100vh - 60px); }
}

@media (prefers-reduced-motion: reduce) {
  .lab-grid,
  .code-panel-body,
  .toggle-arrow { transition: none; }
}
</style>
