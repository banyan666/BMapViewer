export default {
  id: 'flow-line',
  name: 'FlowLineLayer',
  title: '流动线',
  group: '线面图层',
  summary: '加载 public/jiutailine.json 九台路网，以蓝色渐变光段展示道路流向。',
  // baseMap: {
  //   type: 'arcgis',
  //   maximumLevel: 18,
  // },
  camera: {
    longitude: 125.8337,
    latitude: 44.1471,
    height: 9000,
    pitch: -48,
  },
  code: `const colors = ['#0080ff', '#00b3ff', '#1a99e6', '#3380cc']

const layer = new MapLayers.FlowLineLayer(viewer, {
  type: 'flow', // flow / enhanced
  color: colors[1],
  width: 3,
  height: 6,
  opacity: 0.95,
  speed: 5,
  percent: 0.18,
  gradient: 0.6,
  backgroundAlpha: 0.8,
  brightness: 1.15,
  glowStrength: 2,
  glowColor: '#00e7ff'
})

// 读取当前站点 public 目录的本地路网，兼容开发和部署路径。
const response = await fetch(new URL('jiutailine.json', window.location.href))
if (!response.ok) throw new Error('九台路网加载失败：' + response.status)
const geojson = await response.json()

const arterialClasses = ['motorway', 'trunk', 'primary', 'secondary']
const features = geojson.features
  .filter((feature) => ['LineString', 'MultiLineString'].includes(feature.geometry?.type))
  .map((feature, index) => {
    const properties = feature.properties || {}
    const arterial = arterialClasses.includes(properties.fclass)
    return {
      geometry: feature.geometry,
      properties: {
        ...properties,
        id: 'jiutai-road-' + index,
        name: properties.name || '九台道路 ' + (index + 1),
        color: arterial ? colors[1] : colors[index % colors.length],
        width: arterial ? 4 : 2.5,
        speed: 4 + index % 3
      }
    }
  })

layer.setData(features)

return layer`,
}
