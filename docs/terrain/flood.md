# getFlood 动态淹没分析

`TerrainAnalysis` 负责计算水位以下的面积、体积和淹没比例，`MapLayers.FloodLayer` 负责连续升降的立体水体。水体采用完整区域的等水位面，由真实地形深度检测遮挡水下部分，不再用 `PolygonPrimitiveLayer` 拼接淹没分块。

示例使用 Cesium World Terrain。进入后通过 `pickPolygon` 绘制范围，不预先分析默认区域；绘制完成后只采样一次地形，按区域最低高程设置起始水位并开始上升。可在面板调整起始水位、目标水位、速度及升降方向，也可暂停、继续、复位或清除。拖动顶点会停止旧水体并重新采样。

## 组件案例

<LayerExamplePreview category="terrain" example="flood" title="动态淹没分析" :height="650" :mobile-height="650" />

## 单次水位分析

```js
const result = await analysis.getFlood(polygon, 1450, {
  areaUnit: 'km2', volumeUnit: 'm3', cellSize: 180,
})
```

## 动态水位与复用地形

`prepareFlood(polygon, options?)` 返回 Promise，完成一次地形采样后，返回 `minHeight`、`maxHeight`、`geometry` 及同步方法 `getFlood(waterHeight)`。后续只计算水位，不重复请求地形。范围、地形服务或采样配置改变后，应重新调用 `prepareFlood`。

```js
const analysis = new TerrainAnalysis(viewer, {
  areaUnit: 'km2', volumeUnit: 'm3', cellSize: 260,
})
const tools = new PickTools(viewer, { includeHeight: true, isReserve: true })
let prepared = null
const water = new MapLayers.FloodLayer(viewer, {
  speed: 20, direction: 'up', color: '#409dfd', opacity: 0.65,
  callbackInterval: 250,
  onChange(height) {
    if (prepared) console.log(prepared.getFlood(height))
  },
})

tools.pickPolygon(async (coordinates) => {
  water.clearLayer()
  prepared = await analysis.prepareFlood(coordinates)
  const startHeight = Math.floor(prepared.minHeight)
  water.setOptions({ startHeight, targetHeight: startHeight + 100, baseHeight: startHeight - 10 })
  water.setData([{ geometry: prepared.geometry, properties: { id: 'flood-region' } }])
  water.start()
})

// water.pause(); water.start(); water.reset(); water.clearLayer()
// 退出页面时：water.destroy(); tools.destroy(); analysis.destroy()
```

场景须开启 `viewer.scene.globe.depthTestAgainstTerrain = true`；使用 `BaseMaps.CesiumTerrain` 时可通过同名配置开启。上面的独立接入示例未包含业务侧异步取消管理：频繁重绘时可向 `prepareFlood` 传入 `signal` 取消上一轮采样；示例工作台已自动处理。

所有水位和速度分别为**椭球高米**、**米/秒**，不是离地高度。水位回调默认节流，避免每帧计算统计结果；水体本身逐帧变化。`prepareFlood` 的采样超时不限制后续动画时长；取消其 `signal` 或销毁分析实例后，已准备的计算器不再可用。

## 返回数据

| 返回字段 | 作用 |
| --- | --- |
| `waterHeight` | 水位椭球高，米 |
| `floodedArea` / `dryArea` | 淹没 / 未淹没水平投影面积，单位 `unit` |
| `floodedRatio` | 淹没占比，0～1 |
| `volume` / `volumeUnit` | 地形到等水位面的体积及单位 |
| `floodedParts` | 水位以下裁剪分块，含面积、体积和处于水位高程的三维 Polygon |

同时包含[地表面积](/terrain/surface-area)的网格统计。没有淹没时 `floodedParts` 为空、面积和体积为零。

动画展示连续变化的水位，统计值仍是各水位下的等水位估算，**不考虑低洼区域连通性、河道来源、堤坝、入流、降雨或流速**，不能代替水动力模拟或防洪决策。水体显示使用当前地形精细度，统计使用采样三角网，两者边缘可能存在采样误差。水体配置见 [FloodLayer](/layers/flood)，分析精度见[三维分析总览](/analysis/terrain)。
