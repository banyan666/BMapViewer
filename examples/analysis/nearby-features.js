import { spatialExample, formatDistance } from './spatial-example.js'

export default spatialExample({
  id: 'nearby-features', name: 'getNearbyFeatures', title: '周边点位查询',
  summary: '绘制圆形查询半径内的点位，按距离排序，返回最近点位与完整属性。',
  instruction: '先单击圆心，再单击确定半径；拖动圆心或边缘控制点更新周边查询。',
  legend: [{ color: '#6dffb1', label: '半径内' }, { color: '#ffb454', label: '半径外' }],
  summarize: (data) => ({ title: '周边点位', value: data.count + ' 个', detail: '按距离升序返回', rows: [['查询半径', formatDistance(data.radius, data.unit)], ['最近点位', data.nearest?.properties?.name || '无'], ['最近距离', data.nearest ? formatDistance(data.nearest.distance, data.unit) : '—']] }),
}, `const points = samplePoints()
scene.points(points)
scene.start('pickCircle', ({ center, radius }) => {
  const result = analysis.getNearbyFeatures(center, radius, points)
  scene.points(points, result.features.map((item) => item.index))
  scene.label(center, '周边点位：' + result.count + ' 个\\n半径 ' + distanceText(radius, result.unit))
  scene.publish(result)
})`)
