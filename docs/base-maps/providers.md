# 多源地图 Provider

`BaseMaps.BaseMap` 可以通过 `type` 直接创建 Provider，也可以单独实例化 Provider 后传入 `provider`。

## Provider 一览

| type | Provider | 常用配置 |
| --- | --- | --- |
| `amap` | `AMapImageryProvider` | `style: 6～10`、`scl: 1 | 2`、`crs: 'WGS84'` |
| `baidu` | `BaiduImageryProvider` | `style: 'img' | 'vec' | 'normal' | 'dark'`、`crs: 'WGS84'` |
| `tencent` | `TencentImageryProvider` | `style: '1' | 'img'` |
| `arcgis` | `ArcGISImageryProvider` | `url`、`accessToken`、`minimumLevel`、`maximumLevel` |
| `tdt` | `TdtImageryProvider` | `style: 'vec' | 'cva' | 'img' | 'cia' | 'ter'`、`key` |
| `google` | `GoogleImageryProvider` | `style: 'img' | 'elec' | 'ter' | 'cva' | 'img_cva'`、`key`、`sessionToken` |
| `geovis` | `GeoVisImageryProvider` | `style: 'img' | 'vec' | 'ter' | 'cia' | 'cat'`、`format`、`key` |

## 可运行组件案例

- [高德地图](/base-maps/amap)
- [百度地图](/base-maps/baidu)
- [腾讯地图](/base-maps/tencent)
- [ArcGIS 全球影像](/base-maps/arcgis)
- [Google 地图](/base-maps/google)
- [天地图](/base-maps/tdt)
- [星图地球 GeoVis](/base-maps/geovis)

每个页面都关联对应的 Provider 案例。天地图和星图地球需要开发者 Key，因此公开页面不嵌入凭证；请在可编辑案例中替换占位内容后运行。

### 高德地图

```js
const baseMap = new BaseMaps.BaseMap(viewer, {
  type: 'amap',
  style: 7, // 6～10，也可使用 img、elec、cva
  scl: 1,
  crs: 'WGS84',
})
```

### 百度地图

```js
const baseMap = new BaseMaps.BaseMap(viewer, {
  type: 'baidu',
  style: 'normal', // img、vec、normal、dark
  crs: 'WGS84',
})
```

标准样式会先归一化再选择固定服务模板，不会再把 `style` 误拼成自定义样式地址：

| 写法 | 实际类型 |
| --- | --- |
| `normal`、`vec`、`vector`、`elec` | 标准矢量底图 |
| `img`、`image`、`imagery`、`satellite` | 标准影像底图 |
| `dark` | 暗色自定义样式，需要同时传入具有访问权限的 `url` |
| `custom` | 自定义样式；旧版公共 `customimage` 地址已失效，需要传入已授权的 `url`，可在 URL 中使用 `{customId}` 或 `{style}` 占位符 |

无法识别的样式会直接抛出配置错误，避免 Cesium 持续请求 404 或跳转页面。百度自定义样式不再回退到旧公共地址，必须显式传入你有权访问的 `url`；标准样式也可以通过 `url` 覆盖模板。

### 腾讯地图

```js
const baseMap = new BaseMaps.BaseMap(viewer, {
  type: 'tencent',
  style: '1', // img、1（经典地图）
})
```

### ArcGIS 全球影像

`ArcGISImageryProvider` 接受 MapServer 根地址，并自动按 ArcGIS 缓存地图规范转换为 `/tile/{z}/{y}/{x}`。也可以直接传入带占位符的完整瓦片模板。

```js
const url = 'https://server.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer'

const baseMap = new BaseMaps.BaseMap(viewer, {
  type: 'arcgis',
  url,
  maximumLevel: 23,
})
```

需要鉴权的 ArcGIS 服务可以传入 `accessToken`，Provider 会将其作为 `token` 查询参数追加到瓦片请求。ArcGIS 缓存地图的瓦片路径顺序是 `level/row/column`，对应 `{z}/{y}/{x}`。

### 天地图

```js
const baseMap = new BaseMaps.BaseMap(viewer, {
  type: 'tdt',
  style: 'vec', // vec、cva、img、cia、ter
  key: import.meta.env.VITE_TDT_KEY,
})
```

| `style` | 类型 |
| --- | --- |
| `vec` | 矢量底图 |
| `cva` | 矢量中文标注 |
| `img` | 影像底图 |
| `cia` | 影像中文标注 |
| `ter` | 地形晕渲影像 |

`ter` 是二维影像类型。要加载会改变地球表面几何起伏的天地图高程数据，请使用 [`TdtTerrain`](/base-maps/tdt-terrain)：

```js
const terrain = new BaseMaps.TdtTerrain(viewer, {
  key: import.meta.env.VITE_TDT_KEY,
  depthTestAgainstTerrain: true,
})
```

### Google 地图

```js
const baseMap = new BaseMaps.BaseMap(viewer, {
  type: 'google',
  style: 'elec', // img、elec、ter、cva、img_cva
  crs: 'WGS84',
})
```

兼容样式包括 `normal/vec/elec/roadmap`、`img/satellite`、`cva/labels`、`ter/terrain` 和 `img_cva/hybrid`。默认兼容地址使用 `https://mt{s}.google.com/vt`，可通过 `url` 覆盖。

生产环境推荐使用 Google Maps Platform 的 Map Tiles API。2D 瓦片需要先通过 API Key 创建 Session，再同时传入 `key` 和 `sessionToken`：

```js
const baseMap = new BaseMaps.BaseMap(viewer, {
  type: 'google',
  style: 'satellite',
  key: import.meta.env.VITE_GOOGLE_MAPS_KEY,
  sessionToken,
})
```

传入这两个字段后，Provider 会自动切换为官方地址：

```text
https://tile.googleapis.com/v1/2dtiles/{z}/{x}/{y}?session=...&key=...
```

Session 的地图类型由创建 Session 时的 `mapType` 决定，此时 `style` 只用于 SDK 配置可读性。详见 [Google Maps Tile API：Session Tokens](https://developers.google.com/maps/documentation/tile/session_tokens) 和 [2D Tiles](https://developers.google.com/maps/documentation/tile/2d-tiles-overview)。

### 星图地球 GeoVis

```js
const baseMap = new BaseMaps.BaseMap(viewer, {
  type: 'geovis',
  style: 'vec', // img、vec、ter、cia、cat
  format: 'png',
  key: import.meta.env.VITE_GEOVIS_TOKEN,
})
```

| `style` | 类型 |
| --- | --- |
| `img` | 影像底图 |
| `vec` | 矢量底图 |
| `ter` | 地形晕渲 |
| `cia` | 影像中文标注 |
| `cat` | 地形中文标注 |

## 直接创建 Provider

```js
const provider = new BaseMaps.AMapImageryProvider({
  style: 'img',
  crs: 'WGS84',
})

const baseMap = new BaseMaps.BaseMap(viewer, { provider })
```

也可以使用工厂：

```js
const provider = BaseMaps.createImageryProvider({
  type: 'tencent',
  style: 'img',
})
```

服务模板是可覆盖的。若提供方调整域名或 URL 规则，可通过 `url`、`subdomains` 和 Cesium Provider 的原生参数覆盖默认值，无需修改 SDK 源码。远程服务仍受提供方许可、配额、地区和网络环境约束。
