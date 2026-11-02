# 底图模块 BaseMaps

底图负责提供场景的地理背景，不属于业务数据图层。BMapViewer 因此使用独立的 `BaseMaps` 命名空间管理离线瓦片、互联网地图 Provider、坐标偏移和自定义切片方案；`MapLayers` 只保留点、线、面、气泡、热力图和三维场景等业务图层。

```js
import { BaseMaps } from 'b-map-viewer'
```

## 模块组成

| 能力 | API |
| --- | --- |
| 底图生命周期 | `BaseMaps.BaseMap` |
| Provider 工厂 | `BaseMaps.createImageryProvider`、`createCesiumImageryProvider` |
| 在线地图 | `AMapImageryProvider`、`BaiduImageryProvider`、`TencentImageryProvider`、`ArcGISImageryProvider`、`TdtImageryProvider`、`GoogleImageryProvider`、`GeoVisImageryProvider` |
| 三维地形 | `CesiumTerrain`、`createCesiumTerrainProvider`、`TdtTerrain`、`TdtTerrainProvider` |
| 坐标纠偏 | `GCJ02TilingScheme`、`BD09TilingScheme`、`CoordTransform` |
| 自定义切片 | `CustomGeographicTilingScheme`、`CustomMercatorTilingScheme` |
| 百度投影 | `BD09Projection` |

## 组件案例目录

| 底图 | 实现方式 | 文档与实时案例 |
| --- | --- | --- |
| 本地离线瓦片 | `BaseMap / offline` | [查看离线瓦片](/base-maps/offline) |
| 自定义 Provider | `createImageryProvider` | [查看自定义 Provider](/base-maps/custom-provider) |
| 高德地图 | `AMapImageryProvider` | [查看高德地图](/base-maps/amap) |
| 百度地图 | `BaiduImageryProvider` | [查看百度地图](/base-maps/baidu) |
| 腾讯地图 | `TencentImageryProvider` | [查看腾讯地图](/base-maps/tencent) |
| ArcGIS 全球影像 | `ArcGISImageryProvider` | [查看 ArcGIS](/base-maps/arcgis) |
| Cesium 官方地图 | `BaseMap / cesium` | [查看 Cesium 官方地图](/base-maps/cesium) |
| Google 地图 | `GoogleImageryProvider` | [查看 Google 地图](/base-maps/google) |
| 天地图 | `TdtImageryProvider` | [查看天地图](/base-maps/tdt) |
| 天地图三维地形 | `TdtTerrain / TdtTerrainProvider` | [查看天地图三维地形](/base-maps/tdt-terrain) |
| Cesium 官方全球地形 | `CesiumTerrain` | [查看 Cesium World Terrain](/base-maps/cesium-terrain) |
| 星图地球 | `GeoVisImageryProvider` | [查看星图地球](/base-maps/geovis) |

天地图、星图地球及 Cesium ion 服务需要开发者凭证，配置方式见对应文档。Cesium 官方影像和地形示例沿用项目的示例 Token；业务接入请使用自己的凭证。天地图和星图地球的公开页面不内置 Key。

## 在线底图 style 对照

| 底图 | 默认示例 | 可选 `style` | 说明 |
| --- | --- | --- | --- |
| 高德地图 | `img` | `img`、`elec`、`cva` | 影像、电子地图、标注 |
| 百度地图 | `normal` | `img`、`vec`、`normal`、`dark` | 影像、矢量、标准地图、暗色自定义样式 |
| Google 地图 | `elec` | `img`、`elec`、`ter`、`cva`、`img_cva` | 影像、电子地图、地形、标注、影像标注混合 |
| 星图地球 | `vec` | `img`、`vec`、`ter`、`cia`、`cat` | 影像、矢量、地形及对应标注 |
| 天地图 | `vec` | `vec`、`cva`、`img`、`cia`、`ter` | 矢量、矢量标注、影像、影像标注、地形晕渲影像 |
| 腾讯地图 | `1` | `img`、`1` | 影像、经典地图 |
| Cesium 官方地图 | `img` | `img`、`img_cva`、`elec` | 卫星影像、带标注影像、电子地图 |

百度 `dark` 需要同时配置具有访问权限的暗色瓦片 `url`；SDK 不会回退到已失效的旧版公共自定义样式地址。天地图和星图地球还需要对应服务的 Key。

## BaseMap

`new BaseMaps.BaseMap(viewer, config)` 创建并立即加载一个底图。实例只管理自身创建的影像资源，页面销毁时调用 `destroy()` 即可。

```js
const baseMap = new BaseMaps.BaseMap(viewer, {
  type: 'offline',
  url: '/tiles/{z}/{x}/{reverseY}.png',
  crs: 'GCJ02',
  minimumLevel: 1,
  maximumLevel: 12,
  themeColor: '#34A4FF',
})
```

### 通用配置

| 参数 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `type` | string | `url-template` | `offline`、`url-template`、`amap`、`baidu`、`tencent`、`arcgis`、`cesium`、`tdt`、`google` 或 `geovis` |
| `provider` | ImageryProvider \| Promise | - | 直接传入 Cesium Provider 或其 Promise，优先级高于 `type` |
| `providerOptions` | object | `{}` | 额外传递给 Provider 的配置 |
| `index` | number | `0` | 加入 `viewer.imageryLayers` 的位置 |
| `show` | boolean | `true` | 初始可见性 |
| `themeColor` | string | - | 可选的暗色滤镜目标色 |
| `layerOptions` | object | `{}` | 传递给 `Cesium.ImageryLayer` 的参数 |
| `crs` | string | - | 底图坐标系配置；离线 GCJ-02 瓦片可传 `GCJ02`，在线 Provider 的具体含义见对应文档 |
| `token` | string | - | Cesium ion 凭证；离线 URL 模板中用作 Authorization 请求头 |
| `url`、`minimumLevel` 等 | - | - | 未被底图管理器消费的字段会继续传给 Provider |

各 Provider 的 `style` 含义、兼容别名、凭证模式和地址覆盖方式见 [多源 Provider](/base-maps/providers)。

### 生命周期方法

| 方法 | 说明 |
| --- | --- |
| `readyPromise` | Provider 就绪后返回 Provider；失败时拒绝，加载期间移除或切换后旧任务返回 null |
| `load(config)` | 移除当前底图并按完整配置重新加载 |
| `switch(config)` | 合并当前配置后切换底图 |
| `getImageryLayer()` | 返回当前 `Cesium.ImageryLayer` |
| `getProvider()` | 返回当前 `ImageryProvider`，异步加载中返回 null |
| `show()` / `hide()` | 控制底图可见性 |
| `setTheme(color)` / `removeColor()` | 设置或清理底图颜色滤镜 |
| `remove()` | 从 Viewer 移除底图，实例仍可再次 `load` |
| `destroy()` | 移除底图并释放 Viewer 引用 |

## 切换底图

```js
const baseMap = new BaseMaps.BaseMap(viewer, {
  type: 'offline',
  url: '/tiles/{z}/{x}/{reverseY}.png',
})

baseMap.switch({
  type: 'amap',
  style: 'img',
  crs: 'WGS84',
  themeColor: undefined,
})
```

## 从旧版迁移

底图坐标系参数统一使用 `crs`。旧的 `coordinateSystem` 暂时保留为兼容别名，新代码应改为：

```diff
- coordinateSystem: 'GCJ02'
+ crs: 'GCJ02'
```

底图不再由 `MapLayers` 导出：

```diff
- const baseMap = new MapLayers.BaseMapLayer(viewer, config)
- baseMap.removeLayer()
+ const baseMap = new BaseMaps.BaseMap(viewer, config)
+ baseMap.destroy()
```

有关具体服务参数，请继续阅读 [多源 Provider](/base-maps/providers)、[离线瓦片](/base-maps/offline) 和 [坐标系与自定义切片](/base-maps/tiling-schemes)。

> 互联网底图的版权、访问频率、Token 和服务可用性由对应数据提供方管理。生产环境请使用你拥有合法权限的服务地址与凭证。
