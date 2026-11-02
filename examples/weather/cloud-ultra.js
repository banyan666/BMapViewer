export default {
  id: 'cloud-ultra', name: 'CloudUltraEffect', title: '体积云 Ultra', code: 'CLOUD ULTRA',
  renderMode: 'VOLUME PIPELINE',
  time: '2026-06-21T04:00:00Z',
  camera: { longitude: 125.83372000975274, latitude: 44.14712267403385, height: 300, pitch: -3, minHeight: 200, maxHeight: 800000 },
  summary: '多层体积云、Bruneton 大气散射、级联云阴影与时间抗锯齿；首次运行需准备噪声及大气资源。',
  parameters: ['coverage', 'layers', 'windSpeed', 'windDirection', 'steps', 'temporalUpscale'],
  codeText: `const cloud = new WeatherEffects.CloudUltraEffect(viewer, {
  coverage: 0.3,
  exposure: 10,
  windSpeed: 100,
  windDirection: 0, // 0 北，90 东，单位：度
  steps: 500,
  temporalUpscale: false, // 时间升采样，开启会减少计算量
  perfOptimize: true, // 阴影贴图降采样
  enableShadow: true,
  enableCloudShadow: true,
  cloudShadowStrength: 1,
  layers: [
    { altitude: 750, height: 650, shadow: true },
    { altitude: 1000, height: 1200, shadow: true },
    { altitude: 7500, height: 500, densityScale: 0.003, shadow: false },
  ],
})

await cloud.readyPromise
// cloud.setOptions({ coverage: 0.45, windSpeed: 15 })
return cloud`,
}
