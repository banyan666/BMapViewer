# getLineInPolygon 线面穿越分析

按区域边界切分折线，分别返回区域内、区域外的线段及距离。支持穿越凹多边形、孔洞和多个分离区域。

## 组件案例

<SdkExamplePreview category="analysis" example="line-in-polygon" title="线面穿越分析" />

## 用法

```js
const result = analysis.getLineInPolygon(lineCoordinates, polygonData, {
  unit: 'km', includeBoundary: true,
})
console.log(result.insideDistance, result.outsideDistance)
// result.insideGeometry / outsideGeometry 可分别绘制为不同颜色
```

签名：`getLineInPolygon(line, region, options?)`。线路为单个 LineString 或坐标组；区域支持[面数据约定](/analysis/#数据规范)。

| 返回字段 | 作用 |
| --- | --- |
| `unit / includeBoundary` | 距离单位与边界归属 |
| `hasInside` | 是否存在划入区域内的有效线段 |
| `totalDistance` | 所有切分后线段的距离总和 |
| `insideDistance / outsideDistance` | 区域内外距离，两者之和等于 totalDistance |
| `boundaryDistance` | 沿区域边界的线段距离，是内/外距离的一部分，不能额外累加 |
| `insideSegments / outsideSegments / boundarySegments` | 对应线段，每项含 `segmentIndex`、`distance`、LineString `geometry` |
| `intersections` | 去重的边界交点坐标，包含接触点，不等同于穿越次数 |
| `insideGeometry / outsideGeometry` | 对应 MultiLineString；没有线段时为 null |

`includeBoundary: true` 时边界段算区域内，false 时算区域外。仅在顶点接触且没有正距离进入区域的情况，不产生区域内线段。

切分采用经纬度线性边界，每段距离再按球面计算；`totalDistance` 是切分段汇总，可能与将原始未切分折线交给 `getDistance` 得到的球面距离略有差异，不能将这两种路径模型混为完全相等。所有结果不包含地形起伏。
