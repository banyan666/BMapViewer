import * as Cesium from 'cesium'
import { DEFAULT_CONFIG, normalizeConfig, normalizeOptions } from '../analysisConfig.js'

export const TERRAIN_DEFAULTS = {
  ...DEFAULT_CONFIG, volumeUnit: 'm3', sampleSpacing: 60, cellSize: 120,
  maxSamples: 4096, batchSize: 128, timeout: 30000,
}

export function finite(value, name) {
  if (!Number.isFinite(value)) throw new TypeError(`${name} must be a finite number.`)
  return value
}

export function terrainConfig(options) {
  const config = normalizeConfig({ ...TERRAIN_DEFAULTS, ...normalizeOptions(options) })
  for (const key of ['sampleSpacing', 'cellSize', 'timeout']) {
    if (!(finite(config[key], key) > 0)) throw new RangeError(`${key} must be positive.`)
  }
  for (const [key, min, max] of [['maxSamples', 2, 20000], ['batchSize', 1, 512]]) {
    if (!Number.isInteger(config[key]) || config[key] < min || config[key] > max) throw new RangeError(`${key} must be an integer from ${min} to ${max}.`)
  }
  if (!['m3', 'km3'].includes(config.volumeUnit)) throw new RangeError('volumeUnit must be m3 or km3.')
  if (config.sampleLevel != null && (!Number.isInteger(config.sampleLevel) || config.sampleLevel < 0 || config.sampleLevel > 24)) throw new RangeError('sampleLevel must be an integer from 0 to 24.')
  if (config.signal != null && (typeof config.signal.addEventListener !== 'function' || typeof config.signal.removeEventListener !== 'function')) throw new TypeError('signal must be an AbortSignal.')
  return config
}

export function abortError(message = 'Terrain analysis cancelled.') {
  const error = new Error(message)
  error.name = 'AbortError'
  return error
}

export function context(instance, options) {
  instance._assertAlive()
  const config = terrainConfig({ ...instance.config, ...normalizeOptions(options) })
  const provider = config.terrainProvider || instance.viewer?.terrainProvider
  if (!provider || provider instanceof Cesium.EllipsoidTerrainProvider) throw new Error('请先加载真实地形并等待 readyPromise，再调用 TerrainAnalysis。')
  if (config.sampleLevel == null && !provider.availability) throw new Error('该地形不提供 availability，请通过 sampleLevel 指定采样层级。')
  const started = Date.now()
  const version = instance._version
  const signals = [config.signal, instance._abort.signal].filter(Boolean)
  const check = () => {
    if (instance._destroyed || version !== instance._version || signals.some((signal) => signal.aborted)) throw abortError()
    if (Date.now() - started >= config.timeout) throw new Error('地形采样超时，请检查服务或减少采样数量。')
  }
  check()
  return {
    config, provider, check,
    distance: (meters) => meters / (config.unit === 'km' ? 1000 : 1),
    area: (meters2) => meters2 / ({ m2: 1, km2: 1e6, ha: 1e4 })[config.areaUnit],
    volume: (meters3) => meters3 / (config.volumeUnit === 'km3' ? 1e9 : 1),
    async sample(coordinates) {
      check()
      if (coordinates.length > config.maxSamples) throw new RangeError('采样点超过 maxSamples，请增大 sampleSpacing / cellSize 或缩小区域。')
      // Cesium 在 Provider 范围外可能保留输入高度，NaN 哨兵避免误把缺失数据识别为零高程。
      const positions = coordinates.map(([lon, lat]) => Cesium.Cartographic.fromDegrees(lon, lat, Number.NaN))
      for (let start = 0; start < positions.length; start += config.batchSize) {
        check()
        const batch = positions.slice(start, start + config.batchSize)
        let timer, onAbort
        const limit = new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error('地形采样超时，请检查服务或减少采样数量。')), Math.max(1, config.timeout - (Date.now() - started)))
          onAbort = () => reject(abortError())
          signals.forEach((signal) => signal.addEventListener('abort', onAbort, { once: true }))
        })
        try {
          const task = config.sampleLevel == null
            ? Cesium.sampleTerrainMostDetailed(provider, batch, true)
            : Cesium.sampleTerrain(provider, config.sampleLevel, batch, true)
          await Promise.race([task, limit])
          check()
          if (batch.some((position) => !Number.isFinite(position.height))) throw new Error('地形服务返回缺失高程，分析已终止，不使用零高程代替。')
        } finally {
          clearTimeout(timer)
          signals.forEach((signal) => signal.removeEventListener('abort', onAbort))
        }
      }
      return positions.map((position, index) => ({ center: coordinates[index].slice(0, 2), height: position.height }))
    },
    metadata(count) {
      return { sampleCount: count, sampleLevel: config.sampleLevel ?? null, samplingMode: config.sampleLevel == null ? 'most-detailed' : 'level', heightUnit: 'm' }
    },
  }
}

export function geodesic(first, second) {
  return new Cesium.EllipsoidGeodesic(Cesium.Cartographic.fromDegrees(...first.slice(0, 2)), Cesium.Cartographic.fromDegrees(...second.slice(0, 2)))
}

export function routeSamples(coordinates, ctx) {
  const paths = coordinates.slice(1).map((point, index) => geodesic(coordinates[index], point))
  const counts = paths.map((path) => Math.max(1, Math.ceil(path.surfaceDistance / ctx.config.sampleSpacing)))
  if (1 + counts.reduce((sum, count) => sum + count, 0) > ctx.config.maxSamples) throw new RangeError('路径采样超过 maxSamples，请增大 sampleSpacing。')
  const points = [coordinates[0].slice(0, 2)]
  const distances = [0], segments = [0]
  let cumulative = 0
  paths.forEach((path, index) => {
    for (let step = 1; step <= counts[index]; step += 1) {
      const position = path.interpolateUsingFraction(step / counts[index])
      points.push([Cesium.Math.toDegrees(position.longitude), Cesium.Math.toDegrees(position.latitude)])
      distances.push(cumulative + path.surfaceDistance * step / counts[index])
      segments.push(index)
    }
    cumulative += path.surfaceDistance
  })
  return { points, distances, segments }
}
