import * as Cesium from 'cesium'
import { getCesiumImageryOptions } from './cesiumImageryOptions.js'

export const cesiumImageryStyles = Object.freeze({
  img: Cesium.IonWorldImageryStyle.AERIAL,
  img_cva: Cesium.IonWorldImageryStyle.AERIAL_WITH_LABELS,
  elec: Cesium.IonWorldImageryStyle.ROAD,
})

/** 创建 Cesium ion 官方影像，不修改全局 Ion Token。 */
export default async function createCesiumImageryProvider(options = {}) {
  const token = options.token ?? options.accessToken
  if (typeof token !== 'string' || !token.trim()) throw new Cesium.DeveloperError('Cesium ion token is required.')
  const style = options.style ?? 'img'
  const assetId = options.assetId ?? (typeof style === 'number' ? style : cesiumImageryStyles[String(style).toLowerCase()])
  if (!Number.isInteger(assetId) || assetId <= 0) throw new Cesium.DeveloperError('Cesium imagery style must be img, img_cva or elec, or assetId must be a positive integer.')
  if (options.crs && String(options.crs).replace(/[\s_-]/g, '').toUpperCase() !== 'WGS84') throw new Cesium.DeveloperError('Cesium imagery uses WGS84 coordinates.')

  const providerOptions = getCesiumImageryOptions(options)
  const ionOptions = {
    accessToken: token,
    ...(options.server ? { server: options.server } : {}),
  }
  if (!Object.keys(providerOptions).length) return Cesium.IonImageryProvider.fromAssetId(assetId, ionOptions)

  // IonImageryProvider 不转发 culture 等参数。通过公开 REST 端点解析 Bing
  // 授权信息，再使用公开的 Bing 工厂；不修改 Cesium 私有字段或全局缓存。
  const source = options.server ?? Cesium.Ion.defaultServer
  const server = source instanceof Cesium.Resource ? source.clone() : new Cesium.Resource({ url: source })
  server.appendForwardSlash()
  const resource = server.getDerivedResource({
    url: `v1/assets/${assetId}/endpoint`,
    queryParameters: { access_token: token },
  })
  const endpoint = await resource.fetchJson()
  if (endpoint?.type !== 'IMAGERY') throw new Cesium.RuntimeError(`Cesium ion asset ${assetId} is not an imagery asset.`)
  if (endpoint.externalType !== 'BING') throw new Cesium.RuntimeError('Cesium imagery language and tile options require a Bing ion imagery asset. Remove these options for other asset types.')
  const { url, ...defaults } = endpoint.options || {}
  if (!url) throw new Cesium.RuntimeError('Cesium ion Bing imagery endpoint has no service URL.')
  const provider = await Cesium.BingMapsImageryProvider.fromUrl(url, { ...defaults, ...providerOptions })

  // 保留 ion 和 Bing 各自的版权信息，只包装本次创建实例的公开方法。
  const credits = (endpoint.attributions || []).map((item) => new Cesium.Credit(item.html, item.collapsible === false))
  if (credits.length) {
    const getTileCredits = provider.getTileCredits.bind(provider)
    provider.getTileCredits = (...args) => [...credits, ...(getTileCredits(...args) || [])]
  }
  return provider
}
