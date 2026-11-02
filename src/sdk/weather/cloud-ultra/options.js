import { defaultCloudLayers } from './CloudLayers.js'

export const cloudUltraDefaults = Object.freeze({
  enabled: true, coverage: 0.3, exposure: 10,
  windSpeed: 10, windDirection: 0,
  steps: 500, shadowSteps: 50, maxDistance: 200000,
  temporalUpscale: false, perfOptimize: false,
  enableShadow: true, enableCloudShadow: true, cloudShadowStrength: 1,
  enableGlobeLighting: true, enableAerialPerspective: true, aerialPerspectiveScale: 1,
  terrainClip: true, scatteringCoefficient: 1, absorptionCoefficient: 0,
  temporalAlpha: 0.05, varianceGamma: 2, timeout: 120000,
})

const ranges = {
  coverage: [0, 1], exposure: [0.1, 40], windSpeed: [0, 100], windDirection: [-360, 360],
  steps: [16, 1024], shadowSteps: [8, 256], maxDistance: [10000, 1000000],
  cloudShadowStrength: [0, 1], aerialPerspectiveScale: [0, 2],
  scatteringCoefficient: [0, 10], absorptionCoefficient: [0, 10],
  temporalAlpha: [0.01, 1], varianceGamma: [0.1, 5], timeout: [1000, 300000],
}
const booleanKeys = Object.keys(cloudUltraDefaults).filter((key) => typeof cloudUltraDefaults[key] === 'boolean')

export function normalizeCloudUltraOptions(options = {}, previous = cloudUltraDefaults) {
  const result = { ...previous, ...options }
  delete result.assetUrl // 不再对使用者暴露资源路径，兼容忽略旧配置。
  for (const [key, [min, max]] of Object.entries(ranges)) {
    const value = Number(result[key])
    if (!Number.isFinite(value)) throw new TypeError('CloudUltraEffect.' + key + ' 必须是有限数值')
    result[key] = Math.min(max, Math.max(min, value))
  }
  result.steps = Math.round(result.steps); result.shadowSteps = Math.round(result.shadowSteps)
  booleanKeys.forEach((key) => { if (typeof result[key] !== 'boolean') throw new TypeError('CloudUltraEffect.' + key + ' 必须是 boolean') })
  for (const key of ['onProgress', 'onError']) if (result[key] != null && typeof result[key] !== 'function') throw new TypeError(key + ' 必须是函数')
  const layers = result.layers ?? defaultCloudLayers()
  if (!Array.isArray(layers) || layers.length < 1 || layers.length > 4) throw new RangeError('layers 需要 1～4 个云层')
  const defaults = defaultCloudLayers()
  result.layers = Array.from({ length: 4 }, (_, index) => {
    const input = layers[index]
    const layer = { ...defaults[index], ...(input || { height: 0 }), channel: 'rgba'[index], densityProfile: { ...defaults[index].densityProfile, ...input?.densityProfile } }
    for (const key of ['altitude', 'height', 'densityScale', 'shapeAmount', 'shapeDetailAmount', 'weatherExponent', 'shapeAlteringBias', 'coverageFilterWidth']) {
      layer[key] = Number(layer[key])
      if (!Number.isFinite(layer[key]) || layer[key] < 0 || (['altitude', 'height'].includes(key) && layer[key] > 50000)) throw new RangeError('无效云层参数: ' + key)
    }
    if (typeof layer.shadow !== 'boolean') throw new TypeError('layer.shadow 必须是 boolean')
    Object.entries(layer.densityProfile).forEach(([key, value]) => { if (!Number.isFinite(value)) throw new TypeError('无效密度剖面: ' + key) })
    return layer
  })
  if (!result.layers.some((layer) => layer.height > 0)) throw new RangeError('至少需要一个非零厚度云层')
  return result
}

export function copyCloudUltraOptions(options) {
  return { ...options, layers: options.layers.map((layer) => ({ ...layer, densityProfile: { ...layer.densityProfile } })) }
}
