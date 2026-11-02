# getSlopeAspect 坡度坡向

在地形三角网中求局部高程梯度。坡度为与水平面的夹角；坡向是下坡方向，正北 0°、正东 90°、正南 180°、正西 270°。

## 组件案例

<LayerExamplePreview category="terrain" example="slope-aspect" title="坡度坡向" />

## 用法

```js
const result = await analysis.getSlopeAspect(polygon, { cellSize: 150, areaUnit: 'km2' })
for (const cell of result.cells) {
  console.log(cell.slope, cell.aspect, cell.geometry)
}
```

| 返回字段 | 作用 |
| --- | --- |
| `cells[].slope` | 三角形坡度，度 |
| `cells[].aspect` | 下坡方向，度；近似水平面返回 `null` |
| `minSlope` / `maxSlope` | 网格最小 / 最大坡度 |
| `averageSlope` | 按水平投影面积加权的平均坡度 |
| `angleUnit` | 固定为 `degrees` |

同时包含 [`getSurfaceArea`](/terrain/surface-area) 的全部面积与网格字段。示例按坡度分级着色，白色箭头表示下坡方向；分级颜色位于可编辑代码内。结果依赖网格密度，见[采样约定](/analysis/terrain)。
