# getSurfaceDistance 贴地距离

计算随地形起伏的路径近似距离，输入与输出协议同 [`getProfile`](/terrain/profile)，使用相同的测地线加密和真实地形采样流程。

## 组件案例

<LayerExamplePreview category="terrain" example="surface-distance" title="贴地距离" />

## 用法

```js
const result = await analysis.getSurfaceDistance(coordinates, {
  unit: 'km', sampleSpacing: 40,
})
console.log(result.totalDistance) // 贴地距离，km
console.log(result.horizontalDistance) // 水平距离，km
console.log(result.geometry) // 三维采样折线
```

| 字段 | 作用 |
| --- | --- |
| `totalDistance` | 累计贴地近似距离 |
| `horizontalDistance` | 累计水平测地距离 |
| `unit` | `m` / `km` |
| `samples` | 沿线采样点及累计距离 |

高差统计仍以米返回，不受距离单位影响。不包含建筑表面，不能替代工程测绘。其余字段、精度与取消任务方式见[地形剖面](/terrain/profile)和[总览](/analysis/terrain)。
