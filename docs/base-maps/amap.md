# AMapImageryProvider 高德地图

`AMapImageryProvider` 使用 `wprd0` 服务加载高德地图瓦片。`crs` 指定业务经纬度的坐标系：默认 `GCJ02` 不纠偏，`WGS84` 和 `BD09` 会在投影阶段转换为 GCJ02。

## 组件案例

<SdkExamplePreview category="base-map" example="amap" title="AMapImageryProvider 高德地图" />

## BaseMap 用法

```js
const baseMap = new BaseMaps.BaseMap(viewer, {
  type: 'amap',
  style: 7, // 6～10，也可使用 img、elec、cva
  scl: 1,
  crs: 'WGS84',
  maximumLevel: 18,
})
```

| 参数 | 常用值 | 说明 |
| --- | --- | --- |
| `style` | `6`～`10` | 地图样式；`img`、`elec`、`cva` 分别兼容 `6`、`7`、`8` |
| `scale` | `1`、`2` | 普通屏或高清屏参数；仅在传入时追加到请求 |
| `lang` | `zh_cn` | 瓦片语言，默认 `zh_cn` |
| `size` | `1` | 高德瓦片请求的 `size` 参数 |
| `scl` | `1`、`2` | 注记开关；`1` 显示文字注记，`2` 隐藏注记，默认 `1` |
| `ltype` | 数字 | 可选的高德图层内容参数，会原样传入瓦片请求 |
| `queryParameters` | 对象 | 追加或覆盖瓦片查询参数 |
| `crs` | `GCJ02`、`WGS84`、`BD09` | 业务坐标系，默认 `GCJ02`；仅 `WGS84` 和 `BD09` 进行纠偏 |
| `url` | URL 模板 | 覆盖 SDK 默认服务模板 |
| `subdomains` | 数组 | 自定义服务子域名，默认 `['1', '2', '3', '4']` |

## 坐标系 crs

| 业务坐标来源 | `crs` | 投影时的坐标转换 |
| --- | --- | --- |
| 高德 GCJ02 经纬度 | `GCJ02`（默认） | 不转换，直接进行 Web Mercator 投影 |
| WGS84 经纬度 | `WGS84` | WGS84 → GCJ02 |
| 百度 BD09 经纬度 | `BD09` | BD09 → GCJ02 |

兼容 `GCJ-02`、`WGS-84`、`BD-09` 等写法。高德拾取的经纬度配合 `crs: 'GCJ02'` 可直接使用，无需再次纠偏：

```js
const provider = new BaseMaps.AMapImageryProvider({
  style: 'elec',
  crs: 'GCJ02',
})
const baseMap = new BaseMaps.BaseMap(viewer, { provider })
// 图层的 geometry.coordinates 直接传入高德拾取的 [经度, 纬度]。
```

`crs` 只控制底图的投影转换，不会修改业务图层数据。需要与 WGS84 地形、三维模型等数据叠加时，应统一使用 WGS84 业务坐标及 `crs: 'WGS84'`。显式传入 `tilingScheme` 时优先使用自定义切片方案。
