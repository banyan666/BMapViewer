# CloudEffect 体积云

`CloudEffect` 在地球上空构建具有真实高度的球形云壳，从相机向云层进行世界空间光线步进，并通过三维噪声计算每个采样点的云密度。移动或旋转镜头时，云体保持在地理空间中并产生视差。

需要多层云、大气散射、级联阴影和时间抗锯齿时，可使用独立的 [CloudUltraEffect 体积云 Ultra](/weather/cloud-ultra)。本类继续保留轻量后处理方案。

## 组件案例

<SdkExamplePreview category="weather" example="cloud" title="CloudEffect 体积云" height="500px" />

## 构造函数

```js
new WeatherEffects.CloudEffect(viewer, options)
```

| 参数 | 默认值 | 范围 | 说明 |
| --- | --- | --- | --- |
| `intensity` | `1` | `0～2` | 云体密度和整体强度 |
| `coverage` | `0.52` | `0～1` | 云量覆盖比例 |
| `baseHeight` | `4800` | `100～50000` | 云底相对地表高度，单位：米 |
| `topHeight` | `8800` | `200～60000` | 云顶相对地表高度，单位：米 |
| `scale` | `1` | `0.2～8` | 世界空间三维噪声尺度 |
| `speed` | `0.55` | `-5～5` | 云体随风运动速度，负值反向移动 |
| `windDirection` | `35` | `-360～360` | 水平风向角，单位：度 |
| `maxDistance` | `160000` | `10000～500000` | 最远体积云计算距离，单位：米 |
| `steps` | `72` | `16～72` | 每条视线的最大采样次数，越高越细腻但开销越大 |
| `color` | `#f1f4f6e6` | CSS 颜色 | 云体颜色和透明度 |

## 使用示例

```js
const cloud = new WeatherEffects.CloudEffect(viewer, {
  intensity: 1,
  coverage: 0.52,
  baseHeight: 4800,
  topHeight: 8800,
  scale: 1,
  speed: 0.55,
  windDirection: 35,
  maxDistance: 160000,
  steps: 72,
  color: '#f1f4f6e6',
})

cloud.setOptions({ coverage: 0.55, speed: 0.3, windDirection: 80 })
```

`setOptions` 会实时更新体积云参数。旧版 `altitude` 参数仍可使用，SDK 会将 `0～1` 的屏幕高度换算为体积云的 `baseHeight` 和 `topHeight`；`cloudBase`、`cloudTop` 和 `windAngle` 也分别兼容映射到新参数。

体积云需要对屏幕像素执行多次三维噪声采样。移动端或集成显卡可以将 `steps` 调整到 `24～40`，桌面独立显卡可使用默认值或提高到 `72`。
