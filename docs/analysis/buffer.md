# getBuffer 缓冲区分析

对点、单条线、面生成指定距离的正向缓冲区。输入距离采用 `unit`，返回面积采用 `areaUnit`；不支持负距离的面收缩。

## 点缓冲区案例

<SdkExamplePreview category="analysis" example="buffer-point" title="点缓冲区分析" />

## 线缓冲区案例

<SdkExamplePreview category="analysis" example="buffer-line" title="线缓冲区分析" />

## 面缓冲区案例

<SdkExamplePreview category="analysis" example="buffer-polygon" title="面缓冲区分析" />

## 用法

```js
const analysis = new SpatialAnalysis({ unit: 'km', areaUnit: 'km2' })
analysis.getBuffer([125.82, 44.15], 0.5)
analysis.getBuffer([[125.81, 44.14], [125.84, 44.16]], 0.2)
analysis.getBuffer(polygonCoordinates, 0.2, { type: 'Polygon', steps: 64 })
// 传入 SDK 面数据时无需 type 选项
analysis.getBuffer({ geometry: { type: 'Polygon', coordinates: [polygonCoordinates] }, properties: {} }, 0.2)
```

签名：`getBuffer(input, radius, options?)`。

| 字段 | 作用 |
| --- | --- |
| `input` | 点坐标、线路坐标，或 Point / LineString / Polygon / MultiPolygon 数据项 |
| `radius` | 有限正数，单位为 `unit` |
| `options.type` | 原始坐标组默认按 LineString；面外环须指定 `'Polygon'` |
| `options.steps` | 圆弧细分整数 8～256，默认 64 |
| `options.unit / areaUnit` | 覆盖本次距离、面积单位 |

返回[通用面结果](/analysis/#面结果与地图展示)，并含 `radius`、`radiusUnit`、`sourceGeometry`。缓冲区含原始区域，并非仅返回边界外侧的环带；如需环带，可继续调用差集分析。

缓冲区是采样近似，采样精度与 `steps` 有关，不应将点缓冲区面积当作圆面积解析值；精确球面圆面积请使用 `getCircleArea`。跨日期变更线的结果会被拒绝。
