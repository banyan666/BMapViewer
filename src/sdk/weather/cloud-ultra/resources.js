import worker from './assets/noise-worker.js?url'
import stbn from './assets/stbn.bin?url'
import transmittance from './assets/atmosphere/transmittance.bin?url'
import scattering from './assets/atmosphere/scattering.bin?url'
import irradiance from './assets/atmosphere/irradiance.bin?url'
import higherOrderScattering from './assets/atmosphere/higher_order_scattering.bin?url'

// 开发/示例构建由 Vite 自动管理 URL 和子路径；库构建替换为按需加载的资源模块。
const urls = Object.freeze({ worker, stbn, transmittance, scattering, irradiance, higherOrderScattering })
export function getCloudUltraResources() { return { urls, release() {} } }
