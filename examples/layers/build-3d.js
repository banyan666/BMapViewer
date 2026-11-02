export default {
  id: 'build-3d',
  name: 'Build3DLayer',
  title: '三维建筑',
  group: '三维场景',
  baseMap: { type: 'arcgis', url: 'https://server.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer', maximumLevel: 23 },
  summary: '高度渐变，扫光默认关闭；左键修改建筑顶部颜色，右键恢复全部建筑颜色。',
  code: `const layer = new MapLayers.Build3DLayer(viewer, {
  url: buildingTilesetUrl,
  name: '园区三维建筑',
  featureIdProperty: 'id',
  shader: {
    enabled: true,
    gradientEnabled: true,
    sweepEnabled: true,
    minColor: '#09090e',
    maxColor: '#0080ff',
    sweepColor: '#2ba7ff',
    modelHeight: 100,
    heightOffset: 0,
    sweepWidth: 0.02,
    speed: 2,
    active: true
  }
})

const tileset = await layer.load()

// 按建筑标识修改渐变的 maxColor，保留 minColor 和扫光配置。
// 也可在加载前调用 setFeatureColors([{ id, color }])。
const colorsList=[{id:18332,color:'#f80c0c'},{id:13581,color:'#fdc502'},{id:7323,color:'#8c02fd'}]
colorsList.forEach(item => layer.setFeatureColor(item.id, item.color))


// layer.setShader({ sweepEnabled: true })  // 开启扫光，改色建筑同样参与扫光
// layer.setShader(false)                  // 关闭全部着色效果
viewer.camera.flyToBoundingSphere(
  new Cesium.BoundingSphere(Cesium.Cartesian3.fromDegrees(125.83824, 44.14448, 0), 0),
  {
    duration: 1.2,
    offset: new Cesium.HeadingPitchRange(
      Cesium.Math.toRadians(20),
      Cesium.Math.toRadians(-28),
      6000
    )
  },
)
return () => {
  handler.destroy()
  layer.destroy()
}`,
}
