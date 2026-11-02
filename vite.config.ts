import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import cesium from 'vite-plugin-cesium'
import { fileURLToPath, URL } from 'node:url'
import { cloudUltraAssets } from './scripts/cloud-ultra-assets.mjs'

export default defineConfig({
  base: './',
  plugins: [vue(), cesium(), cloudUltraAssets()],
  resolve: {
    alias: {
      '@sdk': fileURLToPath(new URL('./src/sdk', import.meta.url)),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5188,
    strictPort: true,
  },
  build: {
    outDir: 'demo-dist',
  },
})
