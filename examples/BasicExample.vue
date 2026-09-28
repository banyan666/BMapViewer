<script setup>
import { exampleCounts, exampleModules, projectLinks } from './modules.js'

const emit = defineEmits(['navigate'])

const productFacts = [
  { value: 'Vue 3', label: '组件化 Viewer 生命周期' },
  { value: '07', label: '多源底图 Provider' },
  { value: String(exampleCounts.layers).padStart(2, '0'), label: '内置可视化图层' },
  { value: 'GeoJSON', label: '统一业务数据结构' },
]

function openModule(module) {
  if (module.route) emit('navigate', module.route)
}

function scrollToCapabilities() {
  document.getElementById('capabilities')?.scrollIntoView({ behavior: 'smooth' })
}
</script>

<template>
  <div class="portal-shell">
    <header class="portal-header">
      <a class="brand" href="#/" aria-label="BMapViewer 示例主页">
        <span class="brand-mark" aria-hidden="true"><i></i><i></i><i></i></span>
        <span>
          <strong>BMapViewer</strong>
          <small>VUE 3 / CESIUM SDK</small>
        </span>
      </a>

      <nav class="header-links" aria-label="项目链接">
        <button type="button" @click="scrollToCapabilities">重点能力</button>
        <a :href="projectLinks.docs" target="_blank" rel="noreferrer">技术文档</a>
        <a :href="projectLinks.github" target="_blank" rel="noreferrer">GitHub ↗</a>
      </nav>
    </header>

    <main>
      <section class="hero-section" aria-labelledby="portal-title">
        <div class="hero-copy">
          <p class="system-line"><span></span>VUE 3 · CESIUM 1.118 · VISUALIZATION SDK</p>
          <h1 id="portal-title">
            <strong>BMapViewer</strong>
            <span>让 Cesium 业务能力<br />成为可复用的 Vue 组件。</span>
          </h1>
          <p class="hero-description">
            BMapViewer 是面向 Vue 3 项目的 Cesium 可视化组件 SDK。它统一管理 Viewer 的初始化、相机与交互生命周期，并将多源底图、可视化图层和地图工具组织为职责清晰的独立模块。
          </p>
          <p class="hero-usecase">
            适用于三维 GIS、离线地图、园区态势、设备监控和专题分析等需要快速组织地理数据的应用。
          </p>
          <div class="hero-actions">
            <button type="button" @click="openModule(exampleModules[0])">
              运行底图示例 <span>→</span>
            </button>
            <a :href="projectLinks.gettingStarted" target="_blank" rel="noreferrer">快速开始</a>
          </div>
        </div>

        <div class="survey-atlas" aria-hidden="true">
          <div class="atlas-grid"></div>
          <div class="orbit orbit-a"></div>
          <div class="orbit orbit-b"></div>
          <div class="crosshair"><i></i><i></i></div>
          <span class="coordinate coordinate-top">44°08′49″ N</span>
          <span class="coordinate coordinate-right">125°50′02″ E</span>
          <span class="atlas-label">BMAP<br />VIEWER<small>SDK CORE</small></span>
          <span class="module-point point-layer"><i></i>LAYER</span>
          <span class="module-point point-base"><i></i>BASE</span>
          <span class="module-point point-pick"><i></i>PICK</span>
          <span class="module-point point-analysis"><i></i>ANALYSIS</span>
          <span class="module-point point-weather"><i></i>WEATHER</span>
          <span class="scale-line">0&nbsp;&nbsp;&nbsp;25&nbsp;&nbsp;&nbsp;50 KM</span>
        </div>
      </section>

      <section class="fact-strip" aria-label="BMapViewer 技术特征">
        <div v-for="fact in productFacts" :key="fact.value">
          <strong>{{ fact.value }}</strong>
          <span>{{ fact.label }}</span>
        </div>
      </section>

      <section id="capabilities" class="capability-section" aria-labelledby="capability-heading">
        <div class="section-heading">
          <div>
            <p>CORE CAPABILITIES</p>
            <h2 id="capability-heading">BMapViewer 能做什么</h2>
          </div>
          <p class="section-intro">从场景展示、地图交互到空间计算，按能力域组织代码与示例。</p>
        </div>

        <div class="capability-grid">
          <article
            v-for="module in exampleModules"
            :key="module.id"
            class="capability-card"
            :class="`accent-${module.accent}`"
          >
            <div class="card-topline">
              <span class="capability-code">{{ module.code }}</span>
              <em><i></i>{{ module.status }}</em>
            </div>

            <div class="capability-title">
              <div class="capability-glyph" aria-hidden="true"><span></span><b>{{ module.code.slice(0, 1) }}</b></div>
              <div>
                <small>{{ module.eyebrow }}</small>
                <h3>{{ module.title }}</h3>
              </div>
            </div>

            <p>{{ module.description }}</p>
            <ul aria-label="能力内容">
              <li v-for="item in module.features" :key="item">{{ item }}</li>
            </ul>

            <div class="card-footer">
              <div class="capability-metric">
                <strong>{{ module.metric }}</strong>
                <span>{{ module.metricLabel }}</span>
              </div>
              <div class="card-actions">
                <button v-if="module.route" type="button" @click="openModule(module)">
                  {{ module.action }} <span>→</span>
                </button>
                <a :class="{ primary: !module.route }" :href="module.docs" target="_blank" rel="noreferrer">
                  {{ module.route ? '对应文档' : module.action }} ↗
                </a>
              </div>
            </div>
          </article>
        </div>
      </section>

      <section class="workflow-section" aria-labelledby="workflow-heading">
        <div>
          <p>HOW IT WORKS</p>
          <h2 id="workflow-heading">一套 Viewer，组合多种业务能力</h2>
        </div>
        <div class="workflow-line" aria-label="BMapViewer 能力组合方式">
          <span><b>01</b>BMapViewer<small>创建 Cesium 场景</small></span>
          <i>→</i>
          <span><b>02</b>BaseMaps<small>管理多源底图</small></span>
          <i>→</i>
          <span><b>03</b>MapLayers<small>组织可视化图层</small></span>
          <i>→</i>
          <span><b>04</b>PickTools + Turf<small>交互与空间计算</small></span>
        </div>
      </section>
    </main>

    <footer class="portal-footer">
      <span>BMAPVIEWER / VUE 3 + CESIUM 1.118</span>
      <span>OFFLINE DATA · MODULAR LAYERS · GEO ANALYSIS</span>
    </footer>
  </div>
</template>

<style scoped>
.portal-shell {
  --ink-0: #050c12;
  --ink-1: #08151d;
  --ink-2: #0b2029;
  --line: rgba(130, 191, 202, 0.17);
  --text: #ddf2f2;
  --muted: #78929a;
  --cyan: #45eadf;
  --blue: #69b9ff;
  --green: #a3d68a;
  --amber: #f3c96f;
  width: 100%;
  min-height: 100%;
  overflow-x: hidden;
  color: var(--text);
  background:
    linear-gradient(rgba(84, 171, 184, 0.026) 1px, transparent 1px),
    linear-gradient(90deg, rgba(84, 171, 184, 0.026) 1px, transparent 1px),
    radial-gradient(circle at 76% 12%, rgba(31, 132, 143, 0.13), transparent 29%),
    var(--ink-0);
  background-size: 44px 44px, 44px 44px, auto, auto;
  font-family: "Bahnschrift", "PingFang SC", "Microsoft YaHei", sans-serif;
}

.portal-header {
  position: relative;
  z-index: 5;
  height: 72px;
  padding: 0 clamp(22px, 4vw, 68px);
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--line);
  background: rgba(5, 12, 18, 0.76);
  backdrop-filter: blur(16px);
}

.brand,
.header-links,
.hero-actions,
.card-topline,
.capability-title,
.card-footer,
.card-actions,
.portal-footer {
  display: flex;
  align-items: center;
}

.brand { gap: 13px; color: inherit; text-decoration: none; }
.brand-mark { position: relative; width: 34px; height: 34px; transform: rotate(30deg); }
.brand-mark i { position: absolute; inset: 2px; border: 1px solid var(--cyan); }
.brand-mark i:nth-child(2) { inset: 8px; opacity: 0.68; }
.brand-mark i:nth-child(3) { inset: 14px; background: var(--cyan); box-shadow: 0 0 18px rgba(69, 234, 223, 0.8); }
.brand strong { display: block; font-size: 17px; letter-spacing: 0.04em; }
.brand small { display: block; margin-top: 4px; color: #5f7c85; font: 8px/1 "Cascadia Code", Consolas, monospace; letter-spacing: 0.16em; }
.header-links { gap: 4px; }
.header-links a,
.header-links button { padding: 10px 13px; border: 0; color: #86a4ab; background: transparent; cursor: pointer; font-size: 11px; text-decoration: none; }
.header-links a:hover,
.header-links button:hover { color: var(--cyan); }

main { width: min(1440px, 100%); margin: 0 auto; padding: 0 clamp(22px, 4vw, 68px) 58px; }
.hero-section { min-height: 535px; display: grid; grid-template-columns: minmax(0, 1fr) minmax(390px, 0.76fr); align-items: center; gap: clamp(40px, 7vw, 110px); }
.system-line,
.section-heading > div > p,
.workflow-section > div:first-child p,
.capability-code,
.coordinate,
.scale-line,
.portal-footer { font-family: "Cascadia Code", Consolas, monospace; }
.system-line { margin: 0 0 20px; color: #65909a; font-size: 9px; letter-spacing: 0.18em; }
.system-line span { display: inline-block; width: 6px; height: 6px; margin-right: 9px; border-radius: 50%; background: var(--cyan); box-shadow: 0 0 10px var(--cyan); }
h1 { max-width: 780px; margin: 0; font-weight: 550; line-height: 1.07; letter-spacing: -0.045em; }
h1 strong { display: block; color: var(--cyan); font: 600 clamp(17px, 1.8vw, 25px)/1 "Cascadia Code", Consolas, monospace; letter-spacing: 0.02em; }
h1 span { display: block; margin-top: 17px; font-size: clamp(38px, 4vw, 58px); }
.hero-description { max-width: 700px; margin: 26px 0 0; color: #91aab0; font-size: 15px; line-height: 1.9; }
.hero-usecase { max-width: 690px; margin: 10px 0 0; color: #607e86; font-size: 12px; line-height: 1.75; }
.hero-actions { gap: 22px; margin-top: 30px; }
.hero-actions button,
.card-actions button,
.card-actions a.primary { border: 0; color: #051719; background: var(--module-accent, var(--cyan)); cursor: pointer; font-weight: 700; text-decoration: none; }
.hero-actions button { min-width: 168px; height: 44px; padding: 0 18px; background: var(--cyan); }
.hero-actions button span,
.card-actions button span { margin-left: 13px; }
.hero-actions button:hover { background: #8ffff6; }
.hero-actions a { color: #8ca7ad; font-size: 12px; text-underline-offset: 5px; }
.hero-actions a:hover { color: var(--text); }

.survey-atlas { position: relative; width: min(100%, 450px); aspect-ratio: 1; justify-self: end; overflow: hidden; border: 1px solid var(--line); border-radius: 50%; background: radial-gradient(circle, rgba(17, 76, 84, 0.44) 0 1px, transparent 1px 100%); }
.atlas-grid { position: absolute; inset: 0; background: linear-gradient(transparent 49.8%, rgba(91, 189, 197, 0.18) 50%, transparent 50.2%), linear-gradient(90deg, transparent 49.8%, rgba(91, 189, 197, 0.18) 50%, transparent 50.2%), repeating-radial-gradient(circle, transparent 0 56px, rgba(102, 185, 194, 0.09) 57px 58px); }
.orbit { position: absolute; border: 1px solid rgba(69, 234, 223, 0.23); border-radius: 50%; }
.orbit-a { inset: 16%; }
.orbit-b { inset: 32%; border-style: dashed; }
.crosshair { position: absolute; inset: 50%; }
.crosshair i { position: absolute; background: var(--cyan); box-shadow: 0 0 12px rgba(69, 234, 223, 0.7); }
.crosshair i:first-child { width: 40px; height: 1px; transform: translate(-20px, 0); }
.crosshair i:last-child { width: 1px; height: 40px; transform: translate(0, -20px); }
.atlas-label { position: absolute; top: 36%; left: 50%; transform: translateX(-50%); color: rgba(221, 242, 242, 0.9); font: 500 24px/0.92 "Bahnschrift", sans-serif; letter-spacing: -0.03em; text-align: center; }
.atlas-label small { display: block; margin-top: 10px; color: #527780; font: 7px "Cascadia Code", monospace; letter-spacing: 0.18em; }
.coordinate { position: absolute; color: #4f7e87; font-size: 8px; letter-spacing: 0.12em; }
.coordinate-top { top: 8%; left: 50%; transform: translateX(-50%); }
.coordinate-right { top: 50%; right: 2%; transform: rotate(90deg) translateY(-50%); }
.scale-line { position: absolute; right: 20%; bottom: 10%; color: #48747c; font-size: 7px; }
.scale-line::before { display: block; width: 100%; height: 3px; margin-bottom: 4px; border: 1px solid #477a82; border-top: 0; content: ""; }
.module-point { position: absolute; display: flex; align-items: center; gap: 6px; color: #8dc1c5; font: 8px "Cascadia Code", monospace; letter-spacing: 0.09em; }
.module-point i { width: 7px; height: 7px; border: 1px solid currentColor; transform: rotate(45deg); }
.point-base { top: 25%; right: 12%; color: var(--cyan); }
.point-layer { top: 42%; right: 5%; color: var(--blue); }
.point-pick { top: 18%; left: 18%; color: var(--blue); }
.point-analysis { right: 8%; bottom: 25%; color: var(--green); }
.point-weather { bottom: 22%; left: 10%; color: var(--amber); }

.fact-strip { min-height: 104px; display: grid; grid-template-columns: repeat(4, 1fr); border-top: 1px solid var(--line); border-bottom: 1px solid var(--line); }
.fact-strip > div { padding: 24px clamp(14px, 2vw, 30px); display: grid; gap: 5px; border-right: 1px solid var(--line); }
.fact-strip > div:first-child { padding-left: 0; }
.fact-strip > div:last-child { border-right: 0; }
.fact-strip strong { color: #d8efef; font: 500 20px "Cascadia Code", Consolas, monospace; }
.fact-strip span { color: #5e7b83; font-size: 10px; }

.capability-section { padding: 64px 0 54px; scroll-margin-top: 70px; }
.section-heading { display: grid; grid-template-columns: 1fr minmax(300px, 0.62fr); align-items: end; gap: 40px; margin-bottom: 24px; }
.section-heading > div > p,
.workflow-section > div:first-child p { margin: 0 0 8px; color: #52737c; font-size: 8px; letter-spacing: 0.19em; }
.section-heading h2,
.workflow-section h2 { margin: 0; font-size: clamp(25px, 3vw, 36px); font-weight: 550; letter-spacing: -0.025em; }
.section-intro { margin: 0; color: #68858d; font-size: 12px; line-height: 1.7; }
.capability-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); border-top: 1px solid var(--line); border-left: 1px solid var(--line); }
.capability-card { --module-accent: var(--cyan); position: relative; min-height: 380px; padding: clamp(24px, 3vw, 38px); display: flex; flex-direction: column; border-right: 1px solid var(--line); border-bottom: 1px solid var(--line); background: linear-gradient(145deg, rgba(11, 32, 41, 0.76), rgba(5, 12, 18, 0.42)); }
.capability-card::after { position: absolute; right: 0; bottom: 0; width: 110px; height: 110px; opacity: 0.18; content: ""; background: linear-gradient(var(--module-accent) 1px, transparent 1px), linear-gradient(90deg, var(--module-accent) 1px, transparent 1px); background-size: 18px 18px; mask-image: linear-gradient(135deg, transparent, black); }
.capability-card:hover { background: linear-gradient(145deg, rgba(13, 39, 49, 0.88), rgba(6, 17, 24, 0.64)); }
.accent-cyan { --module-accent: var(--cyan); }
.accent-blue { --module-accent: var(--blue); }
.accent-green { --module-accent: var(--green); }
.accent-amber { --module-accent: var(--amber); }
.card-topline { justify-content: space-between; }
.capability-code { color: var(--module-accent); font-size: 9px; letter-spacing: 0.16em; }
.card-topline em { display: inline-flex; align-items: center; gap: 7px; color: #66838b; font-size: 9px; font-style: normal; }
.card-topline em i { width: 5px; height: 5px; border-radius: 50%; background: var(--module-accent); box-shadow: 0 0 8px var(--module-accent); }
.capability-title { gap: 17px; margin-top: 26px; }
.capability-glyph { position: relative; width: 46px; height: 46px; display: grid; flex: 0 0 auto; place-items: center; border: 1px solid color-mix(in srgb, var(--module-accent) 48%, transparent); transform: rotate(45deg); }
.capability-glyph span { position: absolute; inset: 8px; border: 1px solid color-mix(in srgb, var(--module-accent) 27%, transparent); }
.capability-glyph b { color: var(--module-accent); font: 700 12px "Cascadia Code", monospace; transform: rotate(-45deg); }
.capability-title small { color: #54727b; font: 8px "Cascadia Code", monospace; letter-spacing: 0.14em; }
.capability-title h3 { margin: 7px 0 0; font-size: 24px; font-weight: 520; }
.capability-card > p { max-width: 590px; margin: 24px 0 0; color: #7b969d; font-size: 12px; line-height: 1.75; }
.capability-card ul { margin: 20px 0 0; padding: 0; display: flex; flex-wrap: wrap; gap: 7px; list-style: none; }
.capability-card li { padding: 5px 8px; border: 1px solid #173640; color: #66858d; background: #071820; font: 8px "Cascadia Code", monospace; }
.card-footer { position: relative; z-index: 1; margin-top: auto; padding-top: 28px; justify-content: space-between; gap: 24px; }
.capability-metric { display: grid; gap: 3px; }
.capability-metric strong { color: var(--module-accent); font: 500 24px "Cascadia Code", Consolas, monospace; }
.capability-metric span { color: #496973; font: 8px "Cascadia Code", monospace; }
.card-actions { gap: 6px; }
.card-actions button,
.card-actions a { min-height: 34px; padding: 0 12px; display: inline-flex; align-items: center; justify-content: center; font-size: 9px; }
.card-actions button { background: var(--module-accent); }
.card-actions button:hover,
.card-actions a.primary:hover { filter: brightness(1.18); }
.card-actions a { color: #718e96; text-decoration: none; }
.card-actions a:hover { color: var(--module-accent); }

.workflow-section { padding: 46px 0 10px; display: grid; grid-template-columns: minmax(240px, 0.65fr) 1.35fr; align-items: center; gap: 56px; border-top: 1px solid var(--line); }
.workflow-line { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.workflow-line > span { display: grid; gap: 4px; }
.workflow-line b { color: var(--cyan); font: 8px "Cascadia Code", monospace; }
.workflow-line span { color: #bdd2d4; font-size: 12px; }
.workflow-line small { color: #58747c; font-size: 9px; white-space: nowrap; }
.workflow-line > i { color: #35545d; font-style: normal; }

.portal-footer { min-height: 58px; padding: 0 clamp(22px, 4vw, 68px); justify-content: space-between; border-top: 1px solid var(--line); color: #3f626b; background: #050c12; font-size: 8px; letter-spacing: 0.12em; }
button:focus-visible,
a:focus-visible { outline: 2px solid var(--cyan); outline-offset: 3px; }

@media (max-width: 960px) {
  .hero-section { grid-template-columns: 1fr 320px; gap: 36px; }
  .workflow-section { grid-template-columns: 1fr; }
}

@media (max-width: 720px) {
  .portal-header { height: 64px; padding: 0 18px; }
  .brand small,
  .header-links button,
  .header-links a:first-of-type { display: none; }
  main { padding: 0 18px 38px; }
  .hero-section { min-height: auto; padding: 65px 0 44px; grid-template-columns: 1fr; }
  h1 span { font-size: clamp(37px, 11vw, 54px); }
  .hero-description { font-size: 14px; }
  .hero-actions { align-items: flex-start; flex-direction: column; gap: 15px; }
  .survey-atlas { width: 270px; justify-self: center; }
  .fact-strip { grid-template-columns: repeat(2, 1fr); }
  .fact-strip > div { border-bottom: 1px solid var(--line); }
  .fact-strip > div:nth-child(2) { border-right: 0; }
  .fact-strip > div:first-child { padding-left: 14px; }
  .capability-section { padding-top: 48px; }
  .section-heading { grid-template-columns: 1fr; gap: 14px; }
  .capability-grid { grid-template-columns: 1fr; }
  .capability-card { min-height: 360px; }
  .card-footer { align-items: flex-start; flex-direction: column; }
  .workflow-line { align-items: flex-start; flex-direction: column; }
  .workflow-line > i { transform: rotate(90deg); }
  .portal-footer { align-items: flex-start; flex-direction: column; justify-content: center; gap: 5px; }
}

@media (prefers-reduced-motion: no-preference) {
  .survey-atlas { animation: atlas-enter 800ms cubic-bezier(0.2, 0.8, 0.2, 1) both; }
  .orbit-b { animation: orbit-turn 26s linear infinite; }
}

@keyframes atlas-enter { from { opacity: 0; transform: scale(0.94) rotate(-4deg); } to { opacity: 1; transform: scale(1) rotate(0); } }
@keyframes orbit-turn { to { transform: rotate(360deg); } }
</style>
