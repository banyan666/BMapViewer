export const formatArea = (value, unit) => `${value.toFixed(unit === 'm2' ? 2 : 4)} ${{ m2: 'm²', km2: 'km²', ha: 'ha' }[unit]}`
export const formatDistance = (value, unit) => `${value.toFixed(unit === 'km' ? 3 : 2)} ${unit}`

export const AREA = [[125.800, 44.135], [125.800, 44.165], [125.839, 44.165], [125.839, 44.135]]
export const ROUTE = [[125.790, 44.142], [125.810, 44.160], [125.833, 44.146], [125.856, 44.162]]

const helpers = `// 下方为示例图层辅助函数，可直接修改颜色、标注及清理逻辑。
function createScene() {
  const snapshot = new Set(viewer.entities.values)
  const polygons = new Map()
  const lines = new MapLayers.LineGroupLayer(viewer, { width: 5, height: 25 })
  const markers = new MapLayers.TextGroupLayer(viewer, {
    fontSize: 24, enableCollisionDetection: false, offset: [0, 0],
  })
  const labels = new MapLayers.TextGroupLayer(viewer, {
    fontSize: 15, color: '#ffffff', showBackground: true,
    backgroundColor: 'rgba(6,26,31,0.94)', padding: [12,8],
    maxWidth: 270, overflowMode: 'wrap', offset: [0,-35], enableCollisionDetection: false,
  })
  let tools = null
  let disposed = false
  let pointItems = []
  const scene = {
    polygons(key, geometries, color = '#4169ff', opacity = 0.65, height = 12) {
      if (!polygons.has(key)) polygons.set(key, new MapLayers.PolygonPrimitiveLayer(viewer, { color, opacity, height, lineWidth: 2 }))
      const layer = polygons.get(key)
      const data = geometries.filter(Boolean).map((geometry, index) => ({ geometry, properties: { id: key + '-' + index } }))
      if (data.length) layer.setData(data)
      else layer.clearLayer()
    },
    lines(items) { lines.setData(items) },
    points(items, indices = []) {
      pointItems = items
      const selected = new Set(indices)
      markers.setData(items.map((item, index) => ({
        geometry: item.geometry,
        properties: { id: 'point-' + index, text: '●', color: selected.has(index) ? '#6dffb1' : '#ffb454' },
      })))
    },
    label(center, text) {
      labels.setData(center ? [{ geometry: { type: 'Point', coordinates: center }, properties: { id: 'result-label', text } }] : [])
    },
    start(method, callback, config = {}) {
      if (disposed) return
      tools?.destroy()
      tools = new PickTools(viewer, {
        unit: 'km', color: '#36df93', pointSize: 10, lineWidth: 3, isReserve: true,
        mouseHints: { show: true, text: '单击拾取；线面双击结束' }, ...config,
      })
      tools[method]((data) => {
        if (disposed) return
        try { callback(data) } catch (error) {
          scene.polygons('result', [])
          scene.label(null, '')
          scene.lines([])
          if (pointItems.length) scene.points(pointItems)
          onError(error)
        }
      })
    },
    publish(result) {
      console.log('SpatialAnalysis.' + methodName + ' 返回结果：', result)
      onResult(result)
      viewer.scene.requestRender()
    },
    destroy() {
      if (disposed) return
      disposed = true
      tools?.destroy()
      polygons.forEach((layer) => layer.destroy())
      lines.destroy(); markers.destroy(); labels.destroy()
      if (!viewer.isDestroyed()) viewer.entities.values.filter((entity) => !snapshot.has(entity)).forEach((entity) => viewer.entities.remove(entity))
    },
  }
  return scene
}

function samplePoints() {
  return Array.from({ length: 30 }, (_, index) => ({
    geometry: { type: 'Point', coordinates: [125.794 + (index % 6) * 0.010, 44.132 + Math.floor(index / 6) * 0.008] },
    properties: { id: 'site-' + index, name: '监测点 ' + (index + 1), value: 10 + index },
  }))
}

function lineData(geometry, color, id = 'line') {
  if (!geometry) return []
  const coordinates = geometry.type === 'MultiLineString' ? geometry.coordinates : [geometry.coordinates]
  return coordinates.map((coords, index) => ({ geometry: { type: 'LineString', coordinates: coords }, properties: { id: id + '-' + index, color } }))
}
function areaText(result) { return result.area.toFixed(4) + ' ' + ({m2:'m²',km2:'km²',ha:'ha'})[result.unit] }
function distanceText(value, unit) { return value.toFixed(unit === 'km' ? 3 : 2) + ' ' + unit }
`

export function spatialExample(metadata, code) {
  return {
    resultType: 'spatial', kicker: 'SPATIAL ANALYSIS', interactive: true,
    guide: '在地图上拾取后自动分析；可展开代码修改参数，查看返回数据。切换案例或重新运行会清理本例资源。',
    resultUnitLabel: metadata.area ? 'm² / km² / ha' : metadata.name === 'getPointsInPolygon' ? 'WGS84' : 'm / km',
    ...metadata,
    code: `const methodName = '${metadata.name}'\nconst analysis = new SpatialAnalysis({ unit: 'km', areaUnit: 'km2' })\nconst scene = createScene()\n\n${code}\n\nreturn () => scene.destroy()\n\n${helpers}`,
  }
}
