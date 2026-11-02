# getCoverage 几何覆盖分析

将覆盖源先合并去重，再计算它们对目标区域的覆盖面积、覆盖率和未覆盖部分。此能力是几何范围计算，不是无线信号传播或真实服务可达性模拟。

## 组件案例

<SdkExamplePreview category="analysis" example="coverage" title="几何覆盖分析" />

默认加载目标区域和两个覆盖圆，可通过两次单击继续加入覆盖圆；重新绘制恢复默认配置。

## 用法

```js
const analysis = new SpatialAnalysis({ unit: 'km', areaUnit: 'km2' })
const sources = [
  analysis.getBuffer([125.809, 44.147], 0.8).geometry,
  analysis.getBuffer([125.829, 44.154], 0.8).geometry,
]
const result = analysis.getCoverage(targetPolygon, sources)
console.log(result.coverageRatio * 100, result.coveredGeometry, result.uncoveredGeometry)
```

签名：`getCoverage(target, coverageRegions, options?)`。目标为一个面输入，覆盖源为面输入数组或 FeatureCollection；支持孔洞和 MultiPolygon。空覆盖源合法。

| 返回字段 | 作用 |
| --- | --- |
| `unit` | 全部面积的单位 |
| `targetArea` | 目标总面积 |
| `coveredArea / uncoveredArea` | 覆盖与未覆盖面积 |
| `coverageRatio` | 覆盖率，范围 0～1 |
| `fullyCovered` | 是否已无具有正面积的未覆盖部分 |
| `sourceCount` | 覆盖源数量，含重复数据 |
| `center` | 覆盖结果最大分块的标签锚点；无覆盖为 null |
| `coveredGeometry / uncoveredGeometry` | Polygon / MultiPolygon；对应为空时为 null |
| `coveredParts / uncoveredParts` | 分块，每项含 area、center、geometry |

覆盖源落在目标范围之外的部分不计入覆盖面积；源之间的重叠也不会重复计入。无源、相离、完全覆盖都会返回明确的空几何，而不是遗留旧的图层数据。
