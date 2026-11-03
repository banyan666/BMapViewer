# CloudUltraEffect 体积云 Ultra

`CloudUltraEffect` 使用世界空间多层云、Perlin-Worley 三维噪声、Bruneton 大气散射、级联云阴影及时间抗锯齿，移动镜头时云体保持地理空间位置。

## 组件案例

<SdkExamplePreview category="weather" example="cloud-ultra" title="CloudUltraEffect 体积云 Ultra" height="500px" />

示例使用 ArcGIS 影像，低空镜头及固定白天时刻，便于观察云体和阴影；退出后恢复原时钟。SDK 本身不调整相机、时钟、地形或 Cesium Token。

## 使用示例

Ultra 以独立 npm 包发布，按需安装：

```bash
npm install @b-map-viewer/cloud-ultra
```

它可以与 `b-map-viewer` 配合使用，也可以直接使用已有的 Cesium Viewer；不依赖 Vue。

```js
import { CloudUltraEffect } from '@b-map-viewer/cloud-ultra'

const cloud = new CloudUltraEffect(viewer, {
  coverage: 0.3,
  exposure: 10,
  windSpeed: 10,
  windDirection: 0,
  steps: 500,
  temporalUpscale: true,
  perfOptimize: true,
  layers: [
    { altitude: 750, height: 650, shadow: true },
    { altitude: 1000, height: 1200, shadow: true },
  ],
  onProgress: (percent) => console.log(`资源准备 ${percent}%`),
  onError: (error) => console.error(error),
})

try {
  await cloud.readyPromise
  cloud.setOptions({ coverage: 0.45, windSpeed: 15 })
} catch (error) {
  cloud.destroy()
  throw error
}

// 页面退出时
// cloud.destroy()
```

创建前可用 `CloudUltraEffect.isSupported(viewer)` 检查硬件能力。Ultra 需要 WebGL 2 及浮点渲染目标等能力。

主包 `b-map-viewer` 不再导出 `CloudUltraEffect`，`WeatherEffects` 和 `WeatherSystem` 也不再包含 Ultra。升级旧代码时，请改为上面的独立包导入方式。


## 构造参数

`new CloudUltraEffect(viewer, options)`

| 字段 | 默认值 | 作用 |
| --- | --- | --- |
| `enabled` | `true` | 初始是否显示云及配套大气 |
| `coverage` | `0.3` | 云量覆盖度，0～1 |
| `exposure` | `10` | 云与大气合成曝光，0.1～40 |
| `windSpeed` | `10` | 风速，米/秒，0～100 |
| `windDirection` | `0` | 风向角，0 北、90 东，单位：度 |
| `layers` | 三个活动层及一个空层 | 1～4 个云层配置 |
| `steps` | `500` | 主视线最大步进次数，16～1024 |
| `shadowSteps` | `50` | 云阴影最大步进次数，8～256 |
| `maxDistance` | `200000` | 最远光线步进距离，米 |
| `temporalUpscale` | `false` | 以低分辨率计算云并通过时间升采样输出完整画面 |
| `perfOptimize` | `false` | 阴影贴图从 512 降至 256 像素 |
| `enableShadow` | `true` | 是否计算级联云阴影 |
| `enableCloudShadow` | `true` | 是否将云阴影投射到地表 |
| `cloudShadowStrength` | `1` | 地表云影强度，0～1 |
| `enableGlobeLighting` | `true` | 云显示期间是否启用地表太阳光照 |
| `enableAerialPerspective` | `true` | 是否启用地表空气透视 |
| `aerialPerspectiveScale` | `1` | 空气透视强度，0～2 |
| `terrainClip` | `true` | 是否按当前场景地形深度裁剪云 |
| `scatteringCoefficient` | `1` | 散射系数 |
| `absorptionCoefficient` | `0` | 吸收系数 |
| `temporalAlpha` | `0.05` | 时间抗锯齿当前帧混合权重 |
| `varianceGamma` | `2` | 历史帧裁剪范围 |
| `timeout` | `120000` | 首次资源准备超时，毫秒 |
| `onProgress` | — | 资源准备进度回调，0～100 |
| `onError` | — | 加载或运行错误回调 |

默认沿用迁入管线的质量参数；示例开启时间升采样和阴影降采样以降低计算量。`enableShadow: false` 时地表云影也不生效。

### 云层字段

`layers` 按顺序替换云层，未提供的层关闭。`setOptions({ layers })` 同样按整组替换，最多四层。

| 字段 | 作用 |
| --- | --- |
| `altitude` | 云底高度，米 |
| `height` | 云层厚度，米；0 关闭该层 |
| `densityScale` | 云层密度倍率 |
| `shadow` | 此层是否参与云阴影 |
| `shapeAmount` | 大尺度三维形状强度 |
| `shapeDetailAmount` | 小尺度形状细节强度 |
| `weatherExponent` | 天气纹理分布指数 |
| `shapeAlteringBias` | 云形偏移 |
| `coverageFilterWidth` | 覆盖度过渡宽度 |
| `densityProfile` | 垂直密度剖面，含 `expTerm`、`exponent`、`linearTerm`、`constantTerm` |

高度依据云管线的地球大气模型，不是随地形抬升的离地高度。山区应将云底设置在当地地形以上。

## 生命周期

| 接口 | 作用 |
| --- | --- |
| `readyPromise` | 等待资源和初始渲染就绪；加载失败或取消时拒绝 |
| `ready` / `progress` / `error` | 查询当前就绪状态、进度和错误 |
| `load(options?)` | 释放旧管线并重新加载，返回新的 Promise |
| `setOptions(options)` | 更新参数，返回当前实例 |
| `getOptions()` | 返回独立配置副本，包含云层和密度剖面 |
| `getStage()` | 返回本效果的多阶段云管线，不是单个 `PostProcessStage` |
| `show()` / `start()` | 显示云、大气及配套光照 |
| `hide()` / `stop()` | 暂停云渲染、保留 GPU 资源，并恢复原天空与光照 |
| `remove()` | 中止加载、移除监听、释放 GPU 资源并恢复场景；可再次 `load()` |
| `destroy()` | 永久销毁实例；重复调用安全 |
| `isDestroyed()` | 查询实例是否已永久销毁 |

同一场景只允许一个 Ultra 管线。`hide` 不触发重新烘焙，`remove` / `destroy` 会释放噪声纹理、大气 LUT、帧缓冲、历史纹理、着色程序及 Worker。首次加载中切换示例或卸载页面也会中止当前任务。

## 按需加载与资源管理

也可以在进入云场景时才加载代码：

```js
const { CloudUltraEffect } = await import('@b-map-viewer/cloud-ultra')
const cloud = new CloudUltraEffect(viewer, {
  temporalUpscale: true,
})
await cloud.readyPromise
cloud.setOptions({ coverage: 0.4 })
cloud.hide()
cloud.show()
// 离开云场景或切换到其他天气前释放
cloud.destroy()
```

噪声和大气资源随独立包发布，并由 `CloudUltraEffect` 自动加载，无需配置 `assetUrl`、复制资源或引入 `cloudUltraAssets` 插件。仅安装 `b-map-viewer` 不会下载这些资源；安装 Ultra 包后，其资源仍会占用本地空间，创建效果时才请求资源模块。

Vite 应用继续使用 `vite-plugin-cesium` 处理 Cesium 自身的运行时资源。直接以 UMD 脚本使用时，全局入口为 `BMapViewerCloudUltra.CloudUltraEffect`，部署时需保留 `dist` 下入口脚本与 `assets` 的相对目录关系。
