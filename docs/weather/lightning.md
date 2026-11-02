# RainEffect 雷雨闪电

雷雨案例使用 `RainEffect` 的 `lightning` 开关，在细雨阶段之后组合程序化闪电。该方式可以保证降雨与闪电由同一个实例统一管理。

## 组件案例

<SdkExamplePreview category="weather" example="lightning" title="RainEffect 雷雨闪电" height="500px" />

## 配置参数

```js
new WeatherEffects.RainEffect(viewer, {
  lightning: true,
  lightningMixFactor: 0.35,
  lightningFallInterval: 0.8,
})
```

| 参数 | 默认值 | 范围 | 说明 |
| --- | --- | --- | --- |
| `lightning` | `false` | `boolean` | 开启或关闭闪电阶段 |
| `lightningMixFactor` | `0.35` | `0～1` | 闪电画面与雨景的混合比例 |
| `lightningFallInterval` | `0.8` | `0.01～1` | 闪电时间推进间隔 |

## 使用示例

```js
const thunderstorm = new WeatherEffects.RainEffect(viewer, {
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

thunderstorm.setOptions({ lightning: false }) // 仅保留降雨
thunderstorm.setOptions({ lightning: true })  // 恢复雷雨
```

SDK 也提供独立的 `LightningEffect`，用于不需要降雨的单独闪电阶段；当前组件案例按天气实验室约定展示“降雨 + 闪电”。

