export default {
  id: 'distance-pick',
  name: 'getDistance',
  title: '距离分析',
  resultType: 'distance',
  summary: '使用 PickTools 连续拾取折点，完成绘线后显示各段距离和总距离，拖动节点可重新分析。',
  instruction: '左键添加折点，双击结束；完成后可拖拽节点，点击“重新绘制”测量新路径。',
  interactive: true,
  code: `const analysis = new SpatialAnalysis({ unit: 'km' })
const entitySnapshot = new Set(viewer.entities.values)
const labels = new MapLayers.TextGroupLayer(viewer, {
  fontSize: 15,
  color: '#e9ffdc',
  showBackground: true,
  backgroundColor: 'rgba(6, 26, 31, 0.9)',
  padding: [10, 6],
  offset: [0, -18],
  enableCollisionDetection: false,
})
const totalLabel = new MapLayers.TextGroupLayer(viewer, {
  fontSize: 17,
  color: '#baf38f',
  showBackground: true,
  backgroundColor: 'rgba(6, 26, 31, 0.95)',
  padding: [12, 8],
  offset: [0, -52],
  enableCollisionDetection: false,
})

function renderDistance(coordinates) {
  const result = analysis.getDistance(coordinates)
  console.log('SpatialAnalysis.getDistance 返回结果：', result)
  const format = (value) => value.toFixed(result.unit === 'km' ? 3 : 2) + ' ' + result.unit
  labels.setData(result.segments.map((segment) => ({
    geometry: { type: 'Point', coordinates: segment.center },
    properties: {
      id: 'distance-segment-' + segment.index,
      text: '第 ' + (segment.index + 1) + ' 段  ' + format(segment.distance),
    },
  })))
  totalLabel.setData([{
    geometry: { type: 'Point', coordinates: result.segments.at(-1).end },
    properties: { id: 'distance-total', text: '总距离  ' + format(result.totalDistance) },
  }])
  onResult(result)
  viewer.scene.requestRender()
}

const tools = new PickTools(viewer, {
  color: '#a3d68a',
  lineWidth: 4,
  pointSize: 10,
  isReserve: true,
  mouseHints: { show: true, text: '左键添加测量点，双击结束' },
})

// 绘制完成和拖拽节点结束后，都会重新计算距离。
tools.pickLine(renderDistance)

// 重新运行或离开示例时清理图层和拾取资源。
return () => {
  tools.destroy()
  labels.destroy()
  totalLabel.destroy()
  if (!viewer.isDestroyed()) {
    viewer.entities.values
      .filter((entity) => !entitySnapshot.has(entity))
      .forEach((entity) => viewer.entities.remove(entity))
  }
}`,
}
