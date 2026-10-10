export default {
  id: 'icon-cluster',
  name: 'IconClusterLayer',
  title: '图标聚合',
  group: '点位标注',
  summary: '聚合后显示对应图标与统计文字，支持调整文字方向、拼接内容和显隐。',
  code: `const markerSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="42" height="52" viewBox="0 0 42 52"><path fill="#31c8ff" stroke="#d9f8ff" stroke-width="2" d="M21 1C10 1 1 10 1 21c0 14.8 20 30 20 30s20-15.2 20-30C41 10 32 1 21 1Z"/><circle cx="21" cy="20" r="7" fill="#07384e"/></svg>'
function createMarkerIcon(color) {
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(markerSvg.replace('#31c8ff', color))
}
const markerUrl = createMarkerIcon('#31c8ff')

const layer = new MapLayers.IconClusterLayer(viewer, {
  icon: markerUrl,
  width: 30,
  height: 38,
  pixelRange: 72,
  minimumClusterSize: 2,
  clusterShowText: true,
  clusterText: '{count} 台', // 可拼接文字，例如 '共 {count} 台设备'
  clusterTextPosition: 'top', // top / bottom / left / right
  clusterTextGap: 6,
  clusterFontSize: 14,
  clusterStyles: [
    { min: 2, icon: markerUrl, width: 34, height: 42, showText: true },
    { min: 15, icon: createMarkerIcon('#43b86a'), width: 38, height: 48 },
    { min: 50, icon: createMarkerIcon('#f3b94f'), width: 42, height: 52 },
    { min: 120, icon: createMarkerIcon('#f56c6c'), width: 46, height: 58 },
    // 不传 icon 时显示数字圆标，例如 { min: 2, size: 34, color: '#1c86d1dd' }
    //{ min: 2, size: 34, color: '#1c86d1dd' },
    //{ min: 15, size: 40, color: '#43b86add' },
    //{ min: 50, size: 46, color: '#f3b94fdd' },
    //{ min: 120, size: 52, color: '#f56c6cdd' }
  ]
})

const center = [125.834, 44.147]
const points = Array.from({ length: 320 }, (_, index) => {
  const angle = index * 2.3999632297
  const radius = 0.004 + (index % 80) / 80 * 0.105
  return {
    geometry: {
      type: 'Point',
      coordinates: [
        center[0] + Math.cos(angle) * radius,
        center[1] + Math.sin(angle) * radius * 0.62
      ]
    },
    properties: {
      id: 'device-' + index,
      name: '监测设备 ' + String(index + 1).padStart(3, '0')
    }
  }
})

layer.setData(points)
return layer`,
}
