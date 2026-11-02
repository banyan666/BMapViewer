# 空间分析与地形分析

SDK 将分析与可视化分离：`SpatialAnalysis` 是不依赖 Viewer 的同步空间计算工具；[`TerrainAnalysis`](/analysis/terrain) 基于真实地形异步采样，提供剖面、坡度坡向、通视、贴地测量和体积估算。两者只返回数据，不创建地图图层。

```js
import { SpatialAnalysis, TerrainAnalysis } from 'b-map-viewer'

const analysis = new SpatialAnalysis({ unit: 'km', areaUnit: 'km2' })
const terrain = new TerrainAnalysis(viewer, { unit: 'km', areaUnit: 'km2' })
// 先加载真实地形并等待 readyPromise，再调用 await terrain.getProfile(coordinates) 等方法
terrain.destroy() // 不会销毁传入的 Viewer
```

## 已实现的 SpatialAnalysis 能力

| 方法 | 作用 | 文档 |
| --- | --- | --- |
| `getDistance` | 分段、累计与总距离 | [距离](/analysis/distance) |
| `getArea` | 单个外环的面积、周长与中心 | [面积](/analysis/area) |
| `getCircleArea` | 圆面积、半径、直径与周长 | [圆面积](/analysis/circle-area) |
| `getOverlapArea` | 两个外环的交集与重叠面积 | [叠加](/analysis/overlap-area) |
| `getBuffer` | 点、线、面的正向缓冲区 | [缓冲区](/analysis/buffer) |
| `getPointsInPolygon` | 范围内外及边界点位统计 | [点面关系](/analysis/points-in-polygon) |
| `getNearestPointOnLine` | 最近点、点到线距离和沿线距离 | [最近距离](/analysis/nearest-point-on-line) |
| `getNearbyFeatures` | 半径内点位查询与距离排序 | [周边查询](/analysis/nearby-features) |
| `getDifferenceArea` | 第一组面扣除第二组面 | [差集](/analysis/difference-area) |
| `getUnionArea` | 多区域合并和面积去重 | [合并](/analysis/union-area) |
| `getLineInPolygon` | 线面穿越、内外线路和距离 | [穿越](/analysis/line-in-polygon) |
| `getCoverage` | 目标区域覆盖率及覆盖/未覆盖几何 | [覆盖](/analysis/coverage) |

## 配置约定

构造配置、`updateConfig(config)` 和方法最后的 `options` 使用同一配置约定；单次调用不改变实例配置。

| 字段 | 默认值 | 作用 |
| --- | --- | --- |
| `unit` | `'m'` | 距离、输入半径单位：`m` / `km`，也接受 `meters` / `kilometers` |
| `areaUnit` | `'m2'` | 面积单位：`m2` / `km2` / `ha`，也接受 `m²` / `km²` |
| `includeBoundary` | `true` | 点面判断、线面穿越中是否将边界计入区域内 |
| `steps` | `64` | 缓冲区圆弧采样数，整数 8～256；越大边界越细，计算量也越大 |

面积结果的 `unit` 表示面积单位；同时返回距离时使用 `radiusUnit` 等独立字段。距离结果的 `unit` 则为 `m` / `km`。配合 `PickTools.pickCircle` 使用时，两者的距离 `unit` 应一致。

## 数据规范

- 所有坐标为 WGS84 `[经度, 纬度]`，第三维高度不参与计算。输入不会被修改；数据及业务属性应为可结构化克隆的普通数据。
- 点位批量查询支持 SDK `{ geometry: { type: 'Point', coordinates }, properties }[]`、GeoJSON `FeatureCollection`，也接受坐标组。
- 单条线路支持 `[[lon, lat], ...]`、`LineString` 几何、SDK 数据项或 GeoJSON Feature；连续重复点会合并，至少保留两个不同点。
- 新增面运算支持单个外环坐标组，以及 `Polygon` / `MultiPolygon` 几何、SDK 数据项或 GeoJSON Feature。孔洞请通过 GeoJSON 的内环表达。
- `getUnionArea` 和 `getCoverage` 的多个面使用“面输入数组”或 FeatureCollection；合并不接受空数组，覆盖分析允许空覆盖源。
- 面环自动闭合。非法坐标、自交、退化环、外部孔洞、交叉孔洞和内部重叠的 MultiPolygon 分块会抛出错误。
- 新增拓扑运算面向不跨 ±180° 经线的局部区域。交集、差集、合并和线面切分采用经纬度平面拓扑；距离和面积按球面计算，不包含地形起伏。

`getArea`、`getOverlapArea` 仍保留原有单外环输入约定，不将它们自动改为新的多面输入协议。

## 面结果与地图展示

缓冲区、差集和合并共用结果字段：`area`、`unit`、`hasArea`、`geometry`、`center`、`parts`。其中 `geometry` 为 Polygon / MultiPolygon；没有有效面积时为 `null`，`parts` 为空数组、`center` 为 `null`。

每个 `parts` 项含 `area`、`center`、`geometry`，面积单位同结果 `unit`。标签锚点优先取区域质心，若在区域外则回退到区域内或边界点。交集分块不连接成一个虚假的整体中心。

```js
const result = analysis.getDifferenceArea(firstPolygon, secondPolygon)
if (result.geometry) {
  polygonLayer.setData([{ geometry: result.geometry, properties: { id: 'analysis-result' } }])
} else {
  polygonLayer.clearLayer()
}
```

所有计算方法只返回数据，不创建地图实体、图层或事件。在线示例负责拾取、标注、打印和资源清理，所有示例数据在本地生成，不请求第三方业务数据。
