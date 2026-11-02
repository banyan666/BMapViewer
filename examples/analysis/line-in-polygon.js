import { spatialExample, AREA, formatDistance } from './spatial-example.js'

export default spatialExample({
  id: 'line-in-polygon', name: 'getLineInPolygon', title: '线面穿越分析',
  summary: '沿区域边界切分拾取折线，分别统计区域内外的距离，并高亮各段。',
  instruction: '绘制穿过红色区域的折线并双击结束；绿色为区域内，橙色为区域外。',
  legend: [{ color: '#ef534b', label: '分析区域' }, { color: '#6dffb1', label: '区域内线路' }, { color: '#ffb454', label: '区域外线路' }],
  summarize: (data) => ({ title: '区域内距离', value: formatDistance(data.insideDistance, data.unit), detail: '按切分线段汇总', rows: [['区域外距离', formatDistance(data.outsideDistance, data.unit)], ['切分后总距离', formatDistance(data.totalDistance, data.unit)], ['边界交点', String(data.intersections.length)]] }),
}, `const region = ${JSON.stringify(AREA)}
scene.polygons('base', [{ type: 'Polygon', coordinates: [analysis.getArea(region).coordinates] }], '#ef534b', 0.25, 2)
scene.start('pickLine', (coordinates) => {
  const result = analysis.getLineInPolygon(coordinates, region, { includeBoundary: true })
  scene.lines([...lineData(result.insideGeometry, '#6dffb1', 'inside'), ...lineData(result.outsideGeometry, '#ffb454', 'outside')])
  scene.label(coordinates.at(-1), '区域内 ' + distanceText(result.insideDistance, result.unit) + '\\n区域外 ' + distanceText(result.outsideDistance, result.unit))
  scene.publish(result)
})`)
