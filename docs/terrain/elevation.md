# getElevation 地形高程

对一个或多个 WGS84 点采样真实地形，适合点位高程查询、最高最低点统计。

## 组件案例

<LayerExamplePreview category="terrain" example="elevation" title="地形高程" />

## 用法

```js
const analysis = new TerrainAnalysis(viewer, { unit: 'km' })
const result = await analysis.getElevation([
  { geometry: { type: 'Point', coordinates: [117.924, 43.790] }, properties: { id: 'monitor-1' } },
  { geometry: { type: 'Point', coordinates: [117.934, 43.784] }, properties: { id: 'monitor-2' } },
])
// 单点也可：await analysis.getElevation([117.924, 43.790])
```

| 返回字段 | 作用 |
| --- | --- |
| `samples` | 按输入顺序返回点位记录，含 `center`、`height`、三维 Point `geometry` 及原有 `properties` |
| `minHeight` / `maxHeight` | 采样最低 / 最高高程，米 |
| `heightUnit` | 固定为 `m` |
| `sampleCount` | 采样点数 |

即使 `unit: 'km'`，高程仍是米。高程为椭球高，并非海拔；不使用输入第三维代替采样。配置、错误和单位约定见[三维分析总览](/analysis/terrain)。
