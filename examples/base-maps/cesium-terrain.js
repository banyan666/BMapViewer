import { CESIUM_ION_TOKEN } from '../config/cesium.js'

export default {
  id: 'cesium-terrain',
  name: 'CesiumTerrain',
  title: 'Cesium World Terrain',
  group: '三维地形',
  summary: '加载 Cesium ion 官方全球地形，已配置示例 Token，可直接运行。',
  code: `// 申请token地址https://ion.cesium.com/tokens
const token = ${JSON.stringify(CESIUM_ION_TOKEN)}
  
if (token.startsWith('替换')) {
  throw new Error('请先填写 Cesium ion Token')
}

const imagery = new BaseMaps.BaseMap(viewer, {
  type: 'arcgis',
  url: 'https://server.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer',
  maximumLevel: 23,
})

const terrain = new BaseMaps.CesiumTerrain(viewer, {
  token,
  requestVertexNormals: true,
  requestWaterMask: true,
  depthTestAgainstTerrain: true,
})

await terrain.readyPromise

viewer.camera.flyTo({
  destination: Cesium.Cartesian3.fromDegrees(117.93234, 43.78764, 8500),
  orientation: {
    heading: Cesium.Math.toRadians(12),
    pitch: Cesium.Math.toRadians(-18),
    roll: 0,
  },
  duration: 1.2,
})

return () => {
  terrain.destroy()
  imagery.destroy()
}`,
}
