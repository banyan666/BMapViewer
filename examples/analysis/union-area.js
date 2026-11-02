import { spatialExample, AREA, formatArea } from './spatial-example.js'

export default spatialExample({
  id: 'union-area', name: 'getUnionArea', title: '区域合并分析', area: true,
  summary: '将拾取区域与默认区域合并，展示去重后的边界和面积。',
  instruction: '绘制第二个区域并双击结束，蓝色为合并后的几何，重叠部分不重复计入面积。',
  legend: [{ color: '#ef534b', label: '默认区域' }, { color: '#4169ff', label: '合并结果' }],
  summarize: (data) => ({ title: '合并面积', value: formatArea(data.area, data.unit), detail: data.sourceCount + ' 个原始区域', rows: [['面积直接累加', formatArea(data.sourceArea, data.unit)], ['消除重复面积', formatArea(data.duplicateArea, data.unit)], ['合并后分块', String(data.parts.length)]] }),
}, `const original = ${JSON.stringify(AREA)}
scene.polygons('base', [{ type: 'Polygon', coordinates: [analysis.getArea(original).coordinates] }], '#ef534b', 0.3, 2)
scene.start('pickPolygon', (coordinates) => {
  const result = analysis.getUnionArea([original, coordinates])
  scene.polygons('result', [result.geometry])
  scene.label(result.center, '合并面积\\n' + areaText(result))
  scene.publish(result)
})`)
