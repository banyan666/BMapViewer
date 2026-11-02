import * as Cesium from 'cesium'
import BD09TilingScheme, { normalizeBaiduCrs } from '../tiling-scheme/BD09TilingScheme.js'

const TILE_HOST = {
  free: 'https://maponline{s}.bdimg.com',
  authorized: 'https://apimaponline{s}.bdimg.com',
}

const TILE_PATH = {
  vec: '/tile/',
  img: '/starpic/',
}

const STYLE_ALIASES = Object.freeze({
  normal: 'vec',
  vec: 'vec',
  vector: 'vec',
  elec: 'vec',
  img: 'img',
  image: 'img',
  imagery: 'img',
  satellite: 'img',
  custom: 'custom',
})

function normalizeStyle(style = 'normal') {
  return STYLE_ALIASES[String(style).toLowerCase()]
}

function normalizeProtocol(url, protocol) {
  if (!protocol) return url
  const scheme = String(protocol).replace(/:\/\/$/, '').replace(/:$/, '')
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
  const host = options.key ? TILE_HOST.authorized : TILE_HOST.free
  const parameters = style === 'img'
    ? {
        qt: 'satepc',
        u: `x={x};y={y};z={z};v=${options.v ?? '009'};type=${options.satelliteType ?? 'sate'}`,
        fm: 46,
      }
    : {
        qt: 'vtile',
        x: '{x}',
        y: '{y}',
        z: '{z}',
        styles: 'pl',
        scaler: 1,
      }

  for (const key of ['qt', 'styles', 'scaler', 'udt', 'fm']) {
    if (options[key] !== undefined) parameters[key] = options[key]
  }

  Object.assign(parameters, options.queryParameters || {})
  delete parameters.ak
  if (options.key) parameters.ak = options.key

  return `${host}${TILE_PATH[style]}?${serializeQueryParameters(parameters)}`
}

/**
 * 百度卫星瓦片把完整坐标串放在 u 参数中，例如：
 * u=x=3439;y=1252;z=14;v=009;type=sate
 *
 * Cesium.Resource 会把未编码的分号和等号再次拆成查询参数，导致请求变成
 * u=x&y=1252&z=14...。这里只编码 u 的值，浏览器发出请求时百度服务端仍会
 * 将其还原成同一段坐标串。
 */
function encodeSatelliteQueryValue(url) {
  return url.replace(/([?&]u=)([^&]*)/i, (_match, prefix, value) => {
    const normalizedValue = value
      .replace(/%3d/gi, '=')
      .replace(/%3b/gi, ';')

    return `${prefix}${normalizedValue.replaceAll('=', '%3D').replaceAll(';', '%3B')}`
  })
}

class BaiduImageryProvider extends Cesium.UrlTemplateImageryProvider {
  constructor(options = {}) {
    const style = normalizeStyle(options.style)
    if (!options.url && !style) {
      throw new Error(`Unsupported Baidu map style: ${options.style}`)
    }
    if (!options.url && style === 'custom') {
      throw new Error('Baidu custom map style requires an authorized custom url.')
    }

    const template = options.url || createDefaultTemplate(style, options)
    const customStyle = options.customId || options.style || ''
    const normalizedUrl = normalizeProtocol(template, options.protocol)
      .replaceAll('{customId}', encodeURIComponent(customStyle))
      .replaceAll('{style}', encodeURIComponent(customStyle))
    const url = style === 'img' ? encodeSatelliteQueryValue(normalizedUrl) : normalizedUrl
    const crs = normalizeBaiduCrs(options.crs ?? 'BD09')
    let tilingScheme = options.tilingScheme
    if (!tilingScheme) {
      const resolutions = Array.from({ length: 19 }, (_, index) => 256 * 2 ** (18 - index))
      tilingScheme = new BD09TilingScheme({
        crs,
        resolutions,
        rectangleSouthwestInMeters: new Cesium.Cartesian2(-20037726.37, -12474104.17),
        rectangleNortheastInMeters: new Cesium.Cartesian2(20037726.37, 12474104.17),
      })
    }

    const subdomains = options.subdomains || ['0', '1', '2', '3']
    super({
      ...options,
      url,
      subdomains,
      tilingScheme,
      maximumLevel: options.maximumLevel ?? 18,
      credit: options.credit || new Cesium.Credit('© Baidu Maps'),
    })
    this._templateUrl = url
    this._crs = crs
    // 默认三种 CRS 统一使用百度原点/有符号瓦片编号；自定义切片方案保留原有编号规则。
    this._nativeTileCoordinates = tilingScheme instanceof BD09TilingScheme || crs === 'WGS84'
    this._style = style || 'custom'
    this._subdomains = Array.isArray(subdomains) ? subdomains : String(subdomains).split('')
    this._rectangle = options.rectangle || this._tilingScheme.rectangle
  }

  _buildImageUrl(x, y, level) {
    const xTiles = this._tilingScheme.getNumberOfXTilesAtLevel(level)
    const yTiles = this._tilingScheme.getNumberOfYTilesAtLevel(level)
    const subdomain = this._subdomains[Math.abs(x + y + level) % this._subdomains.length] || '0'
    let url = this._templateUrl
      .replaceAll('{z}', String(level))
      .replaceAll('{s}', subdomain)

    if (this._nativeTileCoordinates) {
      url = url.replaceAll('{x}', String(x)).replaceAll('{y}', String(-y))
    } else {
      url = url
        .replaceAll('{x}', String(x - xTiles / 2))
        .replaceAll('{y}', String(yTiles / 2 - y - 1))
    }
    return url
  }

  requestImage(x, y, level) {
    return Cesium.ImageryProvider.loadImage(this, this._buildImageUrl(x, y, level))
  }
}

export { STYLE_ALIASES as baiduImageryStyles }
export default BaiduImageryProvider
