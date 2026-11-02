export default {
  id: 'circle-blur', name: 'CircleBlurLayer', title: '模糊圆', group: '线面图层',
  summary: '以柔和渐变展示点位覆盖范围，可配置颜色、半径、透明度及呼吸效果。',
  code: `const layer = new MapLayers.CircleBlurLayer(viewer, {
  color: '#f10e14',
  opacity: 1,
  radius: 1500,     // 半径，米
  height: 0,
  blur: 10,        // 边缘衰减指数
  brightness: 3,
  breathing: false, // 是否开启呼吸效果
  speed: 3,        // 呼吸速度
})

layer.setData([{
  geometry: { type: 'Point', coordinates: [125.834, 44.1475] },
  properties: { id: 'jiutai-blur-circle', name: '九台模糊圆',radius: 2500 },
},
{
  geometry: { type: 'Point', coordinates: [125.855, 44.1496] },
  properties: { id: 'jiutai-blur-circle-2', name: '九台模糊圆2',color: '#ff9100' },
}])

viewer.camera.flyToBoundingSphere(
  new Cesium.BoundingSphere(Cesium.Cartesian3.fromDegrees(125.834, 44.1475, 0), 1500),
  { duration: 0, offset: new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-60), 4800) },
)

// layer.setOptions({ breathing: true, speed: 3 })
// layer.stop(); layer.start() // 暂停 / 继续呼吸
return layer`,
}
