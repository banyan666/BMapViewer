export default {
  id: 'overlap-area-pick',
  name: 'getOverlapArea',
  title: '面积叠加分析',
  resultType: 'overlap-area',
  kicker: 'AREA OVERLAP ANALYSIS',
  guide: '红色为默认区域，绿色为拾取区域，蓝色为交叠部分。双击结束后分析，拖动顶点可更新交集。',
  summary: '使用 pickPolygon 绘制第二个多边形，计算与默认区域的重叠面积，绘制交集并返回 GeoJSON 几何。',
  instruction: '在红色区域附近左键添加顶点，双击结束；拖拽顶点更新交集，重新绘制可清空上次结果。',
  interactive: true,
  legend: [
    { color: '#ef534b', label: '默认区域' },
    { color: '#36df93', label: '拾取区域' },
    { color: '#4169ff', label: '交叠部分' },
  ],
  code: `const analysis = new SpatialAnalysis({ areaUnit: 'km2' })
const entitySnapshot = new Set(viewer.entities.values)
const defaultCoordinates = [
  [125.795, 44.142], [125.800, 44.164], [125.816, 44.175],
  [125.835, 44.165], [125.836, 44.142],
]
const defaultArea = analysis.getArea(defaultCoordinates)
const baseLayer = new MapLayers.PolygonPrimitiveLayer(viewer, {
  color: '#ef534b', opacity: 0.4, lineWidth: 2, height: 2,
})
const overlapLayer = new MapLayers.PolygonPrimitiveLayer(viewer, {
  color: '#4169ff', opacity: 0.85, lineWidth: 3, height: 12,
})
const labels = new MapLayers.TextGroupLayer(viewer, {
  fontSize: 16,
  color: '#ffffff',
  showBackground: true,
  backgroundColor: 'rgba(6, 26, 31, 0.92)',
  padding: [12, 8], maxWidth: 260, overflowMode: 'wrap',
  offset: [0, -24], enableCollisionDetection: false,
})

baseLayer.setData([{
  geometry: { type: 'Polygon', coordinates: [defaultArea.coordinates] },
  properties: { id: 'overlap-default-area', name: '默认区域' },
}])

function renderOverlap(coordinates) {
  try {
    const result = analysis.getOverlapArea(defaultCoordinates, coordinates)
    // geometry 可能是 Polygon 或 MultiPolygon，可直接传入 SDK 面图层。
    if (result.hasOverlap) {
      overlapLayer.setData([{
        geometry: result.geometry,
        properties: { id: 'overlap-intersection', name: '交叠部分' },
      }])
      const areaUnits = { m2: 'm²', km2: 'km²', ha: 'ha' }
      labels.setData(result.parts.map((part, index) => ({
        geometry: { type: 'Point', coordinates: part.center },
        properties: {
          id: 'overlap-label-' + index,
          text: '交叠部分' + (result.parts.length > 1 ? ' ' + (index + 1) : '')
            + '\\n' + part.area.toFixed(result.unit === 'm2' ? 2 : 4) + ' ' + areaUnits[result.unit],
        },
      })))
    } else {
      overlapLayer.clearLayer()
      labels.setData([{
        geometry: { type: 'Point', coordinates: analysis.getArea(coordinates).center },
        properties: { id: 'overlap-empty', text: '未检测到重叠面积' },
      }])
    }
    console.log('SpatialAnalysis.getOverlapArea 返回结果：', result)
    onResult(result)
    viewer.scene.requestRender()
  } catch (error) {
    overlapLayer.clearLayer()
    labels.clearLayer()
    onError(error)
  }
}

const tools = new PickTools(viewer, {
  color: '#36df93', lineWidth: 3, pointSize: 10, isReserve: true,
  mouseHints: { show: true, text: '绘制绿色区域，双击结束叠加分析' },
})
tools.pickPolygon(renderOverlap)

return () => {
  tools.destroy()
  overlapLayer.destroy()
  baseLayer.destroy()
  labels.destroy()
  if (!viewer.isDestroyed()) {
    viewer.entities.values
      .filter((entity) => !entitySnapshot.has(entity))
      .forEach((entity) => viewer.entities.remove(entity))
  }
}`,
}
