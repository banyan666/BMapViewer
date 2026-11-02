import { spatialExample } from './spatial-example.js'

export default spatialExample({
  id: 'points-in-polygon', name: 'getPointsInPolygon', title: '点面关系与范围统计',
  summary: '预置 30 个本地点位，绘制区域筛选其中的点，保留点位属性，并区分边界点。',
  instruction: '绘制多边形并双击结束，区域内点位显示绿色，区域外显示橙色。',
  legend: [{ color: '#6dffb1', label: '范围内' }, { color: '#ffb454', label: '范围外' }],
  summarize: (data) => ({ title: '范围内点位', value: data.count + ' 个', detail: '边界默认计入范围内', rows: [['总点位', String(data.totalCount)], ['范围外', String(data.outsidePoints.length)], ['位于边界', String(data.boundaryPoints.length)]] }),
}, `const points = samplePoints()
scene.points(points)
scene.start('pickPolygon', (coordinates) => {
  const result = analysis.getPointsInPolygon(points, coordinates, { includeBoundary: true })
  scene.points(points, result.insidePoints.map((item) => item.index))
  scene.label(analysis.getArea(coordinates).center, '范围内点位：' + result.count + ' / ' + result.totalCount)
  scene.publish(result)
})`)
