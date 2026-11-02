import floodExample from './flood.js'

const distance = (value, unit = 'km') => `${value.toFixed(3)} ${unit}`
const area = (value, unit) => `${value.toFixed(4)} ${{ m2: 'm²', km2: 'km²', ha: 'ha' }[unit]}`
const baseRows = (r) => [['采样点', String(r.sampleCount)], ['高程范围', `${r.minHeight?.toFixed(0)} – ${r.maxHeight?.toFixed(0)} m`]]
const common = { instruction: '单击拾取点位，线面双击结束后分析；拖拽控制点可更新结果，点击“重新绘制”清空并重新拾取。' }


const textLayer = `const labels = new MapLayers.TextGroupLayer(viewer, {
  fontSize: 14, color: '#ffde99', offset: [0, -26],
  showBackground: true, backgroundColor: 'rgba(7,20,28,0.92)',
  padding: [8, 5], maxWidth: 240, enableCollisionDetection: false,
})`
const lineLayer = "const lines = new MapLayers.LineGroupLayer(viewer, { width: 4, color: '#ffde99' })"
const polygonLayer = "const polygons = new MapLayers.PolygonPrimitiveLayer(viewer, { clampToGround: true, showOutline: false, opacity: 0.65 })"
const pathRender = `lines.setData([{
  geometry: { type: 'LineString', coordinates: result.geometry.coordinates.map(([lon, lat, height]) => [lon, lat, height + 4]) },
  properties: { id: 'path' },
}])
const last = result.samples.at(-1)
labels.setData([{
  geometry: { type: 'Point', coordinates: [...last.center, last.height + 6] },
  properties: { id: 'distance', text: '贴地距离 ' + result.totalDistance.toFixed(3) + ' ' + result.unit },
}])`

const snippets = {
  getElevation: {
    setup: textLayer, cleanup: 'labels.destroy()',
    calculate: 'const result = await analysis.getElevation(coordinates)',
    render: `labels.setData(result.samples.map((point, index) => ({
  geometry: { type: 'Point', coordinates: [...point.center, point.height + 6] },
  properties: { id: 'height-' + index, text: point.height.toFixed(1) + ' m' },
})))`,
  },
  getProfile: { setup: lineLayer + '\n' + textLayer, cleanup: 'lines.destroy(); labels.destroy()', calculate: 'const result = await analysis.getProfile(coordinates)', render: pathRender },
  getSurfaceDistance: { setup: lineLayer + '\n' + textLayer, cleanup: 'lines.destroy(); labels.destroy()', calculate: 'const result = await analysis.getSurfaceDistance(coordinates)', render: pathRender },
  getSurfaceArea: {
    setup: polygonLayer, cleanup: 'polygons.destroy()',
    calculate: 'const result = await analysis.getSurfaceArea(coordinates)',
    render: `polygons.setData(result.cells.map((cell) => ({
  geometry: cell.geometry,
  properties: { id: 'cell-' + cell.index, color: '#60d6c2' },
})))`,
  },
  getSlopeAspect: {
    setup: polygonLayer + '\n' + lineLayer, cleanup: 'polygons.destroy(); lines.destroy()',
    calculate: 'const result = await analysis.getSlopeAspect(coordinates)',
    render: `polygons.setData(result.cells.map((cell) => ({
  geometry: cell.geometry,
  properties: { id: 'slope-' + cell.index, color: cell.slope < 5 ? '#72d9a0' : cell.slope < 15 ? '#dae36e' : cell.slope < 30 ? '#f2b85c' : '#ed7063' },
})))
lines.setData(result.cells.filter((cell, index) => index % 32 === 0 && cell.aspect !== null).map((cell) => {
  const angle = cell.aspect * Math.PI / 180
  const start = [...cell.center, cell.height + 12]
  const end = [cell.center[0] + Math.sin(angle) * 0.0006, cell.center[1] + Math.cos(angle) * 0.00045, cell.height + 12]
  return { geometry: { type: 'LineString', coordinates: [start, end] }, properties: { id: 'aspect-' + cell.index, color: '#ffffff', type: 'arrow', width: 6 } }
}))`,
  },
  getVisibility: {
    setup: lineLayer + '\n' + textLayer, cleanup: 'lines.destroy(); labels.destroy()',
    calculate: `const result = await analysis.getVisibility(coordinates[0], coordinates.at(-1), {
  observerHeight: 20, targetHeight: 20, tolerance: 0.5,
})`,
    render: `const path = result.geometry.coordinates
const split = result.obstruction?.index
const segments = [{ coordinates: split == null ? path : path.slice(0, split + 1), color: '#58efad' }]
if (split != null) segments.push({ coordinates: path.slice(split), color: '#ff686b' })
lines.setData(segments.filter((part) => part.coordinates.length > 1).map((part, index) => ({
  geometry: { type: 'LineString', coordinates: part.coordinates },
  properties: { id: 'visibility-' + index, color: part.color },
})))
labels.setData([{
  geometry: { type: 'Point', coordinates: path.at(-1) },
  properties: { id: 'target', text: result.isVisible ? '目标可见' : '目标被地形遮挡', color: result.isVisible ? '#58efad' : '#ff686b' },
}])`,
  },
  getCutFill: {
    setup: polygonLayer, cleanup: 'polygons.destroy()',
    calculate: `// includeHeight 返回的首个顶点高程作为参考，可替换为设计高程（米）。
const baseHeight = Math.round(coordinates[0][2] / 10) * 10
const result = await analysis.getCutFill(coordinates, baseHeight)`,
    render: `polygons.setData(result.parts.map((part, index) => ({
  geometry: part.geometry,
  properties: { id: 'part-' + index, color: part.kind === 'cut' ? '#ff746c' : '#ffd27a' },
})))`,
  },
}

function example(metadata, pickMethod) {
  const snippet = snippets[metadata.name]
  return {
    ...common, ...metadata, pickMethod,
    code: `// 场景已加载 Cesium World Terrain；拾取后分析，不使用预置坐标。
const analysis = new TerrainAnalysis(viewer, {
  unit: 'km', areaUnit: 'km2', volumeUnit: 'm3',
  sampleSpacing: 80, cellSize: 260, maxSamples: 4096,
})
${snippet.setup}
const tools = new PickTools(viewer, {
  includeHeight: true, // 返回 [经度, 纬度, 高程米]，默认拾取地形
  isReserve: true, color: '#ffde99', fillOpacity: 0.08,
  mouseHints: { show: true, text: '单击拾取，线面双击结束' },
})

tools.${pickMethod}(async (coordinates) => {
${(snippet.calculate + '\n' + snippet.render + '\nonResult(result) // 打印返回数据并更新结果面板').split('\n').map((line) => '  ' + line).join('\n')}
})

return () => {
  tools.destroy()
  analysis.destroy()
  ${snippet.cleanup}
}`,
  }
}

export const terrainExamples = [
  example({ id: 'elevation', name: 'getElevation', title: '地形高程', summary: '使用 pickPoint 拾取点位，采样真实地形高程，并用文字图层标注。可拖动点位更新。', summarize: (r) => ({ title: '最高采样高程', value: `${r.maxHeight.toFixed(1)} m`, rows: baseRows(r) }) },
    'pickPoint'),
  example({ id: 'profile', name: 'getProfile', title: '地形剖面', summary: '使用 pickLine 绘制路径，沿线采样并通过线、文字图层与剖面图展示结果。', chart: true, summarize: (r) => ({ title: '路径高差', value: `${(r.maxHeight - r.minHeight).toFixed(1)} m`, rows: [...baseRows(r), ['累计爬升', `${r.ascent.toFixed(1)} m`], ['累计下降', `${r.descent.toFixed(1)} m`]] }) },
    'pickLine'),
  example({ id: 'surface-distance', name: 'getSurfaceDistance', title: '贴地距离', summary: '使用 pickLine 绘制路径，计算贴地距离，并用线与文字图层标注。', chart: true, summarize: (r) => ({ title: '贴地距离', value: distance(r.totalDistance, r.unit), rows: [['水平距离', distance(r.horizontalDistance, r.unit)], ['采样点', String(r.sampleCount)], ['采样间距', `${r.sampleSpacing} m`]] }) },
    'pickLine'),
  example({ id: 'surface-area', name: 'getSurfaceArea', title: '地表面积', summary: '使用 pickPolygon 绘制范围，计算地表面积，并通过贴地面图层展示分析区域。', summarize: (r) => ({ title: '地表面积', value: area(r.surfaceArea, r.unit), rows: [['水平投影面积', area(r.projectedArea, r.unit)], ...baseRows(r)] }) },
    'pickPolygon'),
  example({ id: 'slope-aspect', name: 'getSlopeAspect', title: '坡度坡向', summary: '使用 pickPolygon 绘制范围，面图层按坡度着色，箭头线图层指示下坡方向。', legend: '绿 <5° · 黄 <15° · 橙 <30° · 红 ≥30°；白箭头为下坡方向', summarize: (r) => ({ title: '平均坡度', value: `${r.averageSlope.toFixed(1)}°`, rows: [['最大坡度', `${r.maxSlope.toFixed(1)}°`], ['三角网', String(r.cells.length)], ...baseRows(r)] }) },
    'pickPolygon'),
  example({ id: 'visibility', name: 'getVisibility', title: '地形通视', summary: '使用 pickLine 绘制视线，取首尾两点计算地形通视，并通过线与文字图层展示。', instruction: '单击添加点、双击结束，使用路径首尾点进行通视分析；拖动端点可更新。', legend: '绿色 可见段 · 红色 遮挡后视线（地形以下的部分可能不可见）', summarize: (r) => ({ title: '地形通视结果', value: r.isVisible ? '可通视' : '存在遮挡', rows: [['视线距离', distance(r.distance, r.unit)], ['最小净空', `${r.minClearance.toFixed(1)} m`], ['观察点离地', `${r.observerHeight} m`], ['目标点离地', `${r.targetHeight} m`]] }) },
    'pickLine'),
  example({ id: 'cut-fill', name: 'getCutFill', title: '挖填方估算', summary: '使用 pickPolygon 绘制范围，按设计高程估算挖填方，并以红黄面图层显示分区。', legend: '红色 挖方 · 黄色 填方', summarize: (r) => ({ title: '净挖方（挖 − 填）', value: `${r.netVolume.toFixed(0)} m³`, rows: [['挖方', `${r.cutVolume.toFixed(0)} m³`], ['填方', `${r.fillVolume.toFixed(0)} m³`], ['设计高程', `${r.baseHeight.toFixed(1)} m`], ['采样点', String(r.sampleCount)]] }) },
    'pickPolygon'),
  floodExample,
]
