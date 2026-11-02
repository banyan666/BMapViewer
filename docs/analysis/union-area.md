# getUnionArea 区域合并分析

合并一个或多个面，重叠部分不重复计入总面积。分离的面仍以 MultiPolygon 返回，不会人为连接。

## 组件案例

<SdkExamplePreview category="analysis" example="union-area" title="区域合并分析" />

## 用法

```js
const result = analysis.getUnionArea([firstPolygon, secondPolygon], { areaUnit: 'km2' })
console.log(result.area, result.geometry)
```

签名：`getUnionArea(polygons, options?)`。`polygons` 为非空面输入数组或 FeatureCollection，数组中的每项可以是外环坐标、面几何或 SDK 面数据项。一个面输入也可正常返回结果，空数组会报错。

返回[通用面结果](/analysis/#面结果与地图展示)，并包含：

| 字段 | 作用 |
| --- | --- |
| `sourceCount` | 输入面数量 |
| `sourceArea` | 各原始面的面积直接累加，未去重 |
| `duplicateArea` | `sourceArea - area`，合并消除的重复计数面积 |

三个以上区域重叠时，`duplicateArea` 表示消除的重复计数，不等同于“所有至少被覆盖两次的区域”的去重面积。所有面积均使用结果 `unit`。
