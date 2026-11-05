export default {
  id: 'radar-scanner-3d',
  name: 'RadarScanner3DLayer',
  title: '三维雷达',
  group: '三维场景',
  summary: '绘制半球雷达与持续旋转的扫描扇面。',
  code: `const layer = new MapLayers.RadarScanner3DLayer(viewer, {
  radius: 1500,
  color: 'rgb(38, 245, 229)',
  outlineColor: '#a8fff7',
  speed: 1.35,
  hemisphereAlpha: 0.16,
  scanAlpha: 0.7,
  autoStart: true
})

layer.setData([
  {
    geometry: { type: 'Point', coordinates: [125.834, 44.147, 0] },
    properties: { id: 'jiutai-radar', name: '九台雷达', radius: 1500 }
  },
  {
    geometry: { type: 'Point', coordinates: [125.869, 44.165, 0] },
    properties: {
      id: 'east-radar', name: '东侧雷达', radius: 900,
      color: '#69b9ff', outlineColor: '#b3d9ff', speed: -0.8
    }
  }
])

return layer`,
}
