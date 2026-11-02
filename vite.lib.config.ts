import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { copyFile } from 'node:fs/promises'
import { fileURLToPath, URL } from 'node:url'
import { cloudUltraAssets } from './scripts/cloud-ultra-assets.mjs'

export default defineConfig({
  publicDir: false,
  plugins: [
    vue(),
    cloudUltraAssets({ library: true }),
    {
      name: 'copy-library-readme',
      async closeBundle() {
        await copyFile(
          fileURLToPath(new URL('./README.md', import.meta.url)),
          fileURLToPath(new URL('./BMapViewer/README.md', import.meta.url)),
        )
      },
    },
  ],
  build: {
    outDir: 'BMapViewer',
    emptyOutDir: true,
    lib: {
      entry: fileURLToPath(new URL('./src/sdk/index.js', import.meta.url)),
      name: 'BMapViewer',
      formats: ['es', 'umd'],
      fileName: (format) =>
        format === 'es' ? 'b-map-viewer.js' : 'b-map-viewer.umd.cjs',
      cssFileName: 'style',
    },
    rollupOptions: {
      external: ['vue', 'cesium'],
      output: {
        exports: 'named',
        globals: {
          vue: 'Vue',
          cesium: 'Cesium',
        },
      },
    },
  },
})
