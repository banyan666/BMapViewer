# Cesium 官方地图

通过 Cesium ion 加载 Cesium World Imagery 全球影像。影像负责地图背景，地形起伏使用独立的 [CesiumTerrain](/base-maps/cesium-terrain)。坐标使用 WGS84，不进行 GCJ-02 或 BD-09 纠偏。

## 组件案例

<LayerExamplePreview category="base-map" example="cesium" title="Cesium 官方地图" />

可在“底图目录 → Cesium 官方地图”的代码编辑器中修改 `style`、`language` 和 Token 后运行。默认展示简体中文标注影像。公开示例沿用项目的示例 Token；业务接入请使用自己的凭证。

## BaseMap 用法

```js
import { BaseMaps } from 'b-map-viewer'

const baseMap = new BaseMaps.BaseMap(viewer, {
  type: 'cesium',
  token: import.meta.env.VITE_CESIUM_ION_TOKEN,
  style: 'img_cva',
  language: 'zh-CN',
  tileProtocol: 'https',
  crs: 'WGS84',
  layerOptions: { alpha: 1, brightness: 1 },
})

await baseMap.readyPromise
// baseMap.hide(); baseMap.show()
// 页面卸载时：baseMap.destroy()
```

## 配置

| 字段 | 默认值 | 作用 |
| --- | --- | --- |
| `token` / `accessToken` | — | Cesium ion Access Token，必填 |
| `style` | `'img'` | 官方影像样式，见下表 |
| `assetId` | 由 style 决定 | 自定义 ion 影像资产 ID，优先于 style |
| `server` | Cesium ion 默认服务 | 自定义 ion API 服务地址 |
| `crs` | `'WGS84'` | 影像坐标系，仅支持 WGS84 |
| `language` | 不覆盖服务默认值 | 标注语言，例如 `zh-CN`、`zh-TW`、`en-US` |
| `culture` | — | 底层语言代码，优先于 language，例如 `zh-Hans`、`zh-Hant` |
| `tileProtocol` | 服务默认值 | 瓦片协议，`'https'` 或 `'http'` |
| `mapLayer` | 服务默认值 | Bing 附加地图要素，取值须符合服务支持范围 |
| `ellipsoid` | 服务默认椭球 | `Cesium.Ellipsoid` 实例 |
| `tileDiscardPolicy` | 服务默认策略 | Cesium 瓦片丢弃策略实例 |
| `show` | `true` | 初始可见性 |
| `index` | `0` | 影像在集合中的位置 |
| `layerOptions` | `{}` | 影像图层参数，例如 `alpha`、`brightness` |

| style | 官方样式 | 作用 |
| --- | --- | --- |
| `'img'` | `IonWorldImageryStyle.AERIAL` | 卫星影像 |
| `'img_cva'` | `IonWorldImageryStyle.AERIAL_WITH_LABELS` | 带道路标注的影像 |
| `'elec'` | `IonWorldImageryStyle.ROAD` | 电子地图 |

`style` 也可传入 Cesium 的数字枚举。`assetId` 为正整数，须指向 Token 有权访问的影像资产，不能使用地形或 3D Tiles 资产。

## 语言及显示配置

| language 示例 | 传给 Bing 的 culture |
| --- | --- |
| `zh-CN`、`zh-SG`、`zh-Hans` | `zh-Hans`，简体中文 |
| `zh-TW`、`zh-HK`、`zh-MO`、`zh-Hant` | `zh-Hant`，繁体中文 |
| `en-US`、`en-GB`、`ja-JP` 等 | 规范化后原样传入 |

`culture` 优先于 `language`；两者都不传时保留服务默认值。语言仅影响 `img_cva`、`elec` 等包含文字的地图，纯卫星影像 `img` 不会因语言参数增加文字。地图中的语言覆盖和地名翻译仍取决于服务数据。

语言、协议、附加要素、椭球和瓦片策略配置用于 Bing 类型的 ion 影像资产。配置这些字段时，SDK 会解析 ion 资产端点并创建带参数的 Bing Provider，保留 ion 与 Bing 版权信息；不会修改全局 Token、缓存或其他 Provider。自定义非 Bing 影像资产如需使用原生 ion 加载，请不传这些 Bing 专用字段；传入不支持的字段会明确报错，而不是静默忽略。

显示参数通过 `layerOptions` 配置，不改变瓦片服务：

```js
layerOptions: {
  alpha: 0.9,        // 透明度
  brightness: 1.1,   // 亮度
  contrast: 1,       // 对比度
  saturation: 1,     // 饱和度
  gamma: 1,         // 伽马
}
```

## 直接创建 Provider

```js
const provider = await BaseMaps.createCesiumImageryProvider({
  token: import.meta.env.VITE_CESIUM_ION_TOKEN,
  style: 'img_cva',
  language: 'zh-CN',
})
const baseMap = new BaseMaps.BaseMap(viewer, { provider })
```

`BaseMaps.createImageryProvider({ type: 'cesium', token, style })` 也返回 Provider Promise，应先 `await`。通过 `BaseMap` 接入时，管理器会处理异步挂载；`readyPromise` 在 Provider 就绪后返回该 Provider，失败时抛出错误。切换、移除或销毁后，旧请求完成不会重新挂载影像。

凭证按实例传入，不修改 `Cesium.Ion.defaultAccessToken`。资产授权、允许来源、配额及影像服务可用性由 Cesium ion 管理；如遇 401/403，请检查 Token 的影像资产访问权限及域名限制。不要把带有账号管理权限的密钥用于公开示例。

官方接口：[IonImageryProvider](https://cesium.com/learn/cesiumjs/ref-doc/IonImageryProvider.html)、[BingMapsImageryProvider](https://cesium.com/learn/cesiumjs/ref-doc/BingMapsImageryProvider.html)、[支持的语言代码](https://learn.microsoft.com/en-us/bingmaps/rest-services/common-parameters-and-types/supported-culture-codes)、[ImageryLayer.fromProviderAsync](https://cesium.com/learn/cesiumjs/ref-doc/ImageryLayer.html#.fromProviderAsync)。
