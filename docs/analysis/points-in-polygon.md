# getPointsInPolygon 点面关系与范围统计

将点位划分为区域内、区域外，并列出位于边界的点。支持多面和孔洞，保留 SDK 业务属性及输入索引。

## 组件案例

<SdkExamplePreview category="analysis" example="points-in-polygon" title="点面关系与范围统计" />

## 用法

```js
const points = [
  { geometry: { type: 'Point', coordinates: [125.82, 44.15] }, properties: { id: 'site-1', value: 20 } },
  { geometry: { type: 'Point', coordinates: [125.85, 44.17] }, properties: { id: 'site-2', value: 30 } },
]
const result = analysis.getPointsInPolygon(points, polygonCoordinates, { includeBoundary: true })
console.log(result.insidePoints, result.count)
```

签名：`getPointsInPolygon(points, region, options?)`。`points` 为 SDK 点数据数组、FeatureCollection 或坐标组；`region` 采用[面数据约定](/analysis/#数据规范)。

| 返回字段 | 作用 |
| --- | --- |
| `count / totalCount` | 选中点数、输入总点数 |
| `insidePoints` | 选中点位，是否包含边界由 `includeBoundary` 控制 |
| `outsidePoints` | 未选中点位 |
| `boundaryPoints` | 位于外边界或孔洞边界的点位，单独列出，不是额外一类互斥统计 |
| `includeBoundary` | 本次采用的边界归属 |
| `geometry` | 规范化后的查询区域 |

每个点位返回 `index`、`geometry`、`properties`，若原始数据有顶层 `id` 也会保留。数组按输入顺序排列。空点集合法；`count + outsidePoints.length === totalCount`。`boundaryPoints` 与前两组可能重合，不要重复相加。

范围内属性统计可继续执行 `result.insidePoints.reduce((sum, item) => sum + item.properties.value, 0)`；此方法本身不自动将任意业务属性当作数值统计。
