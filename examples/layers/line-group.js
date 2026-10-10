export default {
  id: 'line-group',
  name: 'LineGroupLayer',
  title: '发光线',
  group: '线面图层',
  summary: '以 Entity 绘制发光与轮廓线路。',
  code: `const layer = new MapLayers.LineGroupLayer(viewer, {
  width: 5,
  color: '#00e5ff',
  type: 'glow',
  glowPower: 0.22
})

layer.setData([
  {
    geometry: { type: 'LineString', coordinates: [[125.816, 44.143], [125.825, 44.151], [125.836, 44.146], [125.850, 44.153]] },
    properties: { id: 'route-primary', type: 'glow', color: '#00e5ff', width: 7 }
  },
  {
    geometry: { type: 'LineString', coordinates: [[125.820, 44.157], [125.833, 44.150], [125.846, 44.139]] },
    properties: { id: 'route-secondary', type: 'outline', color: '#ffd166', width: 4 }
  }
])

return layer`,
}
