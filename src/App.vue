<script setup>
import { computed, defineAsyncComponent, onBeforeUnmount, onMounted, ref } from 'vue'
import BasicExample from '../examples/BasicExample.vue'
import { findExampleModule, projectLinks } from '../examples/modules.js'

const routeComponents = {
  'base-maps': defineAsyncComponent(() => import('../examples/BaseMapPlayground.vue')),
  'base-map-preview': defineAsyncComponent(() => import('../examples/BaseMapCasePreview.vue')),
  layers: defineAsyncComponent(() => import('../examples/LayerPlayground.vue')),
  'layer-preview': defineAsyncComponent(() => import('../examples/LayerCasePreview.vue')),
  'pick-preview': defineAsyncComponent(() => import('../examples/PickCasePreview.vue')),
  'weather-preview': defineAsyncComponent(() => import('../examples/WeatherCasePreview.vue')),
  'pick-tools': defineAsyncComponent(() => import('../examples/PickToolsPlayground.vue')),
  'spatial-analysis': defineAsyncComponent(() => import('../examples/SpatialAnalysisPlayground.vue')),
  'analysis-preview': defineAsyncComponent(() => import('../examples/AnalysisCasePreview.vue')),
  'terrain-analysis': defineAsyncComponent(() => import('../examples/TerrainAnalysisPlayground.vue')),
  'terrain-preview': defineAsyncComponent(() => import('../examples/TerrainCasePreview.vue')),
  weather: defineAsyncComponent(() => import('../examples/WeatherCatalog.vue')),
}

const previewRoutes = new Set(['base-map-preview', 'layer-preview', 'pick-preview', 'weather-preview', 'analysis-preview', 'terrain-preview'])

const currentRoute = ref(readRoute())
const currentModule = computed(() => findExampleModule(currentRoute.value))
const currentComponent = computed(() => routeComponents[currentRoute.value])

function readRoute() {
  if (new URLSearchParams(window.location.search).has('base-map-preview')) return 'base-map-preview'
  if (new URLSearchParams(window.location.search).has('layer-preview')) return 'layer-preview'
  if (new URLSearchParams(window.location.search).has('pick-preview')) return 'pick-preview'
  if (new URLSearchParams(window.location.search).has('weather-preview')) return 'weather-preview'
  if (new URLSearchParams(window.location.search).has('analysis-preview')) return 'analysis-preview'
  if (new URLSearchParams(window.location.search).has('terrain-preview')) return 'terrain-preview'
  return window.location.hash.replace(/^#\/?/, '').split('/')[0] || 'home'
}

function syncRoute() {
  const nextRoute = readRoute()
  currentRoute.value = routeComponents[nextRoute] ? nextRoute : 'home'
  if (currentRoute.value === 'home' && window.location.hash !== '#/') {
    window.history.replaceState(null, '', '#/')
  }
}

function navigate(route) {
  window.location.hash = `#/${route}`
}

function goHome() {
  window.location.hash = '#/'
}

onMounted(() => window.addEventListener('hashchange', syncRoute))
onBeforeUnmount(() => window.removeEventListener('hashchange', syncRoute))
</script>

<template>
  <BasicExample v-if="currentRoute === 'home'" @navigate="navigate" />

  <component :is="currentComponent" v-else-if="previewRoutes.has(currentRoute)" />

  <div v-else class="module-shell">
    <header class="module-bar">
      <button type="button" @click="goHome"><span>←</span> 示例主页</button>
      <div class="module-crumb">
        <strong>BMapViewer</strong>
        <span>/</span>
        <em>{{ currentModule?.title }}</em>
      </div>
      <a :href="currentModule?.docs || projectLinks.docs" target="_blank" rel="noreferrer">对应文档 ↗</a>
    </header>

    <main class="module-content">
      <component :is="currentComponent" />
    </main>
  </div>
</template>

<style scoped>
.module-shell {
  width: 100%;
  height: 100%;
  display: grid;
  grid-template-rows: 44px minmax(0, 1fr);
  overflow: hidden;
  color: #dff4f4;
  background: #050c12;
  font-family: "Bahnschrift", "PingFang SC", "Microsoft YaHei", sans-serif;
}

.module-bar {
  position: relative;
  z-index: 30;
  padding: 0 16px;
  display: grid;
  grid-template-columns: 150px 1fr 150px;
  align-items: center;
  border-bottom: 1px solid rgba(130, 191, 202, 0.17);
  background: #060f16;
}

.module-bar button {
  justify-self: start;
  padding: 8px 10px;
  border: 0;
  color: #87a6ad;
  background: transparent;
  cursor: pointer;
  font-size: 10px;
}

.module-bar button span { margin-right: 8px; color: #45eadf; }
.module-bar button:hover { color: #e9ffff; }
.module-crumb { display: flex; justify-content: center; align-items: center; gap: 9px; font-size: 10px; }
.module-crumb strong { letter-spacing: 0.07em; }
.module-crumb span { color: #37545d; }
.module-crumb em { color: #719099; font-style: normal; }
.module-bar a { justify-self: end; color: #6d8c94; font-size: 10px; text-decoration: none; }
.module-bar a:hover { color: #45eadf; }
.module-content { min-height: 0; }
.module-content > :deep(*) { height: 100%; }
button:focus-visible,
a:focus-visible { outline: 2px solid #45eadf; outline-offset: 2px; }

@media (max-width: 620px) {
  .module-bar { grid-template-columns: 110px 1fr 36px; padding: 0 8px; }
  .module-bar a { overflow: hidden; width: 30px; white-space: nowrap; }
  .module-crumb strong,
  .module-crumb span { display: none; }
}
</style>
