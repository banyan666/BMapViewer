import * as Cesium from 'cesium'

function culture(value) {
  if (typeof value !== 'string' || !value.trim()) throw new Cesium.DeveloperError('Cesium imagery language/culture must be a non-empty language tag.')
  let tag
  try { tag = Intl.getCanonicalLocales(value.trim().replace(/_/g, '-'))[0] }
  catch { throw new Cesium.DeveloperError('Invalid Cesium imagery language/culture tag.') }
  // Bing 使用书写体系区分简繁体，而不是 zh-CN / zh-TW 地区代码。
  if (/^zh-(Hans|CN|SG)(-|$)/i.test(tag)) return 'zh-Hans'
  if (/^zh-(Hant|TW|HK|MO)(-|$)/i.test(tag)) return 'zh-Hant'
  return tag
}

/** 仅允许传递 Bing 官方支持的参数，不向瓦片服务转发 ion Token。 */
export function getCesiumImageryOptions(options) {
  const result = {}
  const language = options.culture ?? options.language
  if (language != null) result.culture = culture(language)
  if (options.tileProtocol != null) {
    const protocol = typeof options.tileProtocol === 'string' ? options.tileProtocol.toLowerCase().replace(/:$/, '') : ''
    if (!['http', 'https'].includes(protocol)) throw new Cesium.DeveloperError('Cesium imagery tileProtocol must be http or https.')
    result.tileProtocol = protocol
  }
  if (options.mapLayer != null) {
    if (typeof options.mapLayer !== 'string' || !options.mapLayer.trim()) throw new Cesium.DeveloperError('Cesium imagery mapLayer must be a non-empty string.')
    result.mapLayer = options.mapLayer.trim()
  }
  if (options.ellipsoid != null) {
    if (!(options.ellipsoid instanceof Cesium.Ellipsoid)) throw new Cesium.DeveloperError('Cesium imagery ellipsoid must be a Cesium.Ellipsoid.')
    result.ellipsoid = options.ellipsoid
  }
  if (options.tileDiscardPolicy != null) {
    if (typeof options.tileDiscardPolicy.isReady !== 'function' || typeof options.tileDiscardPolicy.shouldDiscardImage !== 'function') throw new Cesium.DeveloperError('Cesium imagery tileDiscardPolicy must implement isReady and shouldDiscardImage.')
    result.tileDiscardPolicy = options.tileDiscardPolicy
  }
  return result
}
