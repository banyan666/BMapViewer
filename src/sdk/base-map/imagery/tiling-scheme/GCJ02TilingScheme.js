import * as Cesium from 'cesium'
import CoordTransform from '../../transform/CoordTransform.js'

export function normalizeGCJ02Crs(crs = 'WGS84') {
  const normalized = String(crs).replace(/[\s_-]/g, '').toUpperCase()
  if (!['WGS84', 'GCJ02', 'BD09'].includes(normalized)) {
    throw new Error(`Unsupported GCJ02 tiling coordinate system: ${crs}`)
  }
  return normalized
}

class GCJ02TilingScheme extends Cesium.WebMercatorTilingScheme {
  constructor(options = {}) {
    super(options)
    // crs 是业务经纬度的坐标系，瓦片始终使用 GCJ02。
    // 独立使用时保留 WGS84 默认值，避免改变既有自定义底图的行为。
    this.crs = normalizeGCJ02Crs(options.crs ?? 'WGS84')
    if (this.crs === 'GCJ02') return
    const projection = new Cesium.WebMercatorProjection(this.ellipsoid)

    this._projection.project = (cartographic) => {
      const inputLongitude = Cesium.Math.toDegrees(cartographic.longitude)
      const inputLatitude = Cesium.Math.toDegrees(cartographic.latitude)
      const [longitude, latitude] = this.crs === 'BD09'
        ? CoordTransform.BD09ToGCJ02(inputLongitude, inputLatitude)
        : CoordTransform.WGS84ToGCJ02(inputLongitude, inputLatitude)
      const result = projection.project(new Cesium.Cartographic(
        Cesium.Math.toRadians(longitude),
        Cesium.Math.toRadians(latitude),
      ))
      return new Cesium.Cartesian2(result.x, result.y)
    }

    this._projection.unproject = (cartesian) => {
      const cartographic = projection.unproject(cartesian)
      const inputLongitude = Cesium.Math.toDegrees(cartographic.longitude)
      const inputLatitude = Cesium.Math.toDegrees(cartographic.latitude)
      const [longitude, latitude] = this.crs === 'BD09'
        ? CoordTransform.GCJ02ToBD09(inputLongitude, inputLatitude)
        : CoordTransform.GCJ02ToWGS84(inputLongitude, inputLatitude)
      return new Cesium.Cartographic(
        Cesium.Math.toRadians(longitude),
        Cesium.Math.toRadians(latitude),
      )
    }
  }
}

export default GCJ02TilingScheme
