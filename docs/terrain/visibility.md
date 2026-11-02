# getVisibility 地形通视

采样观察点、目标点地形高程，加上各自离地高度后，在 ECEF 空间建立三维直线，并沿该视线采样地形净空。直线包含地球曲率影响。

## 组件案例

<LayerExamplePreview category="terrain" example="visibility" title="地形通视" />

## 用法

```js
const result = await analysis.getVisibility([117.914, 43.783], [117.945, 43.791], {
  unit: 'km', sampleSpacing: 40,
  observerHeight: 20, targetHeight: 20, tolerance: 0.5,
})
```

| 选项 | 默认值 | 作用 |
| --- | --- | --- |
| `observerHeight` | `2` | 观察点相对地形的离地高度，米 |
| `targetHeight` | `2` | 目标点相对地形的离地高度，米 |
| `tolerance` | `0.5` | 净空负值允许误差，米，非负 |

| 返回字段 | 作用 |
| --- | --- |
| `isVisible` | 所有内部采样点均未被地形遮挡时为 `true` |
| `obstruction` | 首个被遮挡的采样点，未遮挡时为 `null` |
| `minClearance` | 采样视线与地形的最小净空，米 |
| `distance` / `unit` | 观察点到目标点的三维直线距离及单位 |
| `samples` | 各点地形 `height`、视线 `rayHeight`、净空 `clearance` 及累计水平 `distance` |
| `geometry` | 按视线高度排列的三维 LineString |

不包含建筑、植被或 3D Tiles，不是场景射线拾取。离散采样可能遗漏窄遮挡；`obstruction` 不是精确的三角网交点。输入第三维不表示绝对观察高度，请通过离地高度字段设置。示例使用 `pickLine` 的首尾点。更多限制见[总览](/analysis/terrain)。
