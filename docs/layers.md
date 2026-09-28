# 图层模块

通过 `MapLayers` 访问内置图层：

```js
import { MapLayers } from 'b-map-viewer'
```

当前图层按用途分为以下几类：

| 分类 | 图层 |
| --- | --- |
| 点位与标注 | `IconGroupLayer`、`IconClusterLayer`、`LabelGroupLayer`、`TextGroupLayer`、`BubbleLayer`、`BubbleGroupLayer` |
| 线与面 | `LineGroupLayer`、`LinePrimitiveLayer`、`LineMaterialLayer`、`PolygonPrimitiveLayer`、`CircleGroupLayer`、`MaskLayer` |
| 动态效果 | `CircleWaveLayer`、`CircleExplosionLayer`、`PointRippleLayer` |
| 三维场景 | `Build3DLayer`、`GradientWallLayer`、`DynamicWaterLayer`、`Heatmap3DLayer`、`RadarScanner3DLayer` |
| 专题分析 | `HeatmapLayer`、`HeatmapPrimitiveLayer` |

图层构造函数的第一个参数统一为 `Cesium.Viewer`。多数图层提供 `setData`、`show`、`hide`、`clearLayer` 或 `destroy` 中的一组生命周期方法，具体以对应源码为准。

## CircleGroupLayer 示例

```js
const layer = new MapLayers.CircleGroupLayer(viewer, {
  radius: 300,
  fillColor: '#37d6ff',
  opacity: 0.65,
})

layer.setData([
  {
    geometry: { coordinates: [125.8337, 44.1471, 0] },
    properties: { id: 'point-1' },
  },
])

// 页面销毁时
layer.destroy()
```

底图不属于业务图层，统一由独立的 [`BaseMaps` 底图模块](/base-maps) 管理。
