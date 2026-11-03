import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'

const source = new URL('../packages/cloud-ultra/src/cloud-ultra/assets/', import.meta.url)
const manifest = fileURLToPath(new URL('../packages/cloud-ultra/src/cloud-ultra/resources.js', import.meta.url)).replaceAll('\\', '/')
const placeholder = '__BMAP_CLOUD_ULTRA_RESOURCE_LOADER__'
const modulePath = './assets/cloud-ultra/resources.js'
const noticeFiles = ['THIRD_PARTY_NOTICES.txt', 'NVIDIA-STBN-LICENSE.txt']
export const cloudUltraResourceFiles = Object.freeze({
  worker: 'noise-worker.js', stbn: 'stbn.bin', transmittance: 'atmosphere/transmittance.bin',
  scattering: 'atmosphere/scattering.bin', irradiance: 'atmosphere/irradiance.bin',
  higherOrderScattering: 'atmosphere/higher_order_scattering.bin',
})

export function cloudUltraAssets({ library = false } = {}) {
  return {
    name: 'bmap-cloud-ultra-assets', enforce: 'pre',
    async buildStart() {
      const notices = await Promise.all(noticeFiles.map(async (name) => ({
        name, text: await readFile(new URL(name, source), 'utf8'),
      })))
      if (library) {
        // Preserve distribution notices in a single SDK-level NOTICE, not separate asset TXT files.
        const projectNotice = await readFile(new URL('../NOTICE', import.meta.url), 'utf8')
        const introduction = 'CloudUltraEffect third-party license files are consolidated below.\n'
          + 'References to NVIDIA-STBN-LICENSE.txt refer to its section in this NOTICE.\n'
        this.emitFile({
          type: 'asset', fileName: 'NOTICE',
          source: projectNotice.trimEnd() + '\n\n' + introduction + '\n'
            + notices.map(({ name, text }) => `===== ${name} =====\n\n${text}`).join('\n\n'),
        })
      } else {
        for (const { name, text } of notices) {
          this.emitFile({ type: 'asset', fileName: 'assets/cloud-ultra/' + name, source: text })
        }
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
