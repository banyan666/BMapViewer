# pickCircle 圆形绘制

`pickCircle` 第一次单击确定圆心，第二次单击确定圆周控制点，并按椭球表面距离计算半径。

## 组件案例

<SdkExamplePreview category="pick" example="pick-circle" title="pickCircle 圆形绘制" />

## 方法签名

```js
tools.pickCircle(callback, data?)
```

回调格式为 `{ type, center, control, radius, unit }`。`center` 与 `control` 为 WGS84 坐标，`radius` 单位由构造配置 `unit` 指定，支持 `m` / `km`，默认 `m`。

```js
const tools = new PickTools(viewer, {
  unit: 'km', // 半径以 km 返回；默认 m
  color: '#56e8e2',
  fillOpacity: 0.25,
  isReserve: true
})

tools.pickCircle((result) => {
  console.log(result.center, result.radius, result.unit)
})
```

传入 `{ center, radius }` 初始化圆时，半径同样采用实例配置的单位，也可通过 `data.unit` 单独指定。传入完整回调结果重新编辑时，保留原始圆心和控制点，不会重复换算。

```js
tools.pickCircle(console.log, { center: [125.823, 44.148], radius: 1 }) // 半径 1 km
```

配合 [`SpatialAnalysis.getCircleArea`](/analysis/circle-area) 使用时，将两者的 `unit` 设置为同一单位即可直接传入拾取半径。
