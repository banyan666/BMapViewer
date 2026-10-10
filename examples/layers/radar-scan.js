export default {
  id: 'radar-scan',
  name: 'RadarScanLayer',
  title: '雷达扫描',
  group: '动态效果',
  summary: '沿地表深度绘制旋转扫描区域，支持控制外圈和扫描方向。',
  code: `const layer = new MapLayers.RadarScanLayer(viewer, {
  radius: 1800,
  color: '#2de8dc',
  opacity: 0.85,
  duration: 3600,
  showOuterRing: true,
  direction: 'clockwise', // clockwise / counterclockwise
  startAngle: 0 // 从正北起算，单位：度
})

layer.setData([
  {
    geometry: {
      type: 'Point',
      coordinates: [125.8337, 44.1471, 0]
    },
    properties: {
      id: 'jiutai-radar',
      name: '九台雷达扫描'
    }
  }
])

return layer`,
}
