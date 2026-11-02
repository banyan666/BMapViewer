# getProfile 地形剖面

沿输入折线的各段测地线加密，采样高程并统计累计距离、爬升和下降。示例展示地图折线及高程剖面图。

## 组件案例

<LayerExamplePreview category="terrain" example="profile" title="地形剖面" />

## 用法

```js
const analysis = new TerrainAnalysis(viewer, { unit: 'km', sampleSpacing: 60 })
const result = await analysis.getProfile([[117.914, 43.783], [117.934, 43.784], [117.945, 43.791]])
```

| 返回字段 | 作用 |
| --- | --- |
| `samples` | 按路径顺序排列的采样点 |
| `samples[].center` / `height` | 经纬度与高程（米） |
| `samples[].distance` | 自起点累计水平测地距离，单位 `unit` |
| `samples[].surfaceDistance` | 自起点累计近似贴地距离，单位 `unit` |
| `samples[].segmentIndex` | 所属原始路径分段索引 |
| `horizontalDistance` | 水平测地总距离 |
| `totalDistance` | 近似贴地总距离 |
| `ascent` / `descent` | 累计爬升 / 下降，米 |
| `minHeight` / `maxHeight` | 采样高程范围，米 |
| `geometry` | 含采样高程的三维 LineString |
| `sampleSpacing` | 请求的采样间距，米 |

每小段以 `hypot(水平距离, 高差)` 累加。密度越低越可能遗漏细小起伏；`sampleSpacing` 不随 `unit` 改变。拾取绘制时使用 `new PickTools(viewer, { pickSurface: 'terrain' })`，再将 `pickLine` 的坐标组传入本方法。更多约定见[总览](/analysis/terrain)。
