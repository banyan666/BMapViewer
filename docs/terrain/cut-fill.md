# getCutFill 挖填方估算

传入区域和水平设计高程，计算地形高于设计面的挖方、低于设计面的填方。对跨基准面的三角形沿等高线裁剪后分别积分，不以整个三角形平均高差代替正负分区。

## 组件案例

<LayerExamplePreview category="terrain" example="cut-fill" title="挖填方估算" />

## 用法

```js
const baseHeight = 1400 // WGS84 椭球高，米
const result = await analysis.getCutFill(polygon, baseHeight, {
  areaUnit: 'km2', volumeUnit: 'm3', cellSize: 180,
})
```

| 返回字段 | 作用 |
| --- | --- |
| `baseHeight` | 输入的水平设计高程，米 |
| `cutVolume` | 挖方体积 |
| `fillVolume` | 填方体积 |
| `netVolume` | 挖方 − 填方；负值为净填方 |
| `volumeUnit` | `m3` / `km3` |
| `parts` | 裁剪后的分块，含 `kind: 'cut' / 'fill'`、投影 `area`、`volume` 和三维 `geometry` |

同时包含[地表面积](/terrain/surface-area)返回的网格、面积和高程统计。`parts[].area` 单位为 `result.unit`，`parts[].volume` 单位为 `volumeUnit`。

示例进入后等待 `pickPolygon` 绘制范围，参考本次绘制首个顶点的地形高程选择设计面，可在代码编辑器中修改 `baseHeight`。拖动顶点后重新计算，并通过 SDK 面图层更新挖填分区。体积为局部线性三角网近似积分，未考虑岩土系数、松方实方等工程条件，不可直接作为工程计量依据。见[总览](/analysis/terrain)。
