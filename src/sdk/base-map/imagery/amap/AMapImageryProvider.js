import * as Cesium from 'cesium'
import GCJ02TilingScheme from '../tiling-scheme/GCJ02TilingScheme.js'

const STYLE_ALIASES = Object.freeze({
  img: 'img',
  image: 'img',
  imagery: 'img',
  satellite: 'img',
  elec: 'elec',
  vec: 'elec',
  vector: 'elec',
  normal: 'elec',
  cva: 'cva',
  label: 'cva',
  labels: 'cva',
})

const STYLE_CODE = Object.freeze({
  img: 6,
  elec: 7,
  cva: 8,
})

const TILE_HOST = '//wprd0{s}.is.autonavi.com'

function normalizeStyle(style = 'elec') {
  const value = String(style).toLowerCase()
  const alias = STYLE_ALIASES[value]
  if (alias) return alias

  const styleCode = Number(value)
  if (Number.isInteger(styleCode) && styleCode >= 6 && styleCode <= 10) {
    return styleCode
  }
  return undefined
}

function getStyleCode(style) {
  return typeof style === 'number' ? style : STYLE_CODE[style]
}

function normalizeProtocol(url, protocol) {
  if (!protocol) return url
  const scheme = String(protocol).replace(/:\/\/$/, '').replace(/:$/, '')
  if (url.startsWith('//')) return `${scheme}:${url}`
  return url.replace(/^https?:/, `${scheme}:`)
}

function encodeTemplateValue(value) {
  return encodeURIComponent(String(value)).replace(/%7B([a-zA-Z0-9_]+)%7D/gi, '{$1}')
}

function serializeQueryParameters(parameters) {
  return Object.entries(parameters)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeTemplateValue(value)}`)
    .join('&')
}

function createDefaultTemplate(style, options) {
  const parameters = {
    lang: options.lang ?? 'zh_cn',
    size: options.size ?? 1,
    scl: options.scl ?? 1,
    style: getStyleCode(style),
    x: '{x}',
    y: '{y}',
    z: '{z}',
  }

  if (options.scale !== undefined) parameters.scale = options.scale
  if (options.ltype !== undefined) parameters.ltype = options.ltype
  Object.assign(parameters, options.queryParameters || {})

  return `${TILE_HOST}/appmaptile?${serializeQueryParameters(parameters)}`
}

class AMapImageryProvider extends Cesium.UrlTemplateImageryProvider {
  constructor(options = {}) {
    const style = normalizeStyle(options.style)
    if (!options.url && !style) {
      throw new Error(`Unsupported AMap style: ${options.style}`)
    }

    const template = options.url || createDefaultTemplate(style, options)
    const url = normalizeProtocol(template, options.protocol)
    const subdomains = options.subdomains?.length ? options.subdomains : ['1', '2', '3', '4']
    const providerOptions = {
      ...options,
      url,
      subdomains,
    }
    if (options.crs === 'WGS84' && !options.tilingScheme) {
      providerOptions.tilingScheme = new GCJ02TilingScheme()
    }
    super(providerOptions)
    this._templateUrl = url
    this._style = style || 'custom'
    this._styleCode = style ? getStyleCode(style) : null
    this._scl = Number(options.scl ?? 1)
    this._scale = Number(options.scale ?? 1)
  }
}

export { STYLE_ALIASES as amapImageryStyles }
export default AMapImageryProvider
