import { spatialExample, AREA, formatArea } from './spatial-example.js'

export default spatialExample({
  id: 'difference-area', name: 'getDifferenceArea', title: '面积差集分析', area: true,
  summary: '默认区域减去拾取区域，展示剩余几何；支持完整扣除、多个分块及孔洞。',
  instruction: '绘制要扣除的区域并双击结束，蓝色为默认区域扣除后的剩余部分。',
  legend: [{ color: '#ef534b', label: '默认区域' }, { color: '#36df93', label: '扣除区域' }, { color: '#4169ff', label: '剩余部分' }],
  summarize: (data) => ({ title: '剩余面积', value: formatArea(data.area, data.unit), detail: data.hasArea ? data.parts.length + ' 个剩余区域' : '默认区域已全部扣除', rows: [['原面积', formatArea(data.firstArea, data.unit)], ['扣除面积', formatArea(data.removedArea, data.unit)]] }),
}, `const original = ${JSON.stringify(AREA)}
scene.polygons('base', [{ type: 'Polygon', coordinates: [analysis.getArea(original).coordinates] }], '#ef534b', 0.3, 2)
scene.start('pickPolygon', (coordinates) => {
  const result = analysis.getDifferenceArea(original, coordinates)
  scene.polygons('result', [result.geometry])
  scene.label(result.center, '剩余面积\\n' + areaText(result))
  scene.publish(result)
})`)
