<script setup>
import { computed, nextTick, onBeforeUnmount, ref } from 'vue'
import * as Cesium from 'cesium'
import { BaseMaps, BMapViewer, WeatherEffects } from '../src/sdk/index.js'
import CodeExampleEditor from './CodeExampleEditor.vue'
import { weatherExamples } from './weather/index.js'
import { exampleModules } from './modules.js'
import { createWeatherExampleSession } from './weather/runtime.js'

const HOME_CAMERA = {
  longitude: 125.83372000975274,
  latitude: 44.14712267403385,
  height: 1800,
  pitch: -5,
  minHeight: 40,
  maxHeight: 800000,
}

const weatherDocs = exampleModules.find((module) => module.id === 'weather')?.docs

const mapRef = ref(null)
const activeId = ref(weatherExamples[0].id)
const code = ref(weatherExamples[0].codeText)
const isCodePanelOpen = ref(false)
const viewerReady = ref(false)
const runState = ref('idle')
const runMessage = ref('等待 Cesium 初始化')
const runDuration = ref(null)
const coordinate = ref(null)
const stageCount = ref(0)

let viewer = null
let baseMap = null
let activeSession = null
let activeEffect = null
let runVersion = 0
let resizeTimer = null

const activeExample = computed(() => weatherExamples.find((item) => item.id === activeId.value) || weatherExamples[0])
const isModified = computed(() => code.value !== activeExample.value.codeText)
const statusLabel = computed(() => ({
  idle: '待运行',
  running: '生成天气中',
  success: '效果运行中',
  error: '运行失败',
}[runState.value]))

function readPostProcessStages() {
  const stages = []
  const collection = viewer?.scene?.postProcessStages
  if (!collection || viewer?.isDestroyed()) return stages
  for (let index = 0; index < collection.length; index += 1) {
    stages.push(collection.get(index))
  }
  return stages
}

function updateStageCount() {
  stageCount.value = readPostProcessStages()
    .filter((stage) => stage?.name?.startsWith('bmap-viewer-weather-'))
    .length + (activeEffect?.type === 'cloud-ultra' && activeEffect.ready ? 4 : 0)
}

function disposeActive() {
  activeSession?.destroy()
  activeSession = null
  activeEffect = null
  updateStageCount()
}

async function runCode() {
  if (!viewer || viewer.isDestroyed() || runState.value === 'running') return
  const startTime = performance.now()
  const currentRun = ++runVersion
  runState.value = 'running'
  runDuration.value = null
  runMessage.value = activeExample.value.terrain ? '正在加载 Cesium World Terrain…' : `正在生成 ${activeExample.value.title}`
  disposeActive()
  mapRef.value?.flyTo(activeExample.value.camera || HOME_CAMERA, 0)
  const session = createWeatherExampleSession({
    WeatherEffects, BaseMaps, terrain: activeExample.value.terrain, viewer, time: activeExample.value.time,
    onProgress(value) { if (currentRun === runVersion) runMessage.value = `Ultra 体积云资源准备 ${value}%` },
    onError(error) { if (currentRun === runVersion) { runState.value = 'error'; runMessage.value = error.message } },
  })
  activeSession = session
  try {
    const result = await session.execute(code.value)
    if (currentRun !== runVersion) { session.destroy(); return }
    activeEffect = result
    runState.value = 'success'
    runMessage.value = `${activeExample.value.title}效果已加载`
    runDuration.value = Math.round(performance.now() - startTime)
    updateStageCount()
  } catch (error) {
    if (currentRun !== runVersion || error.name === 'AbortError') return
    runState.value = 'error'
    runMessage.value = error?.message || String(error)
    runDuration.value = Math.round(performance.now() - startTime)
    updateStageCount()
    console.error('天气示例运行失败：', error)
  }
}

async function selectExample(example) {
  if (activeId.value === example.id) return
  runVersion += 1
  await disposeActive()
  activeId.value = example.id
  code.value = example.codeText
  runState.value = 'idle'
  runMessage.value = '示例已切换，准备运行'
  await nextTick()
  runCode()
}

function resetCode() {
  code.value = activeExample.value.codeText
  runMessage.value = '已恢复默认示例代码'
}

async function handleViewerReady(readyViewer) {
  viewer = readyViewer
  viewer.scene.skyAtmosphere.show = true
  viewer.scene.backgroundColor = Cesium.Color.fromCssColorString('#8499a6')
  baseMap = new BaseMaps.BaseMap(viewer, {
    type: 'arcgis',
    url: BaseMaps.arcgisWorldImageryUrl,
    maximumLevel: 23,
  })
  viewerReady.value = true
  runMessage.value = 'Cesium 已就绪'
  await nextTick()
  runCode()
}

function handleViewerError(error) {
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
  disposeActive()
  baseMap?.destroy()
  baseMap = null
  viewer = null
})
</script>

<template>
  <div class="weather-lab">
    <header class="lab-header">
      <div class="brand-block">
        <span class="brand-mark" aria-hidden="true"><i></i><b></b></span>
        <div><strong>WeatherEffects</strong><p>Cesium 天气与世界空间体积云实验室</p></div>
      </div>
      <div class="header-metrics">
        <div><span>天气效果</span><strong>{{ weatherExamples.length }}</strong></div>
        <div><span>渲染方式</span><strong>{{ activeExample.renderMode || 'POST PROCESS' }}</strong></div>
        <div><span>活动阶段</span><strong>{{ String(stageCount).padStart(2, '0') }}</strong></div>
        <div class="runtime-dot" :class="runState"><i></i><strong>{{ statusLabel }}</strong></div>
      </div>
    </header>

    <main class="lab-grid" :class="{ 'code-panel-open': isCodePanelOpen }">
      <aside class="catalog-panel">
        <span class="panel-kicker">WEATHER INDEX</span>
        <div class="catalog-heading"><h1>天气目录</h1><b>{{ weatherExamples.length }}</b></div>
        <nav aria-label="天气系统示例">
          <button
            v-for="(example, index) in weatherExamples"
            :key="example.id"
            type="button"
            :class="{ active: activeId === example.id }"
            @click="selectExample(example)"
          >
            <span>{{ String(index + 1).padStart(2, '0') }}</span>
            <span><strong>{{ example.title }}</strong><small>{{ example.name }}</small></span>
            <i>›</i>
          </button>
        </nav>
        <a v-if="weatherDocs" class="docs-link" :href="weatherDocs" target="_blank" rel="noreferrer">天气系统文档 ↗</a>
      </aside>

      <section class="code-panel" :class="{ collapsed: !isCodePanelOpen }" aria-label="天气示例代码编辑器">
        <button
          type="button"
          class="code-toggle"
          :aria-expanded="isCodePanelOpen"
          aria-controls="weather-code-panel-body"
          :title="isCodePanelOpen ? '收起示例代码' : '展开示例代码'"
          @click="toggleCodePanel"
        ><span :class="{ open: isCodePanelOpen }">›</span><b>EDITABLE EXAMPLE</b></button>

        <div id="weather-code-panel-body" class="code-body" :aria-hidden="!isCodePanelOpen">
          <div class="code-heading">
            <div><span class="panel-kicker">EDITABLE WEATHER</span><h2>{{ activeExample.name }}</h2></div>
            <em v-if="isModified">已修改</em>
          </div>
          <p>{{ activeExample.summary }}</p>
          <div class="parameter-line"><span>可调参数</span><code v-for="parameter in activeExample.parameters" :key="parameter">{{ parameter }}</code></div>
          <div class="scope-line"><span>可用变量</span><code>WeatherEffects</code><code>viewer</code></div>
          <div class="editor-shell">
            <CodeExampleEditor
              v-model="code"
              accent="amber"
              aria-label="可编辑天气 JavaScript 示例代码"
              @run="runCode"
            />
          </div>
          <div class="run-status" :class="runState"><span><i></i>{{ runMessage }}</span><time v-if="runDuration !== null">{{ runDuration }} ms</time></div>
          <div class="code-actions">
            <button type="button" :disabled="!viewerReady || runState === 'running'" @click="runCode">▶ 运行当前示例</button>
            <button type="button" :disabled="!isModified" @click="resetCode">恢复代码</button>
            <span>Ctrl ↵</span>
          </div>
        </div>
      </section>

      <section class="map-panel" aria-label="WeatherEffects Cesium 运行预览">
        <BMapViewer
          ref="mapRef"
          :camera="HOME_CAMERA"
          :scene-mode="1"
          base-color="#182634"
          @ready="handleViewerReady"
          @error="handleViewerError"
          @click="handleMapClick"
        />
        <div class="map-title">
          <span>LIVE WEATHER / {{ activeExample.code }}</span>
          <strong>{{ activeExample.title }}</strong>
          <small>{{ activeExample.name }}</small>
        </div>
        <div class="weather-scale" aria-hidden="true"><span></span><span></span><span></span><span></span><b>{{ activeExample.code }}</b></div>
        <div class="map-guide">◇ {{ activeExample.terrain ? 'Cesium World Terrain 地形 + ArcGIS 影像，山地高度雾。' : 'ArcGIS World Imagery 影像。' }} 修改左侧参数后运行，切换示例会自动清理上一效果和示例地形。</div>
        <div class="map-footer">
          <span>{{ activeExample.terrain ? 'CESIUM WORLD TERRAIN + ARCGIS' : 'ARCGIS WORLD IMAGERY' }} · WGS84</span>
          <span>{{ coordinate || `${stageCount} ACTIVE WEATHER STAGE` }}</span>
        </div>
      </section>
    </main>
  </div>
</template>

<style scoped>
.weather-lab { --bg: #060c11; --panel: #0a141a; --line: #26333a; --amber: #f3c96f; --ice: #b8d8df; width: 100%; height: 100%; display: grid; grid-template-rows: 68px minmax(0, 1fr); overflow: hidden; color: #e8f1ef; background: var(--bg); font-family: "Bahnschrift", "PingFang SC", "Microsoft YaHei", sans-serif; }
.lab-header { padding-left: 20px; display: flex; align-items: stretch; justify-content: space-between; border-bottom: 1px solid var(--line); background: #071016; }
.brand-block { display: flex; align-items: center; gap: 14px; }
.brand-block strong { font: 600 17px "Cascadia Code", monospace; letter-spacing: .035em; }
.brand-block p { margin: 5px 0 0; color: #72878c; font-size: 10px; }
.brand-mark { position: relative; width: 36px; height: 36px; display: grid; place-items: center; border: 1px solid #776b4a; border-radius: 50%; }
.brand-mark::before, .brand-mark::after { position: absolute; content: ""; background: var(--amber); }
.brand-mark::before { width: 1px; height: 48px; }
.brand-mark::after { width: 48px; height: 1px; }
.brand-mark i { width: 13px; height: 13px; border: 1px solid var(--amber); border-radius: 50%; box-shadow: 0 0 14px rgba(243, 201, 111, .45); }
.brand-mark b { position: absolute; inset: 5px; border: 1px dashed rgba(243, 201, 111, .35); border-radius: 50%; }
.header-metrics { display: flex; }
.header-metrics > div { min-width: 125px; padding: 0 18px; display: grid; align-content: center; gap: 5px; border-left: 1px solid var(--line); }
.header-metrics span { color: #667a7f; font-size: 8px; letter-spacing: .08em; }
.header-metrics strong { font: 600 10px "Cascadia Code", monospace; }
.runtime-dot { grid-template-columns: 8px auto; align-items: center; }
.runtime-dot i, .run-status i { width: 5px; height: 5px; border-radius: 50%; background: #76888c; }
.runtime-dot.running i, .run-status.running i { background: var(--amber); animation: status-pulse 900ms ease-in-out infinite alternate; }
.runtime-dot.success i, .run-status.success i { background: #a9ebda; box-shadow: 0 0 9px #a9ebda; }
.runtime-dot.error i, .run-status.error i { background: #ff716c; }
.lab-grid { min-height: 0; display: grid; grid-template-columns: 220px 44px minmax(0, 1fr); transition: grid-template-columns 250ms cubic-bezier(.22,1,.36,1) 150ms; }
.lab-grid.code-panel-open { grid-template-columns: 220px minmax(370px, 440px) minmax(0, 1fr); transition-delay: 0ms; }
.catalog-panel { position: relative; min-width: 0; overflow: auto; border-right: 1px solid var(--line); background: linear-gradient(180deg, #0a151b, #081116); }
.panel-kicker { color: #a88e56; font: 8px "Cascadia Code", monospace; letter-spacing: .16em; }
.catalog-panel > .panel-kicker { display: block; padding: 18px 18px 7px; }
.catalog-heading { padding: 0 18px 17px; display: flex; align-items: center; justify-content: space-between; }
.catalog-heading h1 { margin: 0; font-size: 19px; font-weight: 560; }
.catalog-heading b { color: var(--amber); font: 11px "Cascadia Code", monospace; }
.catalog-panel nav { border-top: 1px solid #1e2b31; }
.catalog-panel nav button { width: 100%; min-height: 58px; padding: 8px 13px 8px 18px; display: grid; grid-template-columns: 26px 1fr 10px; align-items: center; gap: 9px; border: 0; border-left: 2px solid transparent; color: #7b9094; background: transparent; text-align: left; cursor: pointer; transition: color 160ms ease, background-color 160ms ease; }
.catalog-panel nav button:hover { color: #d8e2df; background: #101e23; }
.catalog-panel nav button.active { border-left-color: var(--amber); color: #fff8e8; background: linear-gradient(90deg, rgba(243, 201, 111, .13), rgba(243, 201, 111, .015)); }
.catalog-panel nav button > span:first-child { color: #596b6e; font: 8px "Cascadia Code", monospace; }
.catalog-panel nav button > span:nth-child(2) { display: grid; gap: 4px; }
.catalog-panel nav strong { font-size: 12px; font-weight: 500; }
.catalog-panel nav small { color: #596e72; font: 8px "Cascadia Code", monospace; }
.catalog-panel nav i { color: #a38b57; font: 18px/1 "Cascadia Code", monospace; font-style: normal; }
.docs-link { position: absolute; right: 17px; bottom: 17px; left: 17px; padding: 11px 12px; border: 1px solid #3a382c; color: #a69268; background: rgba(18, 24, 24, .85); font-size: 9px; text-decoration: none; }
.docs-link:hover { border-color: #786840; color: var(--amber); }
.code-panel { position: relative; z-index: 5; min-width: 0; display: grid; grid-template-columns: 44px minmax(0, 1fr); overflow: hidden; border-right: 1px solid var(--line); background: #071116; }
.code-toggle { position: relative; z-index: 8; width: 44px; min-height: 0; padding: 14px 0; display: flex; flex-direction: column; align-items: center; gap: 14px; border: 0; border-right: 1px solid var(--line); color: #887b5d; background: linear-gradient(180deg, #101b1e, #091318); cursor: pointer; }
.code-toggle:hover { color: var(--amber); background: #142126; }
.code-toggle span { width: 26px; height: 26px; display: grid; place-items: center; border: 1px solid #4c4634; color: var(--amber); background: #11191a; font: 22px/1 "Cascadia Code", monospace; transition: transform 250ms cubic-bezier(.22,1,.36,1), background-color 180ms ease; }
.code-toggle span.open { transform: rotate(180deg); }
.code-toggle b { writing-mode: vertical-rl; color: currentColor; font: 700 8px/1 "Cascadia Code", monospace; letter-spacing: .18em; }
.code-body { box-sizing: border-box; min-width: 396px; min-height: 0; height: 100%; padding: 20px 20px 18px; display: grid; grid-template-rows: auto auto auto auto minmax(0, 1fr) auto auto; gap: 9px; overflow: hidden; visibility: visible; opacity: 1; transform: translateX(0); transition: opacity 190ms ease 150ms, transform 230ms cubic-bezier(.22,1,.36,1) 120ms, visibility 0s linear 0s; }
.collapsed .code-body { visibility: hidden; opacity: 0; transform: translateX(-10px); pointer-events: none; transition: opacity 140ms ease 0ms, transform 160ms ease 0ms, visibility 0s linear 140ms; }
.code-heading { display: flex; justify-content: space-between; align-items: start; }
.code-heading h2 { margin: 8px 0 0; font: 600 14px "Cascadia Code", monospace; }
.code-heading em { padding: 3px 6px; color: #f2ca71; background: #2a2414; font-size: 8px; font-style: normal; }
.code-body > p { margin: 0; color: #7c9195; font-size: 10px; line-height: 1.55; }
.parameter-line, .scope-line { display: flex; align-items: center; gap: 5px; overflow: hidden; }
.parameter-line span, .scope-line span { flex: 0 0 auto; margin-right: 4px; color: #586b70; font-size: 8px; }
.parameter-line code, .scope-line code { padding: 2px 5px; color: #b8a06c; background: #1c201d; font: 8px "Cascadia Code", monospace; }
.scope-line code { color: #79a9ad; background: #0c2025; }
.editor-shell { min-height: 0; overflow: hidden; border: 1px solid #26373d; background: #040b0f; }
.run-status { min-height: 37px; padding: 0 11px; display: flex; align-items: center; justify-content: space-between; gap: 9px; color: #82989b; background: #0e1c20; font: 9px "Cascadia Code", monospace; }
.run-status > span { min-width: 0; display: flex; align-items: center; gap: 9px; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.run-status time { flex: 0 0 auto; color: #607479; }
.code-actions { min-height: 34px; display: flex; align-items: center; gap: 8px; }
.code-actions button { min-height: 34px; padding: 0 12px; border: 1px solid #2b3c42; color: #74888c; background: transparent; cursor: pointer; font-size: 9px; }
.code-actions button:first-child { border-color: var(--amber); color: #15130c; background: var(--amber); font-weight: 700; }
.code-actions button:disabled { opacity: .35; cursor: not-allowed; }
.code-actions span { margin-left: auto; color: #526469; font: 8px "Cascadia Code", monospace; }
.map-panel { position: relative; min-width: 0; overflow: hidden; background: #14232d; }
.map-panel::after { position: absolute; z-index: 1; inset: 0; content: ""; background: linear-gradient(90deg, rgba(12, 19, 22, .28), transparent 28%), linear-gradient(180deg, rgba(7, 13, 17, .18), transparent 24%); pointer-events: none; }
.map-title { position: absolute; z-index: 2; top: 20px; left: 22px; min-width: 210px; padding: 11px 15px; display: grid; gap: 5px; border-left: 2px solid var(--amber); background: rgba(8, 17, 21, .84); pointer-events: none; backdrop-filter: blur(8px); }
.map-title span, .map-title small { color: #8f825f; font: 8px "Cascadia Code", monospace; letter-spacing: .1em; }
.map-title strong { font-size: 17px; font-weight: 500; }
.weather-scale { position: absolute; z-index: 2; top: 26px; right: 22px; display: flex; align-items: end; gap: 4px; color: var(--amber); pointer-events: none; }
.weather-scale span { width: 3px; background: var(--amber); opacity: .55; }
.weather-scale span:nth-child(1) { height: 7px; }.weather-scale span:nth-child(2) { height: 12px; }.weather-scale span:nth-child(3) { height: 18px; }.weather-scale span:nth-child(4) { height: 25px; box-shadow: 0 0 8px var(--amber); }
.weather-scale b { margin-left: 6px; font: 8px "Cascadia Code", monospace; letter-spacing: .1em; }
.map-guide { position: absolute; z-index: 2; right: 20px; bottom: 34px; left: 20px; padding: 12px; color: #9aacab; background: rgba(8, 17, 21, .88); border-left: 2px solid var(--amber); font-size: 9px; pointer-events: none; }
.map-footer { position: absolute; z-index: 2; right: 15px; bottom: 10px; left: 15px; display: flex; justify-content: space-between; color: #667d80; font: 8px "Cascadia Code", monospace; pointer-events: none; }
button:focus-visible, a:focus-visible { outline: 2px solid var(--amber); outline-offset: -2px; }
@keyframes status-pulse { to { opacity: .32; box-shadow: 0 0 13px var(--amber); } }
@media (max-width: 1080px) { .header-metrics > div:nth-child(2), .header-metrics > div:nth-child(3) { display: none; } }
@media (max-width: 900px) { .lab-grid { grid-template-columns: 190px 44px minmax(540px, 1fr); } .lab-grid.code-panel-open { grid-template-columns: 190px 440px minmax(540px, 1fr); } .code-body { min-width: 396px; } }
@media (prefers-reduced-motion: reduce) { .lab-grid, .code-body, .code-toggle span, .runtime-dot.running i { transition: none; animation: none; } }
</style>
