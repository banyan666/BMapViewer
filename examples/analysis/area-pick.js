export default {
  id: 'area-pick',
  name: 'getArea',
  title: '面积分析',
  resultType: 'area',
  kicker: 'AREA ANALYSIS',
  guide: '至少三个顶点构成区域，自动闭合边界。面积和周长标记在区域中心。',
  summary: '使用 pickPolygon 拾取多边形，计算区域面积、周长及中心点，拖动顶点可更新结果。',
  instruction: '左键添加顶点，双击结束；至少三个点，边界不能交叉，完成后可拖拽顶点。',
  interactive: true,
  code: `const analysis = new SpatialAnalysis({
  unit: 'km', // 周长单位：m / km
  areaUnit: 'km2', // 面积单位：m2 / km2 / ha
})
const entitySnapshot = new Set(viewer.entities.values)
const labels = new MapLayers.TextGroupLayer(viewer, {
  fontSize: 16,
  color: '#e9ffdc',
  showBackground: true,
  backgroundColor: 'rgba(6, 26, 31, 0.94)',
  padding: [12, 8],
  maxWidth: 230,
  overflowMode: 'wrap',
  offset: [0, -16],
  enableCollisionDetection: false,
})

function renderArea(coordinates) {
  try {
    const result = analysis.getArea(coordinates)
    const areaUnits = { m2: 'm²', km2: 'km²', ha: 'ha' }
    const areaText = result.area.toFixed(result.unit === 'm2' ? 2 : 4) + ' ' + areaUnits[result.unit]
    const perimeterText = result.perimeter.toFixed(result.perimeterUnit === 'km' ? 3 : 2) + ' ' + result.perimeterUnit
    labels.setData([{
      geometry: { type: 'Point', coordinates: result.center },
      properties: {
        id: 'area-result',
        text: '面积  ' + areaText + '\\n周长  ' + perimeterText,
      },
    }])
    console.log('SpatialAnalysis.getArea 返回结果：', result)
    onResult(result)
    viewer.scene.requestRender()
  } catch (error) {
    labels.clearLayer()
    onError(error)
  }
}

const tools = new PickTools(viewer, {
  color: '#a3d68a',
  lineWidth: 3,
  pointSize: 10,
  isReserve: true,
  mouseHints: { show: true, text: '左键添加顶点，双击结束面积分析' },
})

// 拾取完成或顶点编辑结束后，计算并更新面积和周长。
tools.pickPolygon(renderArea)

return () => {
  tools.destroy()
  labels.destroy()
  if (!viewer.isDestroyed()) {
    viewer.entities.values
      .filter((entity) => !entitySnapshot.has(entity))
      .forEach((entity) => viewer.entities.remove(entity))
  }
}`,
}
