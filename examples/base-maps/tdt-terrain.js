export default {
  id: 'tdt-terrain',
  name: 'TdtTerrain',
  title: '天地图三维地形',
  group: '三维地形',
  managesCamera: true,
  summary: '组合天地图影像与 swdx 高程服务；请替换开发者 Key 后运行。',
  code: `const key = '替换为你的天地图 Key'
if (key.startsWith('替换')) {
  throw new Error('请先填写天地图 Key')
}

viewer.camera.cancelFlight()
viewer.camera.setView({
  destination: Cesium.Cartesian3.fromDegrees(117.93234, 43.78764, 8500),
  orientation: {
    heading: Cesium.Math.toRadians(12),
    pitch: Cesium.Math.toRadians(-18),
    roll: 0,
  },
})

const imagery = new BaseMaps.BaseMap(viewer, {
  type: 'tdt',
  style: 'img',
  key,
  maximumLevel: 18,
})

const terrain = new BaseMaps.TdtTerrain(viewer, {
  key,
  dataType: 'int16',
  minimumDataLevel: 5,
  maximumDataLevel: 11,
  depthTestAgainstTerrain: true,
})

return () => {
  terrain.destroy()
  imagery.destroy()
}`,
}
