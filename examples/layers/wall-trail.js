export default {
  id: 'wall-trail', name: 'WallTrailLayer', title: '流动墙体', group: '动态效果',
  summary: '栅栏纹理沿墙体高度循环流动，支持配置颜色、透明度、高度、流动方向与速度。',
  code: `const layer = new MapLayers.WallTrailLayer(viewer, {
  color: '#33cc66',
  opacity: 0.7,
  height: 250,       // 墙高，米
  baseHeight: 0,     // 底部绝对高程，米
  speed: 3,
  direction: 'up',  // up / down
  repeat: 1,
  brightness: 3,
  autoStart: true,
})

layer.setData([{
  geometry: {
    type: 'Polygon',
    coordinates: [[
      [125.829, 44.1448], [125.839, 44.1448],
      [125.839, 44.1502], [125.829, 44.1502],
      [125.829, 44.1448],
    ]],
  },
  properties: { id: 'jiutai-trail-wall', name: '九台流动围墙' },
}])

viewer.camera.flyToBoundingSphere(
  new Cesium.BoundingSphere(Cesium.Cartesian3.fromDegrees(125.834, 44.1475, 125), 600),
  { duration: 0, offset: new Cesium.HeadingPitchRange(Cesium.Math.toRadians(25), Cesium.Math.toRadians(-30), 2100) },
)

// layer.setOptions({ color: '#00e7ff', speed: 5, direction: 'down' })
// layer.stop(); layer.start() // 暂停 / 继续
return layer`,
}
