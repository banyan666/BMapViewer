import { CESIUM_ION_TOKEN } from '../config/cesium.js'

export default {
  id: 'height-fog', name: 'HeightFogEffect', title: '高度雾', code: 'HEIGHT FOG',
  terrain: {
    token: import.meta.env?.VITE_CESIUM_ION_TOKEN || CESIUM_ION_TOKEN,
    requestVertexNormals: true, requestWaterMask: true, depthTestAgainstTerrain: true,
  },
  camera: { longitude: 110.479, latitude: 29.327, height: 1800, pitch: -18, minHeight: 80, maxHeight: 800000 },
  summary: '使用 CesiumTerrain 展示张家界山地深度高度雾；参考 FogDemo 的视线积分和亮度合成，山谷积雾、山峰露出。',
  parameters: ['fogHeight', 'density', 'brightness', 'startDistance', 'maxOpacity', 'color'],
  codeText: `// 工作台已加载 Cesium World Terrain，并定位到山地。
const fog = new WeatherEffects.HeightFogEffect(viewer, {
  fogHeight: 700,    // 雾层顶部高程，米
  baseHeight: 0,
  density: 0.62,
  brightness: 0.9, // 场景和雾色的整体亮度
  startDistance: 100,
  maxDistance: 100000,
  maxOpacity: 1,
  intensity: 1,
  color: '#ccd2d6',
})

// fog.setOptions({ fogHeight: 1100, density: 0.45, brightness: 1 })
return fog`,
}
