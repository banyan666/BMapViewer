# getNearbyFeatures 周边点位查询

根据圆心与半径筛选点位，按距离由近到远返回。当前查询对象为点数据，不将线、面自动当作中心点。

## 组件案例

<SdkExamplePreview category="analysis" example="nearby-features" title="周边点位查询" />

## 用法

```js
const analysis = new SpatialAnalysis({ unit: 'km' })
const tools = new PickTools(viewer, { unit: 'km', isReserve: true })
tools.pickCircle(({ center, radius }) => {
  const result = analysis.getNearbyFeatures(center, radius, pointData)
  console.log(result.features, result.nearest)
})
```

签名：`getNearbyFeatures(center, radius, features, options?)`。`radius` 为有限正数，单位为 `unit`；点数据使用 SDK 数组、FeatureCollection 或坐标组。

| 返回字段 | 作用 |
| --- | --- |
| `center / radius / unit` | 查询圆心、半径及距离单位 |
| `count / totalCount` | 选中点数及输入总点数 |
| `features` | 范围内的点位，含 `index`、`geometry`、`properties`、`distance`，可保留顶层 id |
| `nearest` | 最近点位的数据副本；没有结果时为 null |

距离等于半径的点计入结果。距离相同时按输入索引稳定排序；距离均按球面计算，不包含高度。空点集合法，返回空列表和 `nearest: null`。
