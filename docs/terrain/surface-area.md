# getSurfaceArea 地表面积

对局部 Polygon / MultiPolygon 生成细分三角网，采样各顶点高程，累计起伏地表面积。支持孔洞，不把孔洞或区域外部分计入面积。

## 组件案例

<LayerExamplePreview category="terrain" example="surface-area" title="地表面积" />

## 用法

```js
const result = await analysis.getSurfaceArea([
  [117.920, 43.780], [117.943, 43.780],
  [117.943, 43.795], [117.920, 43.795],
], { areaUnit: 'km2', cellSize: 200 })
```

| 返回字段 | 作用 |
| --- | --- |
| `surfaceArea` | 起伏三角网的地表面积 |
| `projectedArea` | 同一局部投影网格的水平面积 |
| `unit` | `m2` / `km2` / `ha` |
| `center` | 区域包围范围中心（可能不在凹面内） |
| `cells` | 三角网记录，含索引、中心、高程、坡度坡向、投影面积、地表面积及三维 Polygon `geometry` |
| `minHeight` / `maxHeight` | 顶点采样高程范围，米 |
| `cellSize` | 请求的网格最大边长，米 |

示例使用贴地色块展示分析范围，避免采样网格与地形精度不一致造成穿插。返回的 `cells[].geometry` 仍包含实际采样高程，可自行采用 `perPositionHeight: true` 绘制三维网格。方法只返回数据，不改变地形材质。局部投影、预算上限与精度限制见[总览](/analysis/terrain)。
