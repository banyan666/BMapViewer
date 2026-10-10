export default {
  id: 'dynamic-water',
  name: 'DynamicWaterLayer',
  title: '动态体积水',
  group: '动态效果',
  summary: '使用细分真实网格、顶点位移与水面光照构建具有波峰起伏的动态水域。',
  code: `const layer = new MapLayers.DynamicWaterLayer(viewer, {
  autoStart: true,
  meshSegments: 144,
  waveScale: 11.5,
  waveHeight: 0.48,
  geometryWaveHeight: 110,
  choppy: 4.0,
  speed: 0.68,
  foam: 0.5,
  normalStrength: 1.8,
  fresnel: 0.8,
  specular: 2.25,
  alpha: 0.94,
  deepColor: '#063a56',
  shallowColor: '#32bdc6',
  foamColor: '#efffff'
})

const waterData = [
  {
    geometry: {
      type: 'Point',
      coordinates: [125.835, 44.140, 160]
    },
    properties: {
      id: 'jiutai-volume-water',
      name: '九台动态水域',
      width: 6600,
      depth: 6600
    }
  }
]

layer.setData(waterData)
layer.flyTo('jiutai-volume-water', 1.2)

return layer`,
}
