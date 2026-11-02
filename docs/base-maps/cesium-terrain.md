# CesiumTerrain 官方全球地形

`CesiumTerrain` 用于加载 Cesium ion 提供的 Cesium World Terrain，并管理地形的异步创建、挂载、显隐和销毁。它要求传入 Cesium ion Access Token，但不会修改全局 `Cesium.Ion.defaultAccessToken`，因此同一页面中的其他 ion 资源不会被意外更换凭证。

## 基本用法

```js
import { BaseMaps } from 'b-map-viewer'

const terrain = new BaseMaps.CesiumTerrain(viewer, {
  token: import.meta.env.VITE_CESIUM_ION_TOKEN,
  requestVertexNormals: true,
  requestWaterMask: true,
  depthTestAgainstTerrain: true,
})

await terrain.readyPromise

// 页面卸载时恢复 Viewer 原有地形
terrain.destroy()
```

Cesium World Terrain 需要有效的 ion Token。在线示例的“底图模块 → Cesium World Terrain”已配置示例 Token，可直接运行，也可在代码编辑器中替换为自己的 Token。接入项目时请使用自己的凭证。

## 构造参数

| 参数 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `token` / `accessToken` | `string` | `''` | Cesium ion Access Token，必填 |
| `assetId` | `number` | `1` | ion 地形资产 ID；`1` 是 Cesium World Terrain |
| `server` | `string \| Resource` | Cesium ion 默认服务 | 自定义 ion API 服务地址 |
| `requestVertexNormals` | `boolean` | `false` | 请求顶点法线，用于地形光照 |
| `requestWaterMask` | `boolean` | `false` | 请求水体遮罩 |
| `requestMetadata` | `boolean` | `true` | 请求地形元数据 |
| `depthTestAgainstTerrain` | `boolean` | `true` | 是否启用地形深度检测 |
| `ellipsoid` | `Ellipsoid` | `WGS84` | 地形使用的椭球体 |
| `credit` | `Credit \| string` | 服务返回值 | 自定义版权信息 |
| `providerOptions` | `object` | `{}` | 继续传给 Cesium `CesiumTerrainProvider.fromUrl` 的参数 |
| `provider` | `TerrainProvider \| Promise<TerrainProvider>` | - | 直接传入已有 Provider 或 Provider Promise |

## 异步状态

创建 ion 地形需要先解析资产地址，因此构造后应等待 `readyPromise`：

```js
const terrain = new BaseMaps.CesiumTerrain(viewer, { token })

try {
  const provider = await terrain.readyPromise
  console.log('Cesium World Terrain 已加载', provider)
} catch (error) {
  console.error('地形加载失败', error)
}
```

## 生命周期

| 方法或属性 | 说明 |
| --- | --- |
| `readyPromise` | 当前地形加载任务，成功后返回 `CesiumTerrainProvider` |
| `load(config)` | 按完整配置异步加载地形，并返回 Promise |
| `switch(config)` | 合并当前配置后异步切换地形 |
| `getProvider()` | 获取已就绪的 Provider；加载中返回 `null` |
| `show()` / `hide()` | 挂载当前地形或临时恢复 Viewer 原有地形 |
| `remove()` | 取消当前加载版本并恢复原有地形 |
| `destroy()` | 清理管理器并恢复 Viewer 原有地形 |

## 只创建 Provider

也可以使用 SDK 的异步工厂，自行管理 Viewer：

```js
const previousProvider = viewer.terrainProvider

viewer.terrainProvider = await BaseMaps.createCesiumTerrainProvider({
  token: import.meta.env.VITE_CESIUM_ION_TOKEN,
  requestVertexNormals: true,
})

// 页面卸载时自行恢复
viewer.terrainProvider = previousProvider
```

建议通过环境变量提供 Token：

```dotenv
VITE_CESIUM_ION_TOKEN=你的CesiumIonToken
```

Token 的资产权限、允许来源和请求配额由 Cesium ion 账号配置决定。
