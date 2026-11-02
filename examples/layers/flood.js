import { CESIUM_ION_TOKEN } from '../config/cesium.js'

export default {
  id: 'flood',
  name: 'FloodLayer',
  title: '动态淹没水体',
  group: '动态效果',
  summary: '在真实地形上展示连续上升的等水位水体；可编辑起始水位、目标水位、速度、方向、颜色和透明度。',
  baseMap: { type: 'arcgis', maximumLevel: 23 },
  terrain: {
    token: import.meta.env?.VITE_CESIUM_ION_TOKEN || CESIUM_ION_TOKEN,
    requestVertexNormals: true,
    requestWaterMask: true,
    depthTestAgainstTerrain: true,
  },
  camera: {
    longitude: 117.9315, latitude: 43.805, height: 6500,
    pitch: -48, minHeight: 80, maxHeight: 800000,
  },
  code: `// 工作台已加载 Cesium World Terrain，并开启地形深度检测。
// 水位为椭球高（米），不是离地高度；图层只展示水体，不计算淹没面积。
const layer = new MapLayers.FloodLayer(viewer, {
  startHeight: 1000,
  targetHeight: 1450,
  baseHeight: 900,
  speed: 20, // 米/秒
  direction: 'up', // up 上升 / down 下降
  color: '#409dfd',
  opacity: 0.65,
  callbackInterval: 500,
  onComplete(height) { console.log('到达目标水位：', height, 'm') },
})

layer.setData([{
  geometry: {
    type: 'Polygon',
    coordinates: [[
      [117.912, 43.780], [117.951, 43.780],
      [117.951, 43.808], [117.912, 43.808],
      [117.912, 43.780],
    ]],
  },
  properties: { id: 'mountain-flood', name: '山谷淹没水体' },
}])

// 聚焦山谷中的水体，避免地形高程影响默认镜头的视线落点。
viewer.camera.flyToBoundingSphere(
  new Cesium.BoundingSphere(Cesium.Cartesian3.fromDegrees(117.9315, 43.794, 1250), 2000),
  { duration: 0, offset: new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-48), 6500) },
)
layer.start()

// layer.pause(); layer.start() // 暂停 / 继续
// layer.reset(); layer.setWaterHeight(1250) // 复位 / 指定水位
// 模拟下降：将 startHeight 设为 1450，targetHeight 设为 1000，direction 设为 'down'。
return layer`,
}
