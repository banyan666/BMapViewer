import { spatialExample, AREA, formatArea } from './spatial-example.js'

export default spatialExample({
  id: 'coverage', name: 'getCoverage', title: '几何覆盖分析', area: true,
  summary: '默认目标区域与两个覆盖圆，继续绘圆增加覆盖范围，统计覆盖率和未覆盖面积。',
  instruction: '单击圆心，再单击边缘添加覆盖圆；可以继续添加，重新绘制恢复默认覆盖范围。',
  legend: [{ color: '#ffb454', label: '未覆盖区域' }, { color: '#4169ff', label: '已覆盖区域' }],
  summarize: (data) => ({ title: '区域覆盖率', value: (data.coverageRatio * 100).toFixed(1) + '%', detail: data.fullyCovered ? '目标区域已全部覆盖' : data.sourceCount + ' 个覆盖区域，先合并去重', rows: [['目标面积', formatArea(data.targetArea, data.unit)], ['已覆盖', formatArea(data.coveredArea, data.unit)], ['未覆盖', formatArea(data.uncoveredArea, data.unit)]] }),
}, `const target = ${JSON.stringify(AREA)}
const covers = [
  analysis.getBuffer([125.809, 44.147], 0.8).geometry,
  analysis.getBuffer([125.829, 44.154], 0.8).geometry,
]
function updateCoverage() {
  const result = analysis.getCoverage(target, covers)
  scene.polygons('uncovered', [result.uncoveredGeometry], '#ffb454', 0.4, 2)
  scene.polygons('result', [result.coveredGeometry])
  scene.label(analysis.getArea(target).center, '覆盖率 ' + (result.coverageRatio * 100).toFixed(1) + '%')
  scene.publish(result)
}
function pickNextCircle() {
  scene.start('pickCircle', ({ center, radius }) => {
    covers.push(analysis.getBuffer(center, radius).geometry)
    updateCoverage()
    // 上一个拾取回调结束后，再启动下一轮；destroy 后不会再次创建监听。
    queueMicrotask(pickNextCircle)
  }, { isReserve: false })
}
updateCoverage()
pickNextCircle()`)
