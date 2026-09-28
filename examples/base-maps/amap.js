export default {
  id: 'amap',
  name: 'AMapImageryProvider',
  title: '高德地图',
  group: '互联网底图',
  summary: '通过 wprd0 瓦片服务加载高德地图；支持 style 6～10 和注记开关，crs=WGS84 时自动使用 GCJ-02 切片纠偏。',
  code: `const baseMap = new BaseMaps.BaseMap(viewer, {
  type: 'amap',
  style: 7, // 6～10，也可使用 img、elec、cva
  scl: 1, // 1：显示注记；2：隐藏注记
  crs: 'GCJ-02',
  maximumLevel: 18,
})

return baseMap`,
}
