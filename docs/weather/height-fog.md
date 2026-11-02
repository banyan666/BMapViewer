# HeightFogEffect 高度雾

`HeightFogEffect` 通过场景深度重建世界坐标，并结合视线方向、高程和距离计算深度高度雾。采用 `FogDemo` 的视线投影积分与亮度合成，呈现山谷积雾、山峰露出的效果；它与仅按距离或深度混合的 `FogEffect` 是两个独立效果。

## 组件案例

<SdkExamplePreview category="weather" example="height-fog" title="HeightFogEffect 山地高度雾" height="500px" />

案例使用 `BaseMaps.CesiumTerrain` 加载 Cesium World Terrain，并叠加 ArcGIS 影像。默认镜头定位到 `110.479, 29.327` 附近的张家界山地；切换案例时恢复原地形。可在示例编辑器中修改雾层高程、浓度、亮度和颜色。

## 构造参数

```js
new WeatherEffects.HeightFogEffect(viewer, options)
```

| 字段 | 默认值 | 作用 |
| --- | --- | --- |
| `fogHeight` | `900` | 雾层顶部高程，米；此高度及以上局部密度为零 |
| `baseHeight` | `0` | 线性高度密度的基准高程，米；低于该高程时密度继续增大 |
| `density` | `0.62` | 整体浓度，`0～10`；`0` 关闭雾化 |
| `brightness` | `0.9` | 场景与雾色的整体亮度倍率，`0～2`；`1` 保持原亮度 |
| `startDistance` | `100` | 相机前不参与雾积分的距离，米 |
| `maxDistance` | `100000` | 沿视线参与雾积分的最远距离，米 |
| `maxOpacity` | `1` | 雾色混合比例上限，`0～1` |
| `intensity` | `1` | 混合强度倍率，`0～1` |
| `color` | `#ccd2d6` | CSS 雾色或 `Cesium.Color`，透明通道参与混合 |

`fogHeight` 必须大于 `baseHeight`。两者均为相对椭球的高程，不是距当前地面的高度；例如山谷海拔较高时，应相应提高雾层高程。相机和地表都在雾层顶部以上时，视线段不产生高度雾。

## 使用示例

```js
import { BaseMaps, WeatherEffects } from 'b-map-viewer'

// 已有 Viewer：影像可使用 ArcGIS，高程由 Cesium World Terrain 提供。
const terrain = new BaseMaps.CesiumTerrain(viewer, {
  token: '你的 Cesium ion Token',
  requestVertexNormals: true,
  depthTestAgainstTerrain: true,
})
await terrain.readyPromise

const fog = new WeatherEffects.HeightFogEffect(viewer, {
  fogHeight: 900,
  density: 0.62,
  brightness: 0.9,
  startDistance: 100,
  maxOpacity: 1,
  color: '#ccd2d6',
})

fog.setOptions({ fogHeight: 1100, density: 0.45, brightness: 1 })
fog.hide()
fog.show()

// 页面退出时
fog.destroy()
terrain.destroy()
```

也可直接 `import { HeightFogEffect } from 'b-map-viewer'`，或使用统一管理器：

```js
const weather = new WeatherEffects.WeatherSystem(viewer, {
  type: 'height-fog',
  fogHeight: 900,
  density: 0.62,
  brightness: 0.9,
})
weather.setOptions({ density: 0.45 })
weather.destroy()
```

## 生命周期与实现说明

支持统一的 `load`、`setOptions`、`getOptions`、`getStage`、`show` / `hide`、`start` / `stop`、`remove` 和 `destroy`。`setOptions` 即时更新 uniform，无需重建阶段；实例本身不加载地形、不修改相机、时钟、光照或 Token。

实现对齐 `FogDemo.vue` 所使用的 `FOG_FRAGMENT`：根据视线的竖直投影、近场起雾距离和高程计算线性高度积分，使用 `fog / (fog + 1)` 混合；场景色与雾色统一乘以 `brightness`。默认浓度、雾高、亮度和颜色与本地参考案例一致。

保留已有的 `baseHeight`、`maxDistance`、`maxOpacity` 和 `intensity` 控制项。水平视线使用近似分支避免除以零，向上观察保留投影符号，防止负分母造成整屏异常。天空不参与雾化，但仍受整体亮度控制；将 `brightness` 设为 `1` 可保持原天空亮度。画面 Alpha 保持不变。

需要 Cesium 三维场景和深度纹理支持。高度沿用参考实现的相机局部地球半径近似，适用于区域山地展示；不是全球大气或真实流体模拟。透明对象的雾化取决于其是否写入场景深度。
