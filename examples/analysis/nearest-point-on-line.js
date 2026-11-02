import { spatialExample, ROUTE, formatDistance } from './spatial-example.js'

export default spatialExample({
  id: 'nearest-point-on-line', name: 'getNearestPointOnLine', title: '点到线最近距离',
  summary: '预置折线，拾取一个点，计算线上最近点及距离，并绘制连接线。',
  instruction: '单击线路附近任意位置；拖动点位更新最近点与距离。',
  legend: [{ color: '#56aaff', label: '原线路' }, { color: '#ffd066', label: '最近连接线' }],
  summarize: (data) => ({ title: '点到线距离', value: formatDistance(data.distance, data.unit), detail: '球面最近距离', rows: [['沿线累计距离', formatDistance(data.distanceAlongLine, data.unit)], ['线段索引', String(data.segmentIndex)]] }),
}, `const route = ${JSON.stringify(ROUTE)}
const routeGeometry = { type: 'LineString', coordinates: route }
scene.lines(lineData(routeGeometry, '#56aaff', 'route'))
scene.start('pickPoint', (coordinate) => {
  const result = analysis.getNearestPointOnLine(coordinate, route)
  scene.lines([...lineData(routeGeometry, '#56aaff', 'route'), ...lineData(result.connection, '#ffd066', 'connection')])
  scene.label(result.center, '最近距离\\n' + distanceText(result.distance, result.unit))
  scene.publish(result)
})`)
