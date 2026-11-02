export default {
  id: 'amap',
  name: 'AMapImageryProvider',
  title: '高德地图',
  group: '互联网底图',
  summary: '加载高德地图；crs=GCJ02 不纠偏，WGS84 和 BD09 自动转换为高德坐标。',
  code: `const baseMap = new BaseMaps.BaseMap(viewer, {
  type: 'amap',
  style: 7, // 6～10，也可使用 img、elec、cva
  scl: 1, // 1：显示注记；2：隐藏注记
  crs: 'GCJ02', // 高德坐标不纠偏；WGS84、BD09 自动转换
  maximumLevel: 18,
})

return baseMap`,
}
