import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'

const source = new URL('../src/sdk/weather/cloud-ultra/assets/', import.meta.url)
const manifest = fileURLToPath(new URL('../src/sdk/weather/cloud-ultra/resources.js', import.meta.url)).replaceAll('\\', '/')
const placeholder = '__BMAP_CLOUD_ULTRA_RESOURCE_LOADER__'
const modulePath = './assets/cloud-ultra/resources.js'
export const cloudUltraResourceFiles = Object.freeze({
  worker: 'noise-worker.js', stbn: 'stbn.bin', transmittance: 'atmosphere/transmittance.bin',
  scattering: 'atmosphere/scattering.bin', irradiance: 'atmosphere/irradiance.bin',
  higherOrderScattering: 'atmosphere/higher_order_scattering.bin',
})

export function cloudUltraAssets({ library = false } = {}) {
  return {
    name: 'bmap-cloud-ultra-assets', enforce: 'pre',
    async buildStart() {
      for (const name of ['THIRD_PARTY_NOTICES.txt', 'NVIDIA-STBN-LICENSE.txt']) {
        this.emitFile({ type: 'asset', fileName: 'assets/cloud-ultra/' + name, source: await readFile(new URL(name, source)) })
      }
      if (!library) return
      const data = Object.fromEntries(await Promise.all(Object.entries(cloudUltraResourceFiles).map(async ([key, file]) =>
        [key, gzipSync(await readFile(new URL(file, source)), { level: 9 }).toString('base64')],
      )))
      this.emitFile({ type: 'asset', fileName: modulePath.slice(2), source: 'export default ' + JSON.stringify(data) + '\n' })
    },
    transform(_code, id) {
      if (!library || id.replaceAll('\\', '/').split('?')[0] !== manifest) return
      return { code: `import { decodeCloudUltraResources } from './resourceData.js'
const loadResources = ${placeholder}
export function getCloudUltraResources(signal) { return loadResources().then((data) => { signal?.throwIfAborted(); return decodeCloudUltraResources(data) }) }`, map: null }
    },
    renderChunk(code, _chunk, output) {
      if (!library || !code.includes(placeholder)) return
      const loader = output.format === 'es'
        ? `() => import(${JSON.stringify(modulePath)}).then((module) => module.default)`
        : `(() => { const url = new URL(${JSON.stringify(modulePath)}, typeof document === 'undefined' ? 'file:///' : document.currentScript?.src || document.baseURI).href; return () => import(url).then((module) => module.default) })()`
      return { code: code.replaceAll(placeholder, loader), map: null }
    },
  }
}
