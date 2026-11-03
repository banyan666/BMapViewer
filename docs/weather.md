# 天气系统

`WeatherEffects` 是 BMapViewer 的天气模块，提供雨、雪、距离雾、高度雾、沙尘、体积云和闪电。常规效果使用 Cesium 后处理；`CloudUltraEffect` 使用独立的多阶段世界空间体积云管线，加入大气散射、级联阴影和时间抗锯齿。

[打开在线天气示例](https://banyan666.github.io/BMapViewer/#/weather)

天气实验室使用 ArcGIS World Imagery 影像；高度雾案例额外通过 `BaseMaps.CesiumTerrain` 加载 Cesium World Terrain，并默认定位到山地，便于观察山谷积雾和山峰露出雾层的效果。

## 天气案例目录

| 效果 | 实现类 | 重点能力 | 文档与实时案例 |
| --- | --- | --- | --- |
| 降雨 | `RainEffect` | 方向、速度、密度、粗细和风偏 | [查看降雨](/weather/rain) |
| 降雪 | `SnowEffect` | 多尺度雪花、飘移和粒径 | [查看降雪](/weather/snow) |
| 距离雾 | `FogEffect` | 深度距离、能见度和雾色 | [查看距离雾](/weather/fog) |
| 高度雾 | `HeightFogEffect` | 沿视线积分、雾层高程、密度和透明度 | [查看高度雾](/weather/height-fog) |
| 沙尘 | `SandstormEffect` | 暖色颗粒、扰动和低能见度 | [查看沙尘](/weather/sandstorm) |
| 体积云 | `CloudEffect` | 世界空间云壳、视差、云量和风场 | [查看体积云](/weather/cloud) |
| 体积云 Ultra | `CloudUltraEffect` | 多层云、大气散射、级联云影与时间抗锯齿 | [查看 Ultra 体积云](/weather/cloud-ultra) |
| 雷雨闪电 | `RainEffect` | 细雨与程序化闪电组合 | [查看雷雨闪电](/weather/lightning) |

## 快速开始

使用 `WeatherSystem` 管理一个活动天气效果。调用 `switch` 时，当前效果会先被销毁，因此不会产生重复叠加。

```js
import { WeatherEffects } from 'b-map-viewer'

const weather = new WeatherEffects.WeatherSystem(viewer, {
  type: 'rain',
  intensity: 0.5,
  density: 1,
  speed: 1,
  size: 1,
  angle: -22.9183,
  wind: 0,
  color: '#99b3ccff',
  lightning: true,
  lightningMixFactor: 0.35,
  lightningFallInterval: 0.8,
})

weather.switch('snow', {
  intensity: 0.5,
  density: 1,
  speed: 1,
  size: 1,
  angle: 18.4349,
  drift: 1,
})

// 页面卸载时释放后处理阶段
weather.destroy()
```

## 独立效果类

需要单独控制效果，或希望同时组合多个天气阶段时，可以直接实例化效果类：

```js
const fog = new WeatherEffects.FogEffect(viewer, {
  mode: 'depth',
  intensity: 0.5,
  depthStart: 0.22,
  depthRange: 0.2,
  density: 0.65,
  skyAmount: 0.55,
  color: '#ccccccff',
})

fog.hide()
fog.show()
fog.setOptions({ depthStart: 0.26, density: 0.8 })
fog.destroy()
```

模块提供以下类：

| 类型 | 类 | 主要参数 | 说明 |
| --- | --- | --- | --- |
| `rain` | `RainEffect` | `intensity`、`density`、`speed`、`size`、`angle`、`wind`、`lightning`、`color` | 可调整方向、粗细和风偏，并可启用闪电的透视雨线 |
| `snow` | `SnowEffect` | `intensity`、`density`、`speed`、`angle`、`size`、`drift`、`color` | 多尺度飘雪与横向漂移 |
| `fog` | `FogEffect` | `intensity`、`depthStart`、`depthRange`、`density`、`skyAmount`、`color` | 按深度阈值混合雾色，并兼容旧版米制距离模式 |
| `height-fog` | `HeightFogEffect` | `fogHeight`、`density`、`brightness`、`startDistance`、`maxOpacity`、`color` | 视线投影积分产生山谷积雾，并统一调整场景与雾色亮度 |
| `sandstorm` | `SandstormEffect` | `intensity`、`density`、`speed`、`wind`、`color` | 暖色颗粒、扰动与低能见度合成 |
| `cloud` | `CloudEffect` | `coverage`、`baseHeight`、`topHeight`、`scale`、`speed`、`windDirection`、`steps` | 世界空间光线步进生成具有视差的体积云 |
| `cloud-ultra` | `CloudUltraEffect` | `coverage`、`layers`、`windSpeed`、`steps`、`temporalUpscale` | 自动管理资源的高质量多阶段体积云 |
| `lightning` | `LightningEffect` | `intensity`、`frequency`、`brightness`、`width`、`color` | 随机闪光和分叉闪电纹理 |

`createWeatherEffect(viewer, type, options)` 也可以按类型创建效果；`sand` 是 `sandstorm` 的别名。

```js
const effect = WeatherEffects.createWeatherEffect(viewer, 'cloud', {
  coverage: 0.58,
  speed: 0.14,
})
```

## 雨雪方向、大小、速度与密度

雨和雪的方向参数使用角度制，运行期间可以通过 `setOptions` 即时调整，不需要重新创建后处理阶段。默认值对应参考文件中原来写死的着色器常量：

| 效果 | 默认值与原始常量的对应关系 |
| --- | --- |
| 雨 | `angle: -22.9183` 对应 `-0.4` 弧度；`density: 1` 对应 `uv.x * 100`；`size: 1` 对应阈值 `0.95`；`intensity: 0.5` 对应混合比例 `0.5` |
| 雪 | `density: 1` 保留 `10/8/6/5` 四层尺度；`angle: 18.4349` 对应原始 `(1, 3)` 位移方向；`size: 1` 保留原始粒径；`intensity: 0.5` 对应混合比例 `0.5` |

```js
const rain = new WeatherEffects.RainEffect(viewer)

rain.setOptions({
  angle: -38,   // 屏幕空间方向，单位：度
  speed: 1.8,   // 动画速度倍率
  density: 1.2, // 雨线密度
  size: 0.65,   // 雨线粗细，小于 1 时比默认更细
  wind: 0.55,   // 雨线随时间产生的横向风偏
  lightning: true,
  lightningMixFactor: 0.35,
  lightningFallInterval: 0.8,
})
```

| 参数 | 雨 | 雪 | 说明 |
| --- | --- | --- | --- |
| `angle` | `-180～180` | `-180～180` | 降水在屏幕空间中的旋转角度 |
| `speed` | `0.05～5` | `0.05～5` | 时间推进倍率，数值越大下落越快 |
| `density` | `0.1～3` | `0.1～3` | 雨线列数或雪花网格密度，`1` 为原始配置 |
| `wind` / `drift` | `-2～2` | `-2～2` | 横向漂移幅度 |
| `size` | `0.1～3` | `0.1～3` | 雨线粗细或雪花粒径倍率，`1` 为原始配置 |

### 降雨中的闪电

`RainEffect` 内部按“雨效 → 闪电”的顺序组合后处理阶段。闪电默认关闭；将 `lightning` 设置为 `true` 后启用，运行期间也可以直接切换，不需要重新创建雨效。

天气实验室中的“降雨”案例只展示纯降雨；“闪电”案例则创建同一个 `RainEffect`，并通过 `lightning: true` 展示完整雷雨效果。

```js
const rain = new WeatherEffects.RainEffect(viewer, {
  lightning: true,
  lightningMixFactor: 0.35,
  lightningFallInterval: 0.8,
})

rain.setOptions({ lightning: false }) // 关闭闪电，仅保留降雨
rain.setOptions({ lightning: true })  // 再次开启闪电
```

| 参数 | 默认值 | 说明 |
| --- | --- | --- |
| `lightning` | `false` | 是否启用雨中的闪电后处理阶段 |
| `lightningMixFactor` | `0.35` | 闪电画面与雨景的混合比例，范围 `0～1` |
| `lightningFallInterval` | `0.8` | 闪电事件的时间推进间隔，范围 `0.01～1` |

闪电部分保留了参考算法的两层哈希噪声、8 次 FBM、100 段电弧路径和蓝色云层闪光，并适配为 Cesium 1.118 使用的 WebGL 2 后处理语法。

雾使用 `near` 和 `far` 控制相机距离范围：`near` 之前不混合雾色，接近 `far` 时达到主要雾化区间。旧版 `visibility` 参数仍作为 `far` 的兼容别名。

## 公共生命周期

所有效果类都遵循相同的 SDK 生命周期：

| 方法 | 返回值 | 说明 |
| --- | --- | --- |
| `load(options?)` | `PostProcessStage` | 重新创建并加载效果阶段 |
| `setOptions(options)` | 当前实例 | 运行时更新参数，无需重建阶段 |
| `getOptions()` | `object` | 获取当前配置副本 |
| `getStage()` | `PostProcessStage` | 获取 Cesium 后处理阶段 |
| `show()` / `start()` | 当前实例 | 启用效果 |
| `hide()` / `stop()` | 当前实例 | 暂停效果但保留阶段 |
| `remove()` | - | 从 Viewer 中移除阶段，实例仍可再次 `load` |
| `destroy()` | - | 永久销毁实例并释放引用 |
| `isDestroyed()` | `boolean` | 判断实例是否已销毁 |

`CloudUltraEffect` 沿用上述方法名称，但 `load()` 返回 Promise，需通过 `readyPromise` 等待异步准备；`getStage()` 返回多阶段管线。其 `hide()` 会暂停管线并恢复原天空和光照，`remove()` 会释放纹理与 Worker。详见 [Ultra 体积云](/weather/cloud-ultra)。

## WeatherSystem API

```js
const system = new WeatherEffects.WeatherSystem(viewer)

system.load('rain', options)
system.switch('fog', options)
system.setOptions({ density: 0.5 })
system.hide()
system.show()
system.remove()
system.destroy()
```

`WeatherSystem` 只管理一个活动效果。如果需要雨雾叠加，请分别创建 `RainEffect` 和 `FogEffect`，并在页面卸载时逐一销毁。

## 使用建议

- 强度、密度等数值会在 SDK 内部限制到安全范围，编辑示例时仍建议逐步调整。
- 雾效果会读取深度纹理；浏览器和显卡需要支持 Cesium WebGL 深度纹理能力。
- 常规天气使用全屏后处理，Ultra 体积云使用多阶段渲染管线。叠加多个高密度效果会增加片元着色开销，移动设备建议同时启用不超过两个效果。
- 颜色支持 CSS 色值和带透明度的十六进制色值，例如 `#99b3ccff`。
- Vue 组件应在 `onBeforeUnmount` 中调用 `destroy()`，避免路由切换后保留后处理阶段。

天气实验室为每种效果提供可编辑代码。左侧展开代码面板后，可直接修改参数并使用 `Ctrl + Enter` 重新运行。常规天气采用低空斜视镜头，高度雾采用山地斜视镜头；均保留天空区域，便于观察天气效果、空间纵深和地表底图。

雨、雪、雾的着色器结构参考并扩展自 [Cesium-Examples weatherEffects.js](https://github.com/jiawanlong/Cesium-Examples/blob/main/examples/cesiumEx/weatherEffects.js)：保留屏幕空间雨线、多尺度雪层和深度雾的思路，同时适配 Cesium 1.118 的 WebGL 2 后处理语法，并将固定常量改为可更新的 uniform。
