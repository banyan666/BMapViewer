export default {
  id: 'circle-area-pick',
  name: 'getCircleArea',
  title: '圆面积分析',
  resultType: 'circle-area',
  kicker: 'CIRCLE AREA ANALYSIS',
  guide: '第一次单击确定圆心，第二次单击确定半径。拖动圆心或边缘控制点可更新圆和分析结果。',
  summary: '使用 pickCircle 拾取圆心和半径，计算圆面积、周长及直径，并在地图中标注结果。',
  instruction: '左键确定圆心，再次单击确定半径；完成后可拖动圆心或边缘控制点。',
  interactive: true,
  code: `const analysis = new SpatialAnalysis({
  unit: 'km', // 与 PickTools 的 unit 保持一致
  areaUnit: 'km2', // 面积单位：m2 / km2 / ha
})
const entitySnapshot = new Set(viewer.entities.values)
const labels = new MapLayers.TextGroupLayer(viewer, {
  fontSize: 16,
  color: '#e9ffdc',
  showBackground: true,
  backgroundColor: 'rgba(6, 26, 31, 0.94)',
  padding: [12, 8],
  maxWidth: 250,
  overflowMode: 'wrap',
  offset: [0, -64],
  enableCollisionDetection: false,
})

function renderCircle({ center, radius }) {
  try {
    const result = analysis.getCircleArea(center, radius)
    const areaUnits = { m2: 'm²', km2: 'km²', ha: 'ha' }
    const areaText = result.area.toFixed(result.unit === 'm2' ? 2 : 4) + ' ' + areaUnits[result.unit]
    const radiusText = result.radius.toFixed(result.radiusUnit === 'km' ? 3 : 2) + ' ' + result.radiusUnit
    const perimeterText = result.perimeter.toFixed(result.perimeterUnit === 'km' ? 3 : 2) + ' ' + result.perimeterUnit
    labels.setData([{
      geometry: { type: 'Point', coordinates: result.center },
      properties: {
        id: 'circle-area-result',
        text: '面积  ' + areaText + '\\n半径  ' + radiusText + '\\n周长  ' + perimeterText,
      },
    }])
    console.log('SpatialAnalysis.getCircleArea 返回结果：', result)
    onResult(result)
    viewer.scene.requestRender()
  } catch (error) {
    labels.clearLayer()
    onError(error)
  }
}

const tools = new PickTools(viewer, {
  unit: 'km', // 拾取半径直接返回 km，传给 getCircleArea 无需换算
  color: '#a3d68a',
  lineWidth: 3,
  pointSize: 10,
  fillOpacity: 0.22,
  isReserve: true,
  mouseHints: { show: true, text: '单击确定圆心，再次单击确定半径' },
})

// 拾取完成或控制点编辑结束后，计算并更新圆面积。
tools.pickCircle(renderCircle)

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
