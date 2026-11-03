import { CESIUM_ION_TOKEN } from '../config/cesium.js'

export default {
  id: 'cesium-terrain',
  name: 'CesiumTerrain',
  title: 'Cesium World Terrain',
  group: '三维地形',
  managesCamera: true,
  summary: '加载 Cesium ion 官方全球地形，已配置示例 Token，可直接运行。',
  code: `// 申请token地址https://ion.cesium.com/tokens
const token = ${JSON.stringify(CESIUM_ION_TOKEN)}
  
if (token.startsWith('替换')) {
  throw new Error('请先填写 Cesium ion Token')
}

// 先确定视角，再加载影像与地形；就绪后不再重复定位。
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

try {
  await Promise.all([imagery.readyPromise, terrain.readyPromise])
} catch (error) {
  terrain.destroy()
  imagery.destroy()
  throw error
}

return () => {
  terrain.destroy()
  imagery.destroy()
}`,
}
