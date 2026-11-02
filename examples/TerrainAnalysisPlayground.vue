<script setup>
import { computed, defineAsyncComponent, nextTick, onBeforeUnmount, ref, shallowRef } from 'vue'
import * as Cesium from 'cesium'
import { BaseMaps, BMapViewer, MapLayers, PickTools, TerrainAnalysis } from '../src/sdk/index.js'
import { CESIUM_ION_TOKEN } from './config/cesium.js'
import { terrainExamples } from './terrain/index.js'
import { createTerrainExampleSession } from './terrain/runtime.js'

const props = defineProps({ preview: { type: Boolean, default: false } })
const CodeExampleEditor = defineAsyncComponent(() => import('./CodeExampleEditor.vue'))
const camera = { longitude: 117.93234, latitude: 43.78764, height: 8500, pitch: -42, minHeight: 80, maxHeight: 800000 }
const previewId = new URLSearchParams(window.location.search).get('terrain-preview')
const initialExample = terrainExamples.find((example) => example.id === previewId) || terrainExamples[0]
const activeId = ref(initialExample.id)
const activeExample = computed(() => terrainExamples.find((example) => example.id === activeId.value))
const code = ref(initialExample.code)
const isCodePanelOpen = ref(false)
const ready = ref(false)
const canPick = ref(false)
const state = ref('loading')
const message = ref('正在加载 Cesium World Terrain…')
const result = ref(null)
const floodLayer = shallowRef(null)
const floodState = ref(null)
const floodReady = ref(false)
const floodForm = ref({ startHeight: 0, targetHeight: 100, speed: 20, direction: 'up' })
const floodLabels = { idle: '待开始', running: '水位变化中', paused: '已暂停', completed: '已到目标水位' }
const floodProgress = computed(() => {
  const value = floodState.value
  if (!value) return 0
  const span = value.targetHeight - value.startHeight
  return span ? Math.max(0, Math.min(100, (value.waterHeight - value.startHeight) / span * 100)) : 100
})
const summary = computed(() => result.value ? activeExample.value.summarize(result.value) : null)
const resultText = computed(() => result.value ? (isCodePanelOpen.value ? JSON.stringify(result.value, null, 2) : '展开代码查看返回数据') : '等待拾取并完成分析…')
const labels = { loading: '正在加载地形', running: '正在采样', active: '等待拾取', done: '分析完成', error: '运行失败' }
const profile = computed(() => {
  if (!result.value || !activeExample.value.chart) return null
  const r = result.value, span = Math.max(1, r.maxHeight - r.minHeight)
  const points = r.samples.map((p) => `${20 + 420 * p.distance / r.horizontalDistance},${110 - 80 * (p.height - r.minHeight) / span}`).join(' ')
  return { points, fill: `20,115 ${points} 440,115`, min: r.minHeight.toFixed(0), max: r.maxHeight.toFixed(0), distance: r.horizontalDistance.toFixed(3), unit: r.unit }
})
let viewer = null, terrain = null, imagery = null, session = null
let version = 0, loadVersion = 0, resizeTimer = null

function disposeSession() {
  canPick.value = false
  session?.destroy?.()
  session = null
  floodLayer.value = null; floodState.value = null; floodReady.value = false
}

function controlFlood(action) {
  const water = floodLayer.value
  if (!water || !floodReady.value) return
  try {
    if (action === 'start') {
      const values = floodForm.value
      if ((values.direction === 'up' && values.targetHeight < values.startHeight) || (values.direction === 'down' && values.targetHeight > values.startHeight)) throw new Error('上升时目标水位应不低于起始水位；下降时应不高于起始水位。')
      water.setOptions({ ...values, baseHeight: Math.min(water.getOptions().baseHeight ?? 0, values.startHeight - 1, values.targetHeight - 1) })
      water.reset().start()
    } else if (action === 'toggle') {
      if (water.getState().status === 'running') water.pause()
      else water.start()
    } else water.reset()
    floodState.value = water.getState()
    state.value = 'done'; message.value = floodLabels[floodState.value.status]
  } catch (error) { message.value = error.message; state.value = 'error' }
}

async function runCode() {
  if (!ready.value || !viewer || viewer.isDestroyed()) return
  const current = ++version
  disposeSession()
  result.value = null
  state.value = 'running'
  message.value = '正在启动拾取…'
  const currentSession = createTerrainExampleSession({
    viewer, TerrainAnalysis, PickTools, MapLayers,
    onFloodLayer(layer) { if (current === version) floodLayer.value = layer },
    onResult(data) {
      if (current !== version) return
      const water = floodLayer.value
      if (activeExample.value.flood && water) {
        floodState.value = water.getState()
        if (!floodReady.value) {
          const config = water.getOptions()
          floodForm.value = { startHeight: config.startHeight, targetHeight: config.targetHeight, speed: config.speed, direction: config.direction }
          floodReady.value = true
        }
      }
      if (!activeExample.value.flood || !result.value || floodState.value?.status === 'completed') console.log('TerrainAnalysis.' + activeExample.value.name + ' 返回结果：', data)
      result.value = data; state.value = 'done'; message.value = `${activeExample.value.name} 分析完成`
    },
    onError(error) {
      if (current !== version) return
      result.value = null; state.value = 'error'; message.value = error?.message || String(error)
    },
    onStatus(status) {
      if (current !== version) return
      result.value = null; message.value = status
      floodReady.value = false; floodState.value = null
      state.value = status.startsWith('等待') ? 'active' : 'running'
    },
  })
  session = currentSession
  try {
    await currentSession.execute(code.value)
    if (current !== version) { currentSession.destroy(); return }
    canPick.value = true
    if (state.value === 'running') { state.value = 'active'; message.value = '等待示例返回结果' }
  } catch (error) {
    if (current !== version) return
    state.value = 'error'; message.value = error?.message || String(error)
  }
}

function selectExample(example) {
  if (example.id === activeId.value) return
  activeId.value = example.id; code.value = example.code; result.value = null
  runCode()
}

function resetCamera() {
  if (!viewer || viewer.isDestroyed()) return
  viewer.camera.flyToBoundingSphere(new Cesium.BoundingSphere(Cesium.Cartesian3.fromDegrees(117.93234, 43.78764, 1400), 1800), {
    offset: new Cesium.HeadingPitchRange(Cesium.Math.toRadians(12), Cesium.Math.toRadians(-42), 5500), duration: 1,
  })
}

async function loadTerrain() {
  if (!viewer || viewer.isDestroyed()) return
  const current = ++loadVersion
  state.value = 'loading'; ready.value = false
  terrain?.destroy()
  terrain = new BaseMaps.CesiumTerrain(viewer, {
    token: import.meta.env.VITE_CESIUM_ION_TOKEN || CESIUM_ION_TOKEN,
    requestVertexNormals: true, requestWaterMask: true, depthTestAgainstTerrain: true,
  })
  try {
    await terrain.readyPromise
    if (current !== loadVersion || !viewer || viewer.isDestroyed()) return
    ready.value = true; resetCamera()
    await runCode()
  } catch (error) {
    if (current !== loadVersion) return
    state.value = 'error'; message.value = `地形加载失败：${error.message}。请检查 Token 和网络后重试。`
  }
}

async function handleReady(value) {
  viewer = value
  imagery = new BaseMaps.BaseMap(viewer, { type: 'arcgis', url: 'https://server.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer', maximumLevel: 23 })
  viewer.scene.globe.enableLighting = false
  await loadTerrain()
}

async function toggleCode() {
  isCodePanelOpen.value = !isCodePanelOpen.value
  await nextTick(); viewer?.resize()
  clearTimeout(resizeTimer); resizeTimer = setTimeout(() => viewer && !viewer.isDestroyed() && viewer.resize(), 460)
}

onBeforeUnmount(() => {
  version += 1; loadVersion += 1
  clearTimeout(resizeTimer); disposeSession()
  terrain?.destroy(); imagery?.destroy(); viewer = null
})
</script>

<template>
  <div class="terrain-lab" :class="{ 'is-preview': props.preview }">
    <header v-if="!props.preview" class="lab-header">
      <div><strong>TerrainAnalysis</strong><span class="edition">TERRAIN LAB</span><p>三维分析 · 真实地形采样与区域估算</p></div>
      <div class="header-info"><span>CESIUM WORLD TERRAIN</span><span role="status">{{ labels[state] }}</span></div>
    </header>
    <main class="lab-grid" :class="{ 'code-panel-open': isCodePanelOpen }">
      <aside v-if="!props.preview" class="catalog-panel">
        <small>TERRAIN ANALYSIS</small><h1>三维分析目录 <span>{{ terrainExamples.length }}</span></h1>
        <nav aria-label="三维分析示例">
          <button v-for="(example, index) in terrainExamples" :key="example.id" :class="{ active: example.id === activeId }" type="button" @click="selectExample(example)">
            <small>{{ String(index + 1).padStart(2, '0') }}</small><span><strong>{{ example.title }}</strong><small>{{ example.name }}</small></span><b>›</b>
          </button>
        </nav>
        <p class="catalog-note">真实地形 · 异步采样<br />距离与面积单位可配置；高程固定为米。面分析与体积为三角网估算，非工程测绘结果。</p>
      </aside>
      <section v-if="!props.preview" class="code-panel" aria-label="三维分析示例代码">
        <button class="code-toggle" type="button" :aria-expanded="isCodePanelOpen" aria-controls="terrain-code-body" :title="isCodePanelOpen ? '收起代码' : '展开代码'" @click="toggleCode"><b :class="{ open: isCodePanelOpen }">›</b><span>EDITABLE EXAMPLE</span></button>
        <div id="terrain-code-body" class="code-body" :inert="!isCodePanelOpen" :aria-hidden="!isCodePanelOpen">
          <small>EDITABLE EXAMPLE</small><h2>{{ activeExample.name }}</h2><p>{{ activeExample.summary }}</p>
          <div class="scope-line"><code v-for="name in ['TerrainAnalysis', 'PickTools', 'MapLayers', 'viewer', 'onResult']" :key="name">{{ name }}</code></div>
          <div class="editor-shell"><CodeExampleEditor v-model="code" accent="amber" aria-label="三维分析 JavaScript 代码" @run="runCode" /></div>
          <div class="run-console" :class="state" role="status">{{ message }}</div>
          <section class="callback-result" aria-label="三维分析返回数据"><div><span>CALLBACK RESULT</span><small>WGS84 · m/km</small></div><pre tabindex="0">{{ resultText }}</pre></section>
          <div class="editor-actions"><button type="button" :disabled="!ready" @click="runCode">▶ 运行当前示例</button><button type="button" :disabled="code === activeExample.code" @click="code = activeExample.code">恢复代码</button><kbd>Ctrl ↵</kbd></div>
        </div>
      </section>
      <section class="map-panel" aria-label="三维分析地图">
        <BMapViewer :camera="camera" :scene-mode="1" @ready="handleReady" @error="state = 'error'; message = $event?.message || '地图初始化失败'" />
        <div class="map-title"><small>LIVE TERRAIN ANALYSIS</small><strong>{{ activeExample.title }}</strong><span>{{ labels[state] }}</span></div>
        <div class="map-actions"><button v-if="!ready && state === 'error'" type="button" @click="loadTerrain">重试加载地形</button><template v-else><button type="button" :disabled="!ready || !canPick" @click="runCode">重新绘制</button><button type="button" :disabled="!ready" @click="resetCamera">复位视角</button></template></div>
        <aside v-if="(summary && !props.preview) || activeExample.flood" class="result-panel" :class="{ 'flood-panel': activeExample.flood }" aria-label="三维分析结果">
          <form v-if="activeExample.flood" class="flood-controls" @submit.prevent="controlFlood('start')">
            <div class="water-level"><span>当前水位 · m</span><strong>{{ floodState ? floodState.waterHeight.toFixed(1) : '—' }}</strong><small>{{ floodReady ? floodLabels[floodState?.status] : '绘制范围后启用' }}</small></div>
            <progress :value="floodProgress" max="100" aria-label="水位变化进度" />
            <fieldset :disabled="!floodReady">
              <label>起始水位（m）<input v-model.number="floodForm.startHeight" type="number" step="any" required /></label>
              <label>目标水位（m）<input v-model.number="floodForm.targetHeight" type="number" step="any" required /></label>
              <label>速度（m/s）<input v-model.number="floodForm.speed" type="number" min="0.01" step="any" required /></label>
              <label>变化方向<select v-model="floodForm.direction"><option value="up">上升</option><option value="down">下降</option></select></label>
              <div class="flood-actions"><button type="submit">按参数开始</button><button type="button" :disabled="floodState?.status === 'completed'" @click="controlFlood('toggle')">{{ floodState?.status === 'running' ? '暂停' : '继续' }}</button><button type="button" @click="controlFlood('reset')">复位水位</button><button type="button" @click="runCode">清除</button></div>
            </fieldset>
          </form>
          <template v-if="summary && !props.preview"><div class="result-total"><span>{{ summary.title }}</span><strong>{{ summary.value }}</strong></div>
          <div class="metric-row" v-for="row in summary.rows" :key="row[0]"><span>{{ row[0] }}</span><strong>{{ row[1] }}</strong></div></template>
        </aside>
        <section v-if="profile && !props.preview" class="profile-panel" aria-label="地形剖面图">
          <div><strong>地形剖面</strong><span>高程 {{ profile.min }} – {{ profile.max }} m</span></div>
          <svg viewBox="0 0 460 140" role="img" aria-label="沿路径的地形高程变化"><path d="M20 20V115H440" class="axis" /><polygon :points="profile.fill" class="profile-fill" /><polyline :points="profile.points" class="profile-line" /><text x="20" y="134">0</text><text x="335" y="134">{{ profile.distance }} {{ profile.unit }}</text></svg>
        </section>
        <div v-if="activeExample.legend" class="map-legend">{{ activeExample.legend }}</div>
        <p class="map-instruction" :class="state">{{ state === 'error' || state === 'loading' || state === 'running' || state === 'active' ? message : activeExample.instruction }}</p>
      </section>
    </main>
  </div>
</template>

<style scoped>
.terrain-lab { --accent: #dbb68d; --line: #19333d; --muted: #76949b; height: 100%; overflow: hidden; color: #e1f2f7; background: #07141c; font-family: "Bahnschrift", "Microsoft YaHei", sans-serif; }
.lab-header { height: 68px; padding: 0 24px; display: flex; align-items: center; justify-content: space-between; border-bottom: 1px solid var(--line); }
.lab-header strong { font: 700 18px "Cascadia Code", Consolas, monospace; }
.edition { margin-left: 12px; padding: 3px 6px; color: #07141c; background: var(--accent); font: 700 9px monospace; }
.lab-header p { margin: 5px 0 0; color: var(--muted); font-size: 11px; }
.header-info { display: flex; gap: 24px; color: var(--accent); font: 10px "Cascadia Code", monospace; }
.lab-grid { height: calc(100% - 68px); display: grid; grid-template-columns: 218px 44px minmax(0, 1fr); transition: grid-template-columns 300ms ease; }
.lab-grid.code-panel-open { grid-template-columns: 218px 460px minmax(0, 1fr); }
.catalog-panel { min-height: 0; display: flex; flex-direction: column; border-right: 1px solid var(--line); }
.catalog-panel > small { margin: 24px 18px 8px; }
small, kbd { color: var(--muted); font: 9px/1.5 "Cascadia Code", monospace; }
.catalog-panel h1 { margin: 0; padding: 0 18px 22px; font-size: 20px; border-bottom: 1px solid var(--line); }
.catalog-panel h1 span { float: right; color: var(--accent); font: 12px monospace; }
nav { flex: 1 1 0; min-height: 0; overflow: auto; }
nav button { width: 100%; min-height: 74px; padding: 12px 18px; display: flex; align-items: center; gap: 12px; color: var(--muted); border: 0; border-left: 2px solid transparent; background: transparent; cursor: pointer; text-align: left; }
nav button.active { color: #e1f2f7; border-left-color: var(--accent); background: #1c2528; }
nav button span { flex: 1; min-width: 0; }
nav button strong { display: block; margin-bottom: 4px; font-size: 12px; }
nav button span small { font-size: 8px; overflow-wrap: anywhere; }
.catalog-note { margin: 14px 16px; padding: 12px; border: 1px solid var(--line); color: var(--muted); font-size: 10px; line-height: 1.8; }
.code-panel { position: relative; min-width: 0; min-height: 0; overflow: hidden; border-right: 1px solid var(--line); }
.code-toggle { position: absolute; inset: 0 auto 0 0; width: 44px; display: flex; flex-direction: column; align-items: center; padding: 14px 0; gap: 14px; border: 0; border-right: 1px solid var(--line); color: var(--accent); background: #0b1d25; cursor: pointer; }
.code-toggle b { width: 24px; height: 24px; border: 1px solid #6a5741; font: 26px/22px sans-serif; transition: transform 300ms ease; }
.code-toggle b.open { transform: rotate(180deg); }
.code-toggle span { writing-mode: vertical-rl; color: var(--muted); font: 8px monospace; letter-spacing: 0.15em; }
.code-body { box-sizing: border-box; width: 416px; height: 100%; margin-left: 44px; padding: 22px 16px 16px; display: flex; flex-direction: column; gap: 12px; overflow-y: auto; opacity: 0; visibility: hidden; transform: translateX(-8px); transition: opacity 180ms ease, transform 180ms ease, visibility 0s 180ms; }
.code-panel-open .code-body { opacity: 1; visibility: visible; transform: translateX(0); transition-delay: 140ms, 140ms, 0s; }
.code-body h2 { margin: 0; font-size: 15px; }
.code-body > p { margin: 0; color: var(--muted); font-size: 11px; line-height: 1.8; }
.scope-line { display: flex; flex-wrap: wrap; gap: 5px; }
.scope-line code { color: var(--accent); background: #15232a; padding: 1px 3px; font-size: 9px; }
.editor-shell { flex: 1 1 0; min-height: 80px; overflow: hidden; border: 1px solid var(--line); }
.run-console { flex-shrink: 0; max-height: 70px; overflow: auto; color: var(--accent); font-size: 10px; line-height: 1.6; }
.callback-result { flex: 0 1 136px; min-height: 76px; padding: 10px; display: grid; grid-template-columns: 86px minmax(0, 1fr); gap: 8px; overflow: hidden; border: 1px solid var(--line); background: #061018; }
.callback-result > div { display: flex; flex-direction: column; gap: 6px; }
.callback-result span { color: var(--accent); font: 8px "Cascadia Code", monospace; }
.callback-result pre { min-width: 0; margin: 0; overflow: auto; color: #d6c7b6; font: 10px/1.6 "Cascadia Code", monospace; }
.editor-actions { flex-shrink: 0; display: flex; align-items: center; gap: 8px; }
button { font-family: inherit; }
.editor-actions button, .map-actions button { padding: 10px 12px; border: 1px solid var(--line); color: #e1f2f7; background: #0b1d25; cursor: pointer; font-size: 11px; }
.editor-actions button:first-child { color: #07141c; background: var(--accent); }
.editor-actions kbd { margin-left: auto; }
button:disabled { opacity: 0.45; cursor: default; }
.map-panel { position: relative; min-width: 0; min-height: 0; overflow: hidden; }
.map-title { position: absolute; top: 20px; left: 20px; width: 190px; padding: 14px 16px; border-left: 2px solid var(--accent); background: rgba(5, 22, 29, 0.92); pointer-events: none; }
.map-title strong { display: block; margin: 5px 0; font-size: 15px; }
.map-title span { color: var(--muted); font-size: 10px; }
.map-actions { position: absolute; top: 20px; right: 20px; display: flex; gap: 8px; }
.map-actions button { color: var(--accent); }
.result-panel { position: absolute; right: 20px; bottom: 82px; width: 245px; max-height: calc(100% - 180px); overflow: auto; border: 1px solid var(--line); background: rgba(5, 22, 29, 0.94); }
.result-total { padding: 16px; border-bottom: 1px solid var(--line); }
.result-total span, .metric-row span { color: var(--muted); font-size: 10px; }
.result-total strong { display: block; margin-top: 9px; color: var(--accent); font: 22px "Cascadia Code", monospace; overflow-wrap: anywhere; }
.metric-row { display: flex; justify-content: space-between; gap: 12px; padding: 11px 16px; border-bottom: 1px solid var(--line); font: 11px "Cascadia Code", monospace; }
.result-panel.flood-panel { width: 280px; max-width: calc(100% - 40px); }
.flood-controls { padding: 16px; border-bottom: 1px solid var(--line); }
.water-level { display: flex; flex-wrap: wrap; align-items: baseline; gap: 8px; }
.water-level > span { color: var(--muted); font-size: 11px; }
.water-level strong { margin-left: auto; color: #69cfff; font: 24px "Cascadia Code", monospace; }
.water-level small { flex-basis: 100%; }
.flood-controls progress { display: block; width: 100%; height: 4px; margin: 12px 0 16px; accent-color: #409dfd; }
.flood-controls fieldset { border: 0; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
.flood-controls label { display: flex; flex-direction: column; gap: 6px; color: var(--muted); font-size: 10px; }
.flood-controls input, .flood-controls select { box-sizing: border-box; width: 100%; min-width: 0; padding: 8px; color: #e1f2f7; background: #07141c; border: 1px solid var(--line); font: 12px "Cascadia Code", "Microsoft YaHei", monospace; }
.flood-controls :disabled { opacity: 0.5; }
.flood-controls :focus-visible { outline: 2px solid #69cfff; outline-offset: 2px; }
.flood-actions { grid-column: 1 / -1; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.flood-actions button { padding: 9px 6px; color: #e1f2f7; border: 1px solid var(--line); background: #0b1d25; cursor: pointer; font-size: 11px; }
.flood-actions button:first-child { background: #409dfd; color: #07141c; }
.map-instruction { position: absolute; right: 20px; bottom: 18px; left: 20px; margin: 0; padding: 12px 14px; border-left: 2px solid var(--accent); color: #abc4c9; background: rgba(5, 22, 29, 0.92); font-size: 10px; line-height: 1.6; pointer-events: none; }
.map-legend { position: absolute; left: 20px; bottom: 82px; max-width: calc(100% - 320px); padding: 10px 12px; color: #c4d9de; background: rgba(5, 22, 29, 0.92); font-size: 10px; }
.profile-panel { position: absolute; bottom: 82px; left: 20px; width: min(460px, calc(100% - 310px)); padding: 12px; box-sizing: border-box; border: 1px solid var(--line); background: rgba(5, 22, 29, 0.94); }
.profile-panel > div { display: flex; justify-content: space-between; font-size: 10px; gap: 12px; }
.profile-panel span { color: var(--muted); }
.profile-panel svg { width: 100%; display: block; margin-top: 6px; }
.axis { fill: none; stroke: #35515b; }
.profile-line { fill: none; stroke: var(--accent); stroke-width: 2; }
.profile-fill { fill: rgba(219,182,141,0.16); }
svg text { fill: #91acb3; font: 10px monospace; }
.error { color: #ff827c; }
.is-preview .lab-grid { display: block; height: 100%; }
.is-preview .map-panel { height: 100%; }
.is-preview .map-title { top: 12px; left: 12px; width: 160px; }
.is-preview .map-actions { top: 12px; right: 12px; left: auto; }
.is-preview .map-legend { max-width: calc(100% - 40px); }
button:focus-visible, pre:focus-visible { outline: 2px solid var(--accent); outline-offset: -3px; }
@media (max-width: 1100px) { .profile-panel { width: calc(100% - 40px); bottom: 82px; } .profile-panel ~ .map-legend { bottom: 240px; } .map-panel:has(.profile-panel) .result-panel { bottom: 285px; max-height: 140px; } }
@media (max-width: 1000px) { .lab-grid { grid-template-columns: 180px 44px minmax(0, 1fr); } .lab-grid.code-panel-open { grid-template-columns: 180px 390px minmax(0, 1fr); } .code-body { width: 346px; } .header-info > span:first-child { display: none; } .map-title { width: 150px; } .map-actions { top: 122px; left: 20px; right: auto; } }
@media (max-width: 720px) {
  .lab-header { padding: 0 14px; } .lab-header strong { font-size: 15px; } .edition { display: none; }
  .lab-grid { grid-template-columns: 44px minmax(0, 1fr); grid-template-rows: 72px minmax(0, 1fr); }
  .catalog-panel { grid-column: 1 / -1; grid-row: 1; }
  .catalog-panel > small, .catalog-panel h1, .catalog-note { display: none; }
  nav { display: flex; flex: 0 0 72px; height: 72px; overflow-x: auto; overflow-y: hidden; }
  nav button { flex: 0 0 160px; min-width: 0; min-height: 72px; padding: 10px; gap: 6px; }
  .code-panel { grid-column: 1; grid-row: 2; z-index: 5; } .map-panel { grid-column: 2; grid-row: 2; }
  .lab-grid.code-panel-open { grid-template-columns: min(90vw, 400px) minmax(0, 1fr); } .code-body { width: calc(min(90vw, 400px) - 44px); }
  .map-title { left: 12px; top: 12px; } .map-actions { left: 12px; top: 114px; }
  .is-preview .map-actions { left: 12px; top: 114px; right: auto; }
  .result-panel { width: 205px; right: 12px; max-height: 180px; bottom: 100px; }
  .result-panel.flood-panel { max-height: min(350px, calc(100% - 265px)); max-width: calc(100% - 24px); }
  .flood-controls { padding: 12px; }
  .map-panel:has(.flood-panel) .map-legend { display: none; }
  .map-instruction { right: 12px; left: 12px; bottom: 12px; }
  .map-legend { bottom: 290px; left: 12px; max-width: calc(100% - 48px); }
  .profile-panel { display: none; } .map-panel:has(.profile-panel) .result-panel { bottom: 100px; max-height: 180px; }
}
@media (prefers-reduced-motion: reduce) { .lab-grid, .code-body, .code-toggle b { transition: none; } }
</style>
