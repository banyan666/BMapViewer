<script setup>
import { computed, onMounted, ref } from 'vue'

const props = defineProps({
  example: { type: String, required: true },
  title: { type: String, required: true },
  height: { type: [Number, String], default: 430 },
  mobileHeight: { type: [Number, String], default: 340 },
  category: {
    type: String,
    default: 'layer',
    validator: (value) => ['layer', 'base-map', 'pick', 'weather', 'analysis', 'terrain'].includes(value),
  },
})

const previewParams = {
  layer: 'layer-preview',
  'base-map': 'base-map-preview',
  pick: 'pick-preview',
  weather: 'weather-preview',
  analysis: 'analysis-preview',
  terrain: 'terrain-preview',
}

const mounted = ref(false)

const demoBase = computed(() => {
  const configuredBase = import.meta.env.VITE_DEMO_BASE_URL
  if (configuredBase) return new URL(configuredBase, window.location.origin).href

  if (import.meta.env.DEV) {
    const demoPort = import.meta.env.VITE_DEMO_PORT || '5188'
    return `${window.location.protocol}//${window.location.hostname}:${demoPort}/`
  }

  const docsBase = import.meta.env.BASE_URL
  if (docsBase.endsWith('/docs/')) {
    return new URL(docsBase.slice(0, -'docs/'.length), window.location.origin).href
  }

  return 'https://banyan666.github.io/BMapViewer/'
})

const previewUrl = computed(() => {
  if (!mounted.value) return ''
  const parameter = previewParams[props.category]
  return `${demoBase.value}?${parameter}=${encodeURIComponent(props.example)}`
})

const panelHeight = computed(() => {
  const value = typeof props.height === 'number' ? `${props.height}px` : props.height
  const mobileValue = typeof props.mobileHeight === 'number' ? `${props.mobileHeight}px` : props.mobileHeight
  return { '--preview-height': value, '--preview-mobile-height': mobileValue }
})

onMounted(() => {
  mounted.value = true
})
</script>

<template>
  <section class="layer-example" :style="panelHeight">
    <iframe
      v-if="mounted"
      :src="previewUrl"
      :title="`${title} 实时组件案例`"
      loading="lazy"
      allowfullscreen
    ></iframe>
  </section>
</template>

<style scoped>
.layer-example {
  overflow: hidden;
  margin: 18px 0 28px;
  height: var(--preview-height);
  min-height: 300px;
  border: 1px solid rgba(101, 169, 184, 0.24);
  border-radius: 2px;
  background: #071118;
  box-shadow: 0 16px 42px rgba(3, 13, 19, 0.16);
}

.layer-example iframe {
  display: block;
  width: 100%;
  height: 100%;
  border: 0;
  background: #071118;
}

@media (max-width: 640px) {
  .layer-example { height: var(--preview-mobile-height); }
}
</style>
