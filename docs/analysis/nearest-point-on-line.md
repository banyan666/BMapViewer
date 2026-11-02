# getNearestPointOnLine 点到线最近距离

查询点在一条折线上的最近位置、点到线的球面距离，以及从线路起点到最近位置的累计距离。

## 组件案例

<SdkExamplePreview category="analysis" example="nearest-point-on-line" title="点到线最近距离" />

## 用法

```js
const analysis = new SpatialAnalysis({ unit: 'km' })
const result = analysis.getNearestPointOnLine(
  [125.825, 44.15],
  [[125.79, 44.142], [125.81, 44.16], [125.833, 44.146]],
)
console.log(result.distance, result.center)
```

签名：`getNearestPointOnLine(point, line, options?)`。点采用坐标或 Point 数据项；线为单个 LineString 或线路坐标组。重复连续顶点会合并，不能只剩一个不同点。

| 返回字段 | 作用 |
| --- | --- |
| `unit` | 距离单位 m / km |
| `point` | 输入点坐标 |
| `center` | 线上最近位置 |
| `distance` | 输入点到最近位置的距离 |
| `distanceAlongLine` | 从线路起点到最近位置的累计距离 |
| `segmentIndex` | 最近位置所在的规范化线路分段索引，从 0 开始；终点归最后一段 |
| `geometry` | 最近位置的 Point 几何 |
| `connection` | 原始点至最近位置的连接线 LineString，可直接绘制 |

不计算地形起伏或高度差；最近位置也可能是端点。并列最近点的取舍由底层 Turf 搜索顺序决定。
