export default {
  id: 'polygon-primitive',
  name: 'PolygonPrimitiveLayer',
  title: '高性能面',
  group: '线面图层',
  summary: '使用 Primitive API 渲染带描边的业务区域。',
  code: `const layer = new MapLayers.PolygonPrimitiveLayer(viewer, {
  color: '#00d8e6',
  opacity: 0.42,
  lineWidth: 3
})

layer.setData([
  {
    geometry: {
      type: 'Polygon',
      coordinates: [[
        [125.817, 44.156], [125.835, 44.158], [125.846, 44.149],
        [125.837, 44.138], [125.820, 44.141], [125.817, 44.156]
      ]]
    },
    properties: { id: 'zone-safe', name: '安全生产区', color: '#00e1c5' }
  }
])

return layer`,
}
