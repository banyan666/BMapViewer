import * as Cesium from 'cesium'
import BD09Projection from '../projection/BD09Projection.js'
import CoordTransform from '../../transform/CoordTransform.js'

export function normalizeBaiduCrs(crs = 'BD09') {
  const normalized = String(crs).replace(/[\s_-]/g, '').toUpperCase()
  if (!['WGS84', 'GCJ02', 'BD09'].includes(normalized)) {
    throw new Error(`Unsupported Baidu coordinate system: ${crs}`)
  }
  return normalized
}

class BD09TilingScheme extends Cesium.WebMercatorTilingScheme {
  constructor(options = {}) {
    super(options)
    const projection = new BD09Projection()
    // 独立创建切片方案时保持原有 WGS84 默认值；Provider 显式传入业务坐标系。
    this.crs = normalizeBaiduCrs(options.crs ?? 'WGS84')

    this._projection.project = (cartographic) => {
      let point = [
        Cesium.Math.toDegrees(cartographic.longitude),
        Cesium.Math.toDegrees(cartographic.latitude),
      ]
      if (this.crs === 'WGS84') point = CoordTransform.WGS84ToGCJ02(point[0], point[1])
      if (this.crs === 'WGS84' || this.crs === 'GCJ02') point = CoordTransform.GCJ02ToBD09(point[0], point[1])
      // BD09 原始经纬度直接进入百度墨卡托投影，不经过任何经纬度加偏函数。
      point[0] = Math.min(180, Math.max(-180, point[0]))
      point[1] = Math.min(74.000022, Math.max(-71.988531, point[1]))
      const result = projection.lngLatToPoint({ lng: point[0], lat: point[1] })
      return new Cesium.Cartesian2(result.x, result.y)
    }

    this._projection.unproject = (cartesian) => {
      let point = projection.mercatorToLngLat({ lng: cartesian.x, lat: cartesian.y })
      point = [point.lng, point.lat]
      if (this.crs === 'WGS84' || this.crs === 'GCJ02') point = CoordTransform.BD09ToGCJ02(point[0], point[1])
      if (this.crs === 'WGS84') point = CoordTransform.GCJ02ToWGS84(point[0], point[1])
      return new Cesium.Cartographic(
        Cesium.Math.toRadians(point[0]),
        Cesium.Math.toRadians(point[1]),
      )
    }
    this.resolutions = options.resolutions || Array.from({ length: 19 }, (_, index) => 256 * 2 ** (18 - index))
  }

  tileXYToNativeRectangle(x, y, level, result) {
    const tileWidth = this.resolutions[level]
    const west = x * tileWidth
    const east = (x + 1) * tileWidth
    const north = (-y + 1) * tileWidth
    const south = -y * tileWidth
    if (!Cesium.defined(result)) return new Cesium.Rectangle(west, south, east, north)
    result.west = west
    result.south = south
    result.east = east
    result.north = north
    return result
  }

  positionToTileXY(position, level, result) {
    if (!Cesium.Rectangle.contains(this._rectangle, position)) return undefined
    const projected = this._projection.project(position)
    if (!Cesium.defined(projected)) return undefined
    const tileWidth = this.resolutions[level]
    const x = Math.floor(projected.x / tileWidth)
    const y = -Math.floor(projected.y / tileWidth)
    if (!Cesium.defined(result)) return new Cesium.Cartesian2(x, y)
    result.x = x
    result.y = y
    return result
  }
}

export default BD09TilingScheme
