import { defineConfig } from 'vite'
import { copyFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { cloudUltraAssets } from './scripts/cloud-ultra-assets.mjs'

const packageRoot = new URL('./packages/cloud-ultra/', import.meta.url)

export default defineConfig({
  root: fileURLToPath(packageRoot),
  publicDir: false,
  plugins: [
    cloudUltraAssets({ library: true }),
    {
      name: 'cloud-ultra-license',
      async closeBundle() {
        await copyFile(new URL('./LICENSE', import.meta.url), new URL('LICENSE', packageRoot))
      },
    },
  ],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    lib: {
      entry: fileURLToPath(new URL('src/index.js', packageRoot)),
      name: 'BMapViewerCloudUltra',
      formats: ['es', 'umd'],
      fileName: (format) => format === 'es' ? 'cloud-ultra.js' : 'cloud-ultra.umd.cjs',
    },
    rollupOptions: {
      external: ['cesium'],
      output: { exports: 'named', globals: { cesium: 'Cesium' } },
    },
  },
})
