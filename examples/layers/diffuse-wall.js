export default {
  id: 'diffuse-wall', name: 'DiffuseWallLayer', title: '扩散墙', group: '动态效果',
  summary: '以点位为中心展示环形扩散墙，可配置半径、墙高、扩散周期，以及扩散过程中的高度变化。',
  code: `const layer = new MapLayers.DiffuseWallLayer(viewer, {
  color: '#33cc66',
  opacity: 0.8,
  radius: 1000,       // 最大半径，米
  minRadius: 80,      // 起始半径，米
  height: 350,        // 初始墙高，米
  heightChange: false, // 是否随扩散降低墙高
  minHeight: 30,      // 开启高度变化时的最小墙高，米
  duration: 3000,     // 单次扩散周期，毫秒
  speed: 1,          // 播放倍速
  slices: 128,
  autoStart: true,
})

layer.setData([{
  geometry: { type: 'Point', coordinates: [125.834, 44.1475, 0] },
  properties: { id: 'jiutai-diffuse-wall', name: '九台扩散墙' },
}])

viewer.camera.flyToBoundingSphere(
  new Cesium.BoundingSphere(Cesium.Cartesian3.fromDegrees(125.834, 44.1475, 175), 1100),
  { duration: 0, offset: new Cesium.HeadingPitchRange(Cesium.Math.toRadians(25), Cesium.Math.toRadians(-32), 3800) },
)

// layer.setOptions({ heightChange: true })
// layer.stop(); layer.start() // 暂停 / 继续
return layer`,
}
