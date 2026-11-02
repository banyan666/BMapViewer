import { spatialExample, formatArea } from './spatial-example.js'

export const bufferExamples = ['point', 'line', 'polygon'].map((kind) => {
  const titles = { point: '点', line: '线', polygon: '面' }
  const methods = { point: 'pickPoint', line: 'pickLine', polygon: 'pickPolygon' }
  const types = { point: 'Point', line: 'LineString', polygon: 'Polygon' }
  return spatialExample({
    id: 'buffer-' + kind, name: 'getBuffer', title: titles[kind] + '缓冲区分析', area: true,
    summary: `拾取${titles[kind]}，生成周围指定距离的缓冲区，返回面积与可绘制的面几何。`,
    instruction: kind === 'point' ? '单击确定中心点，拖动点位更新缓冲区。' : '左键添加顶点，双击结束；可拖动顶点更新缓冲区。',
    legend: [{ color: '#36df93', label: '拾取对象' }, { color: '#4169ff', label: '缓冲区' }],
    summarize: (data) => ({ title: '缓冲区面积', value: formatArea(data.area, data.unit), detail: '正向缓冲区', rows: [['缓冲距离', data.radius + ' ' + data.radiusUnit], ['区域数量', String(data.parts.length)]] }),
  }, `const radius = ${kind === 'point' ? '0.6' : '0.25'} // km，修改此值调整缓冲距离
scene.start('${methods[kind]}', (coordinates) => {
  const result = analysis.getBuffer(coordinates, radius, { type: '${types[kind]}', steps: 64 })
  scene.polygons('result', [result.geometry])
  scene.label(result.center, '缓冲区面积\\n' + areaText(result))
  scene.publish(result)
})`)
})
