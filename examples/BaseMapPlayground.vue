<script setup>
import { computed, nextTick, onBeforeUnmount, ref } from 'vue'
import * as Cesium from 'cesium'
import { BaseMaps, BMapViewer } from '../src/sdk/index.js'
import CodeExampleEditor from './CodeExampleEditor.vue'
import { baseMapExamples, baseMapGroups } from './base-maps/index.js'

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
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor

const mapRef = ref(null)
const activeId = ref(baseMapExamples[0].id)
const code = ref(baseMapExamples[0].code)
const isCodePanelOpen = ref(false)
const viewerReady = ref(false)
const runState = ref('idle')
const runMessage = ref('等待 Cesium 初始化')
const runDuration = ref(null)
const coordinate = ref(null)

let viewer = null
let activeCleanup = null
let runVersion = 0
let resizeTimer = null

const activeExample = computed(() => baseMapExamples.find((item) => item.id === activeId.value) || baseMapExamples[0])
const groupedExamples = computed(() => baseMapGroups.map((group) => ({
  group,
  items: baseMapExamples.filter((item) => item.group === group),
})))
const isModified = computed(() => code.value !== activeExample.value.code)
const statusLabel = computed(() => ({
  idle: '待运行',
  running: '切换中',
  success: '底图已就绪',
  error: '运行失败',
}[runState.value]))

function readImageryLayers() {
  const layers = []
  if (!viewer || viewer.isDestroyed()) return layers
  for (let index = 0; index < viewer.imageryLayers.length; index += 1) {
    layers.push(viewer.imageryLayers.get(index))
  }
  return layers
}

async function disposeActive() {
  if (!activeCleanup) return
  const cleanup = activeCleanup
  activeCleanup = null
  try {
    await cleanup()
  } catch (error) {
    console.warn('底图示例清理失败：', error)
  }
}

async function runCode() {
  if (!viewer || viewer.isDestroyed() || runState.value === 'running') return
  const startTime = performance.now()
  const currentRun = ++runVersion
  runState.value = 'running'
  runDuration.value = null
  runMessage.value = `正在加载 ${activeExample.value.title}`

  await disposeActive()
  if (currentRun !== runVersion) return

  mapRef.value?.flyTo(HOME_CAMERA, 0)
  const before = new Set(readImageryLayers())

  try {
    const execute = new AsyncFunction(
      'Cesium',
      'BaseMaps',
      'viewer',
      'tileUrl',
      `'use strict';\n${code.value}`,
    )
    const result = await execute(Cesium, BaseMaps, viewer, tileUrl)
    const createdLayers = readImageryLayers().filter((layer) => !before.has(layer))
    const cleanup = async () => {
      if (typeof result === 'function') await result()
      else if (typeof result?.destroy === 'function') result.destroy()
      else if (typeof result?.remove === 'function') result.remove()

      if (!viewer || viewer.isDestroyed()) return
      createdLayers
        .filter((layer) => viewer.imageryLayers.contains(layer))
        .forEach((layer) => viewer.imageryLayers.remove(layer, true))
    }

    if (currentRun !== runVersion) {
      await cleanup()
      return
    }

    activeCleanup = cleanup
    if (result?.readyPromise) await result.readyPromise
    if (currentRun !== runVersion) { await cleanup(); return }
    runState.value = 'success'
    runMessage.value = `${activeExample.value.title} 已加载`
    runDuration.value = Math.round(performance.now() - startTime)
  } catch (error) {
    if (currentRun !== runVersion) return
    await disposeActive()
    readImageryLayers()
      .filter((layer) => !before.has(layer))
      .forEach((layer) => viewer.imageryLayers.remove(layer, true))
    runState.value = 'error'
    runMessage.value = error?.message || String(error)
    runDuration.value = Math.round(performance.now() - startTime)
    console.error('底图示例运行失败：', error)
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
  runMessage.value = 'Cesium 已就绪'
  await nextTick()
  runCode()
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
  disposeActive()
  viewer = null
})
</script>

<template>
  <div class="base-map-lab">
    <header class="lab-header">
      <div class="brand-block">
        <span class="brand-mark" aria-hidden="true"><i></i></span>
        <div><strong>BaseMaps</strong><p>Cesium 多源底图交互式示例工作台</p></div>
      </div>
      <div class="header-metrics">
        <div><span>底图示例</span><strong>{{ baseMapExamples.length }}</strong></div>
        <div><span>坐标支持</span><strong>WGS84 / GCJ02 / BD09</strong></div>
        <div class="runtime-dot" :class="runState"><i></i><strong>{{ statusLabel }}</strong></div>
      </div>
    </header>

    <main class="lab-grid" :class="{ 'code-panel-open': isCodePanelOpen }">
      <aside class="catalog-panel">
        <span class="panel-kicker">BASE MAP INDEX</span>
        <div class="catalog-heading"><h1>底图目录</h1><b>{{ baseMapExamples.length }}</b></div>
        <nav aria-label="底图示例">
          <section v-for="section in groupedExamples" :key="section.group">
            <h2>{{ section.group }}</h2>
            <button
              v-for="example in section.items"
              :key="example.id"
              type="button"
              :class="{ active: activeId === example.id }"
              @click="selectExample(example)"
            >
              <span>{{ String(baseMapExamples.indexOf(example) + 1).padStart(2, '0') }}</span>
              <span><strong>{{ example.title }}</strong><small>{{ example.name }}</small></span>
              <i>›</i>
            </button>
          </section>
        </nav>
      </aside>

      <section class="code-panel" :class="{ collapsed: !isCodePanelOpen }" aria-label="底图示例代码编辑器">
        <button
          type="button"
          class="code-toggle"
          :aria-expanded="isCodePanelOpen"
          aria-controls="base-map-code-panel-body"
          :title="isCodePanelOpen ? '收起示例代码' : '展开示例代码'"
          @click="toggleCodePanel"
        ><span :class="{ open: isCodePanelOpen }">›</span><b>EDITABLE EXAMPLE</b></button>

        <div id="base-map-code-panel-body" class="code-body" :aria-hidden="!isCodePanelOpen">
          <div class="code-heading">
            <div><span class="panel-kicker">EDITABLE EXAMPLE</span><h2>{{ activeExample.name }}</h2></div>
            <em v-if="isModified">已修改</em>
          </div>
          <p>{{ activeExample.summary }}</p>
          <div class="scope-line"><span>可用变量</span><code>Cesium</code><code>BaseMaps</code><code>viewer</code><code>tileUrl</code></div>
          <div class="editor-shell">
            <CodeExampleEditor
              v-model="code"
              accent="cyan"
              aria-label="可编辑底图 JavaScript 示例代码"
              @run="runCode"
            />
          </div>
          <div class="run-status" :class="runState"><span><i></i>{{ runMessage }}</span><time v-if="runDuration">{{ runDuration }} ms</time></div>
          <div class="code-actions">
            <button type="button" :disabled="!viewerReady || runState === 'running'" @click="runCode">▶ 运行当前示例</button>
            <button type="button" :disabled="!isModified" @click="resetCode">恢复代码</button>
            <span>Ctrl ↵</span>
          </div>
        </div>
      </section>

      <section class="map-panel" aria-label="BaseMaps Cesium 运行预览">
        <BMapViewer
          ref="mapRef"
          :camera="HOME_CAMERA"
          :scene-mode="1"
          base-color="#102332"
          @ready="handleViewerReady"
          @error="(error) => { runState = 'error'; runMessage = error?.message || 'Cesium 初始化失败' }"
          @click="handleMapClick"
        />
        <div class="map-title"><span>LIVE BASE MAP</span><strong>{{ activeExample.title }}</strong><small>{{ activeExample.name }}</small></div>
        <div class="map-guide">◇ 默认使用 public/tiles；远程服务需遵循提供方许可、Key 与网络策略</div>
        <div class="map-footer"><span>BASE MAP · {{ activeExample.id.toUpperCase() }}</span><span>{{ coordinate || statusLabel }}</span></div>
      </section>
    </main>
  </div>
</template>

<style scoped>
.base-map-lab { --bg: #050c12; --panel: #07141c; --line: #17323d; --cyan: #45eadf; width: 100%; height: 100%; display: grid; grid-template-rows: 68px minmax(0, 1fr); overflow: hidden; color: #dff5f3; background: var(--bg); font-family: "Bahnschrift", "PingFang SC", "Microsoft YaHei", sans-serif; }
.lab-header { padding-left: 20px; display: flex; align-items: stretch; justify-content: space-between; border-bottom: 1px solid var(--line); background: #061018; }
.brand-block { display: flex; align-items: center; gap: 14px; }
.brand-block strong { font: 600 17px "Cascadia Code", monospace; letter-spacing: .04em; }
.brand-block p { margin: 5px 0 0; color: #6f9299; font-size: 10px; }
.brand-mark { width: 34px; height: 34px; display: grid; place-items: center; border: 1px solid #3db4cb; transform: rotate(45deg); }
.brand-mark i { width: 14px; height: 14px; border: 1px solid var(--cyan); }
.header-metrics { display: flex; }
.header-metrics > div { min-width: 145px; padding: 0 20px; display: grid; align-content: center; gap: 5px; border-left: 1px solid var(--line); }
.header-metrics span { color: #537780; font-size: 8px; letter-spacing: .08em; }
.header-metrics strong { font: 600 10px "Cascadia Code", monospace; }
.runtime-dot { grid-template-columns: 8px auto; align-items: center; }
.runtime-dot i, .run-status i { width: 5px; height: 5px; border-radius: 50%; background: #729099; }
.runtime-dot.success i, .run-status.success i { background: var(--cyan); box-shadow: 0 0 9px var(--cyan); }
.runtime-dot.error i, .run-status.error i { background: #ff6e75; }
.lab-grid { min-height: 0; display: grid; grid-template-columns: 220px 44px minmax(0, 1fr); transition: grid-template-columns 240ms cubic-bezier(.22,1,.36,1) 150ms; }
.lab-grid.code-panel-open { grid-template-columns: 220px minmax(360px, 430px) minmax(0, 1fr); transition-delay: 0ms; }
.catalog-panel { min-width: 0; overflow: auto; border-right: 1px solid var(--line); background: var(--panel); }
.panel-kicker { color: #5f9ca8; font: 8px "Cascadia Code", monospace; letter-spacing: .16em; }
.catalog-panel > .panel-kicker { display: block; padding: 18px 18px 7px; }
.catalog-heading { padding: 0 18px 13px; display: flex; align-items: center; justify-content: space-between; }
.catalog-heading h1 { margin: 0; font-size: 19px; }
.catalog-heading b { color: var(--cyan); font: 11px "Cascadia Code", monospace; }
.catalog-panel section h2 { margin: 0; padding: 11px 18px 7px; color: #476a74; font: 8px "Cascadia Code", monospace; letter-spacing: .13em; border-top: 1px solid #102934; }
.catalog-panel nav button { width: 100%; min-height: 52px; padding: 8px 13px 8px 18px; display: grid; grid-template-columns: 26px 1fr 10px; align-items: center; gap: 9px; border: 0; border-left: 2px solid transparent; color: #73939b; background: transparent; text-align: left; cursor: pointer; }
.catalog-panel nav button:hover { background: #0a1d27; }
.catalog-panel nav button.active { border-left-color: var(--cyan); color: #eaffff; background: #0d2230; }
.catalog-panel nav button > span:first-child { color: #40707e; font: 8px "Cascadia Code", monospace; }
.catalog-panel nav button > span:nth-child(2) { display: grid; gap: 4px; }
.catalog-panel nav strong { font-size: 11px; font-weight: 500; }
.catalog-panel nav small { color: #416a77; font: 8px "Cascadia Code", monospace; }
.catalog-panel nav i { color: #39aebd; font-style: normal; }
.code-panel { position: relative; z-index: 5; min-width: 0; display: grid; grid-template-columns: 44px minmax(0, 1fr); overflow: hidden; border-right: 1px solid var(--line); background: #06121a; }
.code-toggle { position: relative; z-index: 8; width: 44px; min-height: 0; padding: 14px 0; display: flex; flex-direction: column; align-items: center; gap: 14px; border: 0; border-right: 1px solid var(--line); color: #6c929e; background: linear-gradient(180deg, #0a1a24, #07121a); cursor: pointer; }
.code-toggle:hover { color: var(--cyan); background: #0b2029; }
.code-toggle span { width: 26px; height: 26px; display: grid; place-items: center; border: 1px solid #24505b; color: var(--cyan); background: #081821; font: 22px/1 "Cascadia Code", monospace; transition: transform 240ms cubic-bezier(.22,1,.36,1), background-color 180ms ease; }
.code-toggle span.open { transform: rotate(180deg); }
.code-toggle b { writing-mode: vertical-rl; color: currentColor; font: 700 8px/1 "Cascadia Code", monospace; letter-spacing: .18em; }
.code-body { box-sizing: border-box; min-width: 386px; min-height: 0; height: 100%; padding: 22px 20px 18px; display: grid; grid-template-rows: auto auto auto minmax(0, 1fr) auto auto; gap: 10px; overflow: hidden; visibility: visible; opacity: 1; transform: translateX(0); transition: opacity 190ms ease 150ms, transform 230ms cubic-bezier(.22,1,.36,1) 120ms, visibility 0s linear 0s; }
.collapsed .code-body { visibility: hidden; opacity: 0; transform: translateX(-10px); pointer-events: none; transition: opacity 140ms ease 0ms, transform 160ms ease 0ms, visibility 0s linear 140ms; }
.code-heading { display: flex; justify-content: space-between; align-items: start; }
.code-heading h2 { margin: 8px 0 0; font: 600 14px "Cascadia Code", monospace; }
.code-heading em { padding: 3px 6px; color: #f2ca71; background: #2a2414; font-size: 8px; font-style: normal; }
.code-body > p { margin: 0; color: #78969d; font-size: 10px; line-height: 1.6; }
.scope-line { display: flex; align-items: center; gap: 5px; overflow: hidden; }
.scope-line span { margin-right: 4px; color: #4d6b76; font-size: 8px; }
.scope-line code { padding: 2px 5px; color: #76b8bd; background: #0c202a; font: 8px "Cascadia Code", monospace; }
.editor-shell { min-height: 0; overflow: hidden; border: 1px solid #183542; background: #030c12; }
.run-status { min-height: 37px; padding: 0 11px; display: flex; align-items: center; justify-content: space-between; gap: 9px; color: #79a0a7; background: #091b24; font: 9px "Cascadia Code", monospace; }
.run-status > span { min-width: 0; display: flex; align-items: center; gap: 9px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.run-status time { flex: 0 0 auto; color: #4e7079; }
.code-actions { min-height: 34px; display: flex; align-items: center; gap: 8px; }
.code-actions button { min-height: 34px; padding: 0 12px; border: 1px solid #173641; color: #69868e; background: transparent; cursor: pointer; font-size: 9px; }
.code-actions button:first-child { border-color: #58c7ff; color: #071017; background: #58c7ff; font-weight: 700; }
.code-actions button:disabled { opacity: .35; cursor: not-allowed; }
.code-actions span { margin-left: auto; color: #41616a; font: 8px "Cascadia Code", monospace; }
.map-panel { position: relative; min-width: 0; overflow: hidden; background: #0c2535; }
.map-title { position: absolute; z-index: 2; top: 20px; left: 22px; padding: 10px 15px; display: grid; gap: 5px; border-left: 2px solid #63c8ff; background: rgba(5, 24, 35, .82); pointer-events: none; }
.map-title span, .map-title small { color: #5e9cad; font: 8px "Cascadia Code", monospace; letter-spacing: .1em; }
.map-title strong { font-size: 16px; font-weight: 500; }
.map-guide { position: absolute; z-index: 2; right: 20px; bottom: 34px; left: 20px; padding: 12px; color: #8fb4ba; background: rgba(5, 24, 35, .88); border-left: 2px solid #58c7ff; font-size: 9px; pointer-events: none; }
.map-footer { position: absolute; z-index: 2; right: 15px; bottom: 10px; left: 15px; display: flex; justify-content: space-between; color: #5e8790; font: 8px "Cascadia Code", monospace; pointer-events: none; }
button:focus-visible { outline: 2px solid var(--cyan); outline-offset: -2px; }
@media (max-width: 900px) { .header-metrics > div:nth-child(2) { display: none; } .lab-grid { grid-template-columns: 190px 44px minmax(540px, 1fr); } .lab-grid.code-panel-open { grid-template-columns: 190px 430px minmax(540px, 1fr); } .code-body { min-width: 386px; } }
@media (prefers-reduced-motion: reduce) { .lab-grid, .code-body, .code-toggle span { transition: none; } }
</style>
