<script setup>
import { computed, defineAsyncComponent, nextTick, onBeforeUnmount, ref } from 'vue'
import { BaseMaps, BMapViewer, MapLayers, PickTools, SpatialAnalysis } from '../src/sdk/index.js'
import { analysisExamples } from './analysis/index.js'

const props = defineProps({ preview: { type: Boolean, default: false } })
const CodeExampleEditor = defineAsyncComponent(() => import('./CodeExampleEditor.vue'))
const HOME_CAMERA = {
  longitude: 125.823,
  latitude: 44.148,
  height: 7600,
  pitch: -68,
  minHeight: 40,
  maxHeight: 800000,
}
const previewId = new URLSearchParams(window.location.search).get('analysis-preview')
const initialExample = analysisExamples.find((item) => item.id === previewId) || analysisExamples[0]
const activeId = ref(initialExample.id)
const activeExample = computed(() => analysisExamples.find((item) => item.id === activeId.value))
const isCircleResult = computed(() => activeExample.value.resultType === 'circle-area')
const isOverlapResult = computed(() => activeExample.value.resultType === 'overlap-area')
const isAreaResult = computed(() => activeExample.value.resultType === 'area' || isCircleResult.value || isOverlapResult.value)
const code = ref(initialExample.code)
const isModified = computed(() => code.value !== activeExample.value.code)
const isCodePanelOpen = ref(false)
const mapRef = ref(null)
const runState = ref('idle')
const runMessage = ref('等待地图初始化')
const result = ref(null)
const customSummary = computed(() => result.value && activeExample.value.summarize ? activeExample.value.summarize(result.value) : null)
const resultText = computed(() => result.value
  ? JSON.stringify(result.value, null, 2)
  : '等待地图操作…')
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor
const publicRoot = new URL(import.meta.env.BASE_URL, window.location.href)
const tileUrl = new URL('tiles/{z}/{x}/{reverseY}.png', publicRoot).href
let viewer = null
let baseMap = null
let activeCleanup = null
let runVersion = 0
let resizeTimer = null

const statusLabel = computed(() => ({
  idle: '等待初始化', running: '正在运行', active: '等待拾取', done: '分析完成', error: '运行失败',
}[runState.value]))
const runLabel = computed(() => activeExample.value.interactive ? '重新绘制' : '重新计算')

function formatDistance(value, unit = result.value.unit) {
  return `${value.toFixed(unit === 'km' ? 3 : 2)} ${unit}`
}

function formatArea(value, unit) {
  return `${value.toFixed(unit === 'm2' ? 2 : 4)} ${{ m2: 'm²', km2: 'km²', ha: 'ha' }[unit]}`
}

async function disposeActive() {
  const cleanup = activeCleanup
  activeCleanup = null
  if (!cleanup) return
  try {
    await cleanup()
  } catch (error) {
    console.warn('空间分析示例清理失败：', error)
  }
}

async function runCode() {
  if (!viewer || viewer.isDestroyed() || runState.value === 'running') return
  const currentRun = ++runVersion
  const currentViewer = viewer
  runState.value = 'running'
  runMessage.value = `正在运行${activeExample.value.title}`
  result.value = null
  await disposeActive()
  if (currentRun !== runVersion || currentViewer.isDestroyed()) return
  mapRef.value?.flyTo(HOME_CAMERA, 0)

  const entitySnapshot = new Set(currentViewer.entities.values)
  let returned
  let disposed = false
  const cleanup = async () => {
    if (disposed) return
    disposed = true
    try {
      if (typeof returned === 'function') await returned()
      else await returned?.destroy?.()
    } finally {
      if (!currentViewer.isDestroyed()) {
        // Entity 的显示集合由 Cesium 管理，首次拾取时才加入场景。
        // 只移除本次新增的实体；图层由返回的清理函数销毁。
        currentViewer.entities.values
          .filter((entity) => !entitySnapshot.has(entity))
          .forEach((entity) => currentViewer.entities.remove(entity))
        const controller = currentViewer.scene.screenSpaceCameraController
        controller.enableRotate = controller.enableTranslate = controller.enableZoom = true
        document.body.style.cursor = 'default'
        currentViewer.scene.requestRender()
      }
    }
  }

  try {
    const execute = new AsyncFunction('SpatialAnalysis', 'PickTools', 'MapLayers', 'viewer', 'onResult', 'onError', `'use strict';\n${code.value}`)
    returned = await execute(SpatialAnalysis, PickTools, MapLayers, currentViewer, (data) => {
      if (currentRun !== runVersion) return
      result.value = data
      runState.value = 'done'
      runMessage.value = activeExample.value.summarize
        ? `${activeExample.value.name} 分析完成：${activeExample.value.summarize(data).value}`
        : isOverlapResult.value
        ? data.hasOverlap ? `已计算重叠面积，共 ${data.parts.length} 个交叠区域` : '两区域无重叠面积'
        : isCircleResult.value
        ? `已计算圆面积，半径 ${formatDistance(data.radius, data.radiusUnit)}`
        : isAreaResult.value ? `已计算面积，共 ${data.vertexCount} 个顶点` : `已计算 ${data.segments.length} 段距离`
    }, (error) => {
      if (currentRun !== runVersion) return
      result.value = null
      runState.value = 'error'
      runMessage.value = error?.message || String(error)
    })
    if (currentRun !== runVersion) {
      await cleanup()
      return
    }
    activeCleanup = cleanup
    runState.value = result.value ? 'done' : 'active'
    if (!result.value) runMessage.value = activeExample.value.instruction
  } catch (error) {
    await cleanup()
    if (currentRun !== runVersion) return
    runState.value = 'error'
    runMessage.value = error?.message || String(error)
    console.error('空间分析示例运行失败：', error)
  }
}

async function selectExample(example) {
  if (activeId.value === example.id || runState.value === 'running') return
  activeId.value = example.id
  code.value = example.code
  await runCode()
}

async function handleViewerReady(readyViewer) {
  viewer = readyViewer
  baseMap = new BaseMaps.BaseMap(viewer, {
    type: 'offline', url: tileUrl, crs: 'GCJ02',
    minimumLevel: 1, maximumLevel: 12, themeColor: '#34A4FF',
  })
  await runCode()
}

function handleMapError(error) {
  runState.value = 'error'
  runMessage.value = error?.message || '地图初始化失败'
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
  baseMap?.destroy()
  baseMap = null
  viewer = null
})
</script>

<template>
  <div class="analysis-lab" :class="{ 'is-preview': props.preview }">
    <header v-if="!props.preview" class="lab-header">
      <div><strong>SpatialAnalysis</strong><span class="edition">GEO LAB</span><p>空间分析 · 测量、查询与区域运算</p></div>
      <div class="header-info"><span>WGS84 · TURF</span><span :class="runState">{{ statusLabel }}</span></div>
    </header>
    <main class="lab-grid" :class="{ 'code-panel-open': isCodePanelOpen }">
      <aside v-if="!props.preview" class="catalog-panel">
        <small>SPATIAL ANALYSIS</small>
        <h1>空间分析目录 <span>{{ analysisExamples.length }}</span></h1>
        <nav aria-label="空间分析示例">
          <button v-for="(example, index) in analysisExamples" :key="example.id" type="button" :class="{ active: activeId === example.id }" :disabled="runState === 'running'" @click="selectExample(example)">
            <small>{{ String(index + 1).padStart(2, '0') }}</small>
            <span><strong>{{ example.title }}</strong><small>{{ example.name }}</small></span><b>›</b>
          </button>
        </nav>
        <p class="catalog-note">{{ activeExample.guide || '相邻坐标组成一个分段。分段距离显示在中点，总距离标记在终点。' }}</p>
      </aside>
      <section v-if="!props.preview" class="code-panel" aria-label="空间分析示例代码">
        <button class="code-toggle" type="button" :aria-expanded="isCodePanelOpen" aria-controls="analysis-code-body" :title="isCodePanelOpen ? '收起代码' : '展开代码'" @click="toggleCodePanel"><b :class="{ open: isCodePanelOpen }">›</b><span>EDITABLE EXAMPLE</span></button>
        <div id="analysis-code-body" class="code-body" :inert="!isCodePanelOpen" :aria-hidden="!isCodePanelOpen">
          <small>EDITABLE EXAMPLE</small>
          <h2>{{ activeExample.title }} <em v-if="isModified">已修改</em></h2>
          <p>{{ activeExample.summary }}</p>
          <div class="scope-line"><span>可用变量</span><code v-for="name in ['SpatialAnalysis', 'PickTools', 'MapLayers', 'viewer', 'onResult', 'onError']" :key="name">{{ name }}</code></div>
          <div class="editor-shell"><CodeExampleEditor v-model="code" accent="cyan" aria-label="空间分析 JavaScript 代码" @run="runCode" /></div>
          <div class="run-console" :class="runState" role="status">{{ runMessage }}</div>
          <section class="callback-result" aria-label="分析方法返回数据">
            <div><span>CALLBACK RESULT</span><small>{{ result?.unit || activeExample.resultUnitLabel || (isAreaResult ? 'm² / km² / ha' : 'm / km') }}</small></div>
            <pre tabindex="0">{{ resultText }}</pre>
          </section>
          <div class="editor-actions"><button type="button" :disabled="!viewer || runState === 'running'" @click="runCode">▶ 运行当前示例</button><button type="button" :disabled="!isModified" @click="code = activeExample.code">恢复代码</button><kbd>Ctrl ↵</kbd></div>
        </div>
      </section>
      <section class="map-panel" aria-label="空间分析地图">
        <BMapViewer id="spatial-analysis-map" ref="mapRef" :camera="HOME_CAMERA" :scene-mode="1" @ready="handleViewerReady" @error="handleMapError" />
        <div class="map-title"><small>{{ activeExample.kicker || 'DISTANCE ANALYSIS' }}</small><strong>{{ activeExample.title }}</strong><span>{{ statusLabel }}</span></div>
        <div v-if="activeExample.legend" class="map-legend" aria-label="分析图例"><span v-for="item in activeExample.legend" :key="item.label"><i :style="{ backgroundColor: item.color }"></i>{{ item.label }}</span></div>
        <button v-if="activeExample.interactive || !props.preview" class="map-run" type="button" :disabled="runState === 'idle' || runState === 'running'" @click="runCode">↻ {{ runLabel }}</button>
        <aside v-if="result && !props.preview" class="result-panel" :aria-label="`${activeExample.title}结果`" aria-live="polite">
          <template v-if="customSummary">
            <div class="result-total"><span>{{ customSummary.title }}</span><strong>{{ customSummary.value }}</strong><small>{{ customSummary.detail }}</small></div>
            <div class="segment-list"><div v-for="row in customSummary.rows" :key="row[0]"><span>{{ row[0] }}</span><strong>{{ row[1] }}</strong></div></div>
          </template>
          <template v-else-if="isOverlapResult">
            <div class="result-total"><span>重叠面积</span><strong>{{ formatArea(result.area, result.unit) }}</strong><small>{{ result.hasOverlap ? `${result.parts.length} 个交叠区域` : '两区域无面积交叠' }}</small></div>
            <div class="segment-list"><div><span>默认区域面积</span><strong>{{ formatArea(result.firstArea, result.unit) }}</strong></div><div><span>拾取区域面积</span><strong>{{ formatArea(result.secondArea, result.unit) }}</strong></div><div><span>占默认区域</span><strong>{{ (result.firstRatio * 100).toFixed(1) }}%</strong></div><div><span>占拾取区域</span><strong>{{ (result.secondRatio * 100).toFixed(1) }}%</strong></div></div>
          </template>
          <template v-else-if="isAreaResult">
            <div class="result-total"><span>{{ isCircleResult ? '圆形面积' : '区域面积' }}</span><strong>{{ formatArea(result.area, result.unit) }}</strong><small>{{ isCircleResult ? '圆心与半径 · 球面分析' : `${result.vertexCount} 个顶点 · 自动闭合` }}</small></div>
            <div v-if="isCircleResult" class="segment-list"><div><span>半径</span><strong>{{ formatDistance(result.radius, result.radiusUnit) }}</strong></div><div><span>直径</span><strong>{{ formatDistance(result.diameter, result.radiusUnit) }}</strong></div></div>
            <div class="segment-list"><div><span>周长</span><strong>{{ formatDistance(result.perimeter, result.perimeterUnit) }}</strong></div><div><span>中心坐标</span><strong>{{ result.center.map((value) => value.toFixed(5)).join(', ') }}</strong></div></div>
          </template>
          <template v-else>
            <div class="result-total"><span>路径总距离</span><strong>{{ formatDistance(result.totalDistance) }}</strong><small>{{ result.segments.length }} 段 · {{ result.segments.length + 1 }} 个点</small></div>
            <div class="segment-list"><div v-for="segment in result.segments" :key="segment.index"><span>{{ segment.index + 1 }} → {{ segment.index + 2 }}</span><strong>{{ formatDistance(segment.distance) }}</strong></div></div>
          </template>
        </aside>
        <p class="map-instruction" :class="runState">{{ runState === 'error' ? runMessage : activeExample.instruction }}</p>
      </section>
    </main>
  </div>
</template>

<style scoped>
.analysis-lab { --accent: #a3d68a; --line: #19333d; --muted: #76949b; width: 100%; height: 100%; overflow: hidden; color: #e1f2f7; background: #07141c; font-family: "Bahnschrift", "Microsoft YaHei", sans-serif; }
.lab-header { height: 68px; padding: 0 24px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--line); }
.lab-header strong { font: 700 18px "Cascadia Code", Consolas, monospace; }
.edition { margin-left: 12px; padding: 3px 6px; color: #07141c; background: var(--accent); font: 700 9px monospace; }
.lab-header p { margin: 5px 0 0; color: var(--muted); font-size: 11px; }
.header-info { display: flex; gap: 28px; color: var(--accent); font: 11px "Cascadia Code", monospace; }
.lab-grid { height: calc(100% - 68px); display: grid; grid-template-columns: 218px 44px minmax(0, 1fr); transition: grid-template-columns 300ms ease; }
.lab-grid.code-panel-open { grid-template-columns: 218px 460px minmax(0, 1fr); }
.catalog-panel { position: relative; min-height: 0; display: flex; flex-direction: column; border-right: 1px solid var(--line); }
.catalog-panel > small, .catalog-panel h1 { flex-shrink: 0; }
nav { flex: 1 1 0; min-height: 0; overflow-y: auto; }
.catalog-panel > small { display: block; margin: 24px 18px 8px; }
small, .scope-line, kbd { color: var(--muted); font: 9px/1.5 "Cascadia Code", Consolas, monospace; }
.catalog-panel h1 { margin: 0; padding: 0 18px 22px; font-size: 20px; border-bottom: 1px solid var(--line); }
.catalog-panel h1 span { float: right; color: var(--accent); font: 12px monospace; }
nav button { width: 100%; min-height: 76px; padding: 14px 18px; display: flex; align-items: center; gap: 12px; color: var(--muted); border: 0; border-left: 2px solid transparent; background: transparent; cursor: pointer; text-align: left; }
nav button.active { color: #e1f2f7; border-left-color: var(--accent); background: #10242a; }
nav button span { flex: 1; min-width: 0; }
nav button strong { display: block; margin-bottom: 4px; font-size: 12px; }
nav button span small { font-size: 8px; overflow-wrap: anywhere; }
.catalog-note { flex: 0 0 auto; margin: 14px 16px; padding: 12px; border: 1px solid var(--line); color: var(--muted); font-size: 10px; line-height: 1.8; }
.code-panel { position: relative; min-width: 0; min-height: 0; overflow: hidden; border-right: 1px solid var(--line); }
.code-toggle { position: absolute; inset: 0 auto 0 0; width: 44px; display: flex; flex-direction: column; align-items: center; padding: 14px 0; gap: 14px; border: 0; border-right: 1px solid var(--line); color: var(--accent); background: #0b1d25; cursor: pointer; }
.code-toggle b { width: 24px; height: 24px; border: 1px solid #365347; font: 26px/22px sans-serif; transition: transform 300ms ease; }
.code-toggle b.open { transform: rotate(180deg); }
.code-toggle span { writing-mode: vertical-rl; color: var(--muted); font: 8px monospace; letter-spacing: 0.15em; }
.code-body { width: 416px; height: 100%; margin-left: 44px; padding: 22px 16px 16px; display: flex; flex-direction: column; gap: 12px; overflow-y: auto; opacity: 0; visibility: hidden; transform: translateX(-8px); transition: opacity 180ms ease, transform 180ms ease, visibility 0s 180ms; }
.code-panel-open .code-body { opacity: 1; visibility: visible; transform: translateX(0); transition-delay: 140ms, 140ms, 0s; }
.code-body h2 { margin: 0; font-size: 15px; }
.code-body h2 em { float: right; font-size: 9px; font-style: normal; color: #f3c96f; }
.code-body > p { margin: 0; color: var(--muted); font-size: 11px; line-height: 1.8; }
.scope-line { display: flex; flex-wrap: wrap; gap: 5px; }
.scope-line code { color: var(--accent); background: #10242a; padding: 1px 3px; font-size: 9px; }
.editor-shell { flex: 1 1 0; min-height: 80px; overflow: hidden; border: 1px solid var(--line); }
.run-console { flex: 0 0 auto; max-height: 76px; overflow: auto; color: var(--accent); font-size: 10px; line-height: 1.6; overflow-wrap: anywhere; }
.callback-result { flex: 0 1 136px; min-height: 76px; padding: 10px 12px; display: grid; grid-template-columns: 90px minmax(0, 1fr); gap: 8px; overflow: hidden; border: 1px solid var(--line); background: #061018; }
.callback-result > div { display: flex; flex-direction: column; gap: 6px; }
.callback-result span { color: var(--accent); font: 8px "Cascadia Code", monospace; letter-spacing: 0.06em; }
.callback-result pre { min-width: 0; margin: 0; overflow: auto; color: #bad3c4; font: 10px/1.6 "Cascadia Code", Consolas, monospace; }
.callback-result pre:focus-visible { outline: 1px solid var(--accent); outline-offset: -1px; }
.editor-actions { flex: 0 0 auto; display: flex; align-items: center; gap: 8px; }
.editor-actions button, .map-run { padding: 10px 12px; border: 1px solid var(--line); color: #e1f2f7; background: #0b1d25; cursor: pointer; font-size: 11px; }
.editor-actions button:first-child { color: #07141c; background: var(--accent); }
.editor-actions kbd { margin-left: auto; }
button:disabled { opacity: 0.45; cursor: default; }
.map-panel { position: relative; min-width: 0; min-height: 0; overflow: hidden; }
.map-title { position: absolute; top: 20px; left: 20px; width: 190px; padding: 14px 16px; border-left: 2px solid var(--accent); background: rgba(5, 22, 29, 0.92); pointer-events: none; }
.map-title strong { display: block; margin: 5px 0; font-size: 15px; font-weight: 500; }
.map-title span { color: var(--muted); font-size: 10px; }
.map-run { position: absolute; top: 20px; right: 20px; color: var(--accent); }
.map-legend { position: absolute; left: 20px; bottom: 80px; display: flex; flex-wrap: wrap; gap: 14px; max-width: calc(100% - 40px); padding: 10px 12px; color: #c4d9de; background: rgba(5, 22, 29, 0.92); font-size: 10px; pointer-events: none; }
.map-legend span { display: inline-flex; align-items: center; gap: 6px; }
.map-legend i { width: 9px; height: 9px; }
.result-panel { position: absolute; right: 20px; bottom: 80px; width: 238px; max-height: calc(100% - 200px); display: flex; flex-direction: column; border: 1px solid var(--line); background: rgba(5, 22, 29, 0.94); }
.result-total { padding: 16px; flex-shrink: 0; border-bottom: 1px solid var(--line); }
.result-total > span { display: block; color: var(--muted); font-size: 11px; }
.result-total strong { display: block; margin: 9px 0 6px; color: var(--accent); font: 24px "Cascadia Code", Consolas, monospace; }
.segment-list { overflow: auto; min-height: 0; }
.segment-list > div { display: flex; justify-content: space-between; gap: 12px; padding: 11px 16px; border-bottom: 1px solid var(--line); font: 11px "Cascadia Code", monospace; }
.segment-list span { color: var(--muted); }
.map-instruction { position: absolute; right: 20px; bottom: 18px; left: 20px; margin: 0; padding: 12px 14px; border-left: 2px solid var(--accent); color: #abc4c9; background: rgba(5, 22, 29, 0.92); font-size: 11px; line-height: 1.6; pointer-events: none; }
.error { color: #ff827c; }
.is-preview .lab-grid { display: block; height: 100%; }
.is-preview .map-panel { height: 100%; }
.is-preview .map-title { top: 12px; left: 12px; }
.is-preview .map-instruction { right: 12px; bottom: 12px; left: 12px; font-size: 10px; }
button:focus-visible { outline: 2px solid var(--accent); outline-offset: -3px; }
@media (max-width: 1000px) { .lab-grid { grid-template-columns: 180px 44px minmax(0, 1fr); } .lab-grid.code-panel-open { grid-template-columns: 180px 390px minmax(0, 1fr); } .code-body { width: 346px; } .header-info { gap: 12px; } }
@media (max-width: 720px) {
  .lab-header { padding: 0 14px; }
  .lab-header strong { font-size: 15px; }
  .header-info span:first-child, .edition { display: none; }
  .lab-grid { grid-template-columns: 44px minmax(0, 1fr); grid-template-rows: 72px minmax(0, 1fr); }
  .catalog-panel { grid-column: 1 / -1; grid-row: 1; }
  .catalog-panel > small, .catalog-panel h1, .catalog-note { display: none; }
  nav { display: flex; flex: 0 0 72px; height: 72px; overflow-x: auto; overflow-y: hidden; }
  nav button { flex: 0 0 150px; min-width: 0; min-height: 72px; padding: 10px 12px; gap: 6px; }
  .code-panel { grid-column: 1; grid-row: 2; z-index: 5; }
  .map-panel { grid-column: 2; grid-row: 2; }
  .lab-grid.code-panel-open { grid-template-columns: min(90vw, 400px) minmax(0, 1fr); }
  .code-body { width: calc(min(90vw, 400px) - 44px); }
  .result-panel { width: 200px; right: 12px; }
  .map-title { left: 12px; width: 150px; }
  .map-legend { top: 132px; bottom: auto; left: 12px; }
  .map-run { right: 12px; font-size: 10px; }
}
@media (prefers-reduced-motion: reduce) { .lab-grid, .code-body, .code-toggle b { transition: none; } }
</style>
