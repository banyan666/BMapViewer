# getDifferenceArea 面积差集分析

计算第一个区域扣除第二个区域后的剩余几何和面积，输入顺序不能交换。

## 组件案例

<SdkExamplePreview category="analysis" example="difference-area" title="面积差集分析" />

## 用法

```js
const result = analysis.getDifferenceArea(firstPolygon, secondPolygon, { areaUnit: 'km2' })
console.log(result.area, result.removedArea, result.geometry)
```

签名：`getDifferenceArea(first, second, options?)`。输入支持外环坐标、Polygon / MultiPolygon 数据，孔洞需通过 GeoJSON 表达，详见[数据规范](/analysis/#数据规范)。

返回[通用面结果](/analysis/#面结果与地图展示)，并包含：

| 字段 | 作用 |
| --- | --- |
| `firstArea` | 第一组区域原始面积 |
| `secondArea` | 第二组区域原始面积 |
| `removedArea` | 从第一组区域实际扣除的面积，不等同于 secondArea |

所有面积使用结果的 `unit`。完全扣除时 `area: 0`、`geometry: null`、`parts: []`；不相交时保留第一组区域。结果可能包含孔洞或多个不相连的面，地图展示须保留完整 GeoJSON，不能只取第一个外环。
