import * as Cesium from 'cesium'
import { normalizeCenterline } from './geometry.js'

export const WATER_FLOW_DEFAULTS = {
  height: 0, speed: 1.4, flowMultiplier: 1.2, flowDirection: 90,
  centerline: null, textureSize: 512, wavelength: 102.5,
  foamScale: 1.2, foamOffset: 0.2, shoreWidth: 0.15,
  deepColor: '#061a14', shallowColor: '#147a61', opacity: 1, exposure: 1.68,
  specularColor: '#e0e5e1', specularIntensity: 0.3, specularShininess: 220, specularAA: 1,
  skyColor: '#7ab5ad', fresnelIntensity: 0.14, fresnelPower: 5.8, autoStart: true,
}
export const WATER_FLOW_COLORS = ['deepColor', 'shallowColor', 'specularColor', 'skyColor']
export const WATER_FLOW_UNIFORMS = ['speed', 'flowMultiplier', 'foamScale', 'foamOffset', 'shoreWidth', 'opacity', 'exposure', 'specularIntensity', 'specularShininess', 'specularAA', 'fresnelIntensity', 'fresnelPower']

export function waterColor(value) {
  const color = value instanceof Cesium.Color ? Cesium.Color.clone(value)
    : typeof value === 'string' ? Cesium.Color.fromCssColorString(value) : null
  if (!color || ![color.red, color.green, color.blue, color.alpha].every(Number.isFinite)) throw new TypeError('WaterFlowLayer colors must be CSS colors or Cesium.Color.')
  return color
}

export function normalizeWaterOptions(input) {
  const value = { ...WATER_FLOW_DEFAULTS, ...input }
  for (const key of ['height', 'flowDirection', 'textureSize', 'wavelength', ...WATER_FLOW_UNIFORMS]) {
    if (!Number.isFinite(value[key])) throw new TypeError(`WaterFlowLayer ${key} must be a finite number.`)
  }
  for (const key of ['speed', 'foamScale', 'exposure', 'specularIntensity', 'specularAA', 'fresnelIntensity']) {
    if (value[key] < 0) throw new RangeError(`WaterFlowLayer ${key} must not be negative.`)
  }
  for (const key of ['wavelength', 'shoreWidth', 'specularShininess', 'fresnelPower']) {
    if (value[key] <= 0) throw new RangeError(`WaterFlowLayer ${key} must be positive.`)
  }
  for (const key of ['opacity', 'foamOffset']) if (value[key] < 0 || value[key] > 1) throw new RangeError(`WaterFlowLayer ${key} must be from 0 to 1.`)
  if (!Number.isInteger(value.textureSize) || value.textureSize < 64 || value.textureSize > 1024 || (value.textureSize & (value.textureSize - 1))) throw new RangeError('WaterFlowLayer textureSize must be a power of two from 64 to 1024.')
  if (typeof value.autoStart !== 'boolean') throw new TypeError('WaterFlowLayer autoStart must be boolean.')
  for (const key of WATER_FLOW_COLORS) {
    waterColor(value[key])
    if (value[key] instanceof Cesium.Color) value[key] = Cesium.Color.clone(value[key])
  }
  normalizeCenterline(value.centerline)
  if (value.centerline != null) value.centerline = structuredClone(value.centerline)
  value.flowDirection = (value.flowDirection % 360 + 360) % 360
  return value
}
