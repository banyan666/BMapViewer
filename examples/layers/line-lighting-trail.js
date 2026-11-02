export default {
  id: 'line-lighting-trail', name: 'LineLightingTrailLayer', title: '穿梭线', group: '线面图层',
  summary: '沿折线路径展示高亮线芯与流动光晕，支持颜色、线宽、速度和方向配置。',
  code: `const layer = new MapLayers.LineLightingTrailLayer(viewer, {
  color: '#ffcc33',
  opacity: 0.8,
  width: 20,         // 线宽，像素
  speed: 5,
  direction: 'forward', // forward / reverse
  height: 20,        // 二维坐标的默认高程，米
  clampToGround: false,
  autoStart: true,
})

layer.setData([{
  geometry: {
    type: 'LineString',
    coordinates: [
      [125.789, 44.122],
      [125.831, 44.165],
      [125.884, 44.149],
    ],
  },
  properties: { id: 'jiutai-lighting-trail', name: '九台穿梭线' },
}])

viewer.camera.flyToBoundingSphere(
  new Cesium.BoundingSphere(Cesium.Cartesian3.fromDegrees(125.8365, 44.1435, 0), 4500),
  { duration: 0, offset: new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-65), 14000) },
)

// layer.setOptions({ direction: 'reverse', speed: 8, color: '#00e7ff' })
// layer.stop(); layer.start() // 暂停 / 继续
return layer`,
}
