export default {
  id: 'flood', name: 'getFlood', title: '动态淹没分析', pickMethod: 'pickPolygon', flood: true,
  summary: '绘制范围后，用 FloodLayer 展示连续升降的水体；地形只采样一次，随水位更新面积与体积。',
  instruction: '单击绘制范围、双击结束；可拖动顶点重新分析，或用水位面板控制上升、下降与暂停。',
  legend: '蓝色 等水位水体 · 地形遮挡水下部分 · 非水动力模拟',
  summarize: (r) => ({ title: '当前淹没占比', value: `${(r.floodedRatio * 100).toFixed(1)}%`, rows: [
    ['淹没面积', `${r.floodedArea.toFixed(4)} ${{ m2: 'm²', km2: 'km²', ha: 'ha' }[r.unit]}`],
    ['水体体积', `${r.volume.toFixed(0)} ${r.volumeUnit === 'km3' ? 'km³' : 'm³'}`],
    ['采样点', String(r.sampleCount)],
  ] }),
  code: `// 场景已加载 Cesium World Terrain，并开启地形深度检测。
const analysis = new TerrainAnalysis(viewer, {
  areaUnit: 'km2', volumeUnit: 'm3', cellSize: 260, maxSamples: 4096,
})
let prepared = null
const water = new MapLayers.FloodLayer(viewer, {
  color: '#409dfd', opacity: 0.65, speed: 20, direction: 'up',
  callbackInterval: 250, // 水面逐帧升降，统计回调每 250 ms 更新一次
  onChange(height) {
    if (prepared) onResult(prepared.getFlood(height))
  },
})
const tools = new PickTools(viewer, {
  includeHeight: true, isReserve: true, color: '#ffde99', fillOpacity: 0.08,
  mouseHints: { show: true, text: '单击绘制淹没范围，双击结束' },
})

tools.pickPolygon(async (coordinates) => {
  water.clearLayer()
  prepared = null
  prepared = await analysis.prepareFlood(coordinates) // 只采样一次
  const startHeight = Math.floor(prepared.minHeight)
  const targetHeight = Math.ceil(prepared.minHeight + Math.max(80, (prepared.maxHeight - prepared.minHeight) * 0.65))
  water.setOptions({ startHeight, targetHeight, baseHeight: startHeight - 10 })
  water.setData([{
    geometry: prepared.geometry,
    properties: { id: 'flood-region', name: '拾取的淹没区域' },
  }])
  water.start() // pause 暂停；start 继续；reset 回到起始水位
})

return () => {
  water.destroy()
  tools.destroy()
  analysis.destroy()
}`,
}
