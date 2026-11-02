import * as Cesium from 'cesium'
import AMapImageryProvider from './imagery/amap/AMapImageryProvider.js'
import ArcGISImageryProvider from './imagery/arcgis/ArcGISImageryProvider.js'
import BaiduImageryProvider from './imagery/baidu/BaiduImageryProvider.js'
import GeoVisImageryProvider from './imagery/geovis/GeoVisImageryProvider.js'
import GoogleImageryProvider from './imagery/google/GoogleImageryProvider.js'
import TdtImageryProvider from './imagery/tdt/TdtImageryProvider.js'
import TencentImageryProvider from './imagery/tencent/TencentImageryProvider.js'
import GCJ02TilingScheme from './imagery/tiling-scheme/GCJ02TilingScheme.js'
import createCesiumImageryProvider from './imagery/cesium/createCesiumImageryProvider.js'

const PROVIDERS = {
  amap: AMapImageryProvider,
  arcgis: ArcGISImageryProvider,
  baidu: BaiduImageryProvider,
  geovis: GeoVisImageryProvider,
  google: GoogleImageryProvider,
  tdt: TdtImageryProvider,
  tencent: TencentImageryProvider,
}

const MANAGER_KEYS = new Set([
  'type',
  'provider',
  'providerOptions',
  'index',
  'show',
  'themeColor',
  'layerOptions',
  'coordinateSystem',
  'token',
])

function getProviderOptions(config) {
  const options = { ...config, ...(config.providerOptions || {}) }
  const legacyCrs = options.coordinateSystem
  MANAGER_KEYS.forEach((key) => delete options[key])
  if (options.crs === undefined && legacyCrs !== undefined) {
    options.crs = legacyCrs
  }
  return options
}

function normalizeCrs(crs) {
  return String(crs || '').replace(/[\s_-]/g, '').toUpperCase()
}

/**
 * 根据统一底图配置创建 Cesium.ImageryProvider。
 */
export function createImageryProvider(config = {}) {
  if (config.provider) return config.provider

  const type = String(config.type || 'url-template').toLowerCase()
  const options = getProviderOptions(config)

  if (type === 'cesium') {
    return createCesiumImageryProvider({ ...options, token: config.providerOptions?.token ?? config.token })
  }

  if (type === 'url-template' || type === 'offline') {
    if (!options.url) throw new Error('Base map URL is required.')
    if (config.token) {
      options.url = new Cesium.Resource({
        url: options.url,
        headers: { Authorization: config.token },
      })
    }
    if (!options.tilingScheme && normalizeCrs(options.crs) === 'GCJ02') {
      options.tilingScheme = new GCJ02TilingScheme()
    }
    return new Cesium.UrlTemplateImageryProvider(options)
  }

  const Provider = PROVIDERS[type]
  if (!Provider) {
    throw new Error(`Unsupported base map type: ${type}`)
  }
  return new Provider(options)
}

export const imageryProviderTypes = Object.freeze([
  'url-template',
  'cesium',
  ...Object.keys(PROVIDERS),
])
