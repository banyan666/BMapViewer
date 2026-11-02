# pickEllipse 椭圆绘制

`pickEllipse` 第一次单击确定中心，第二次单击确定局部东西与南北方向半径。请沿斜向移动鼠标，以同时获得有效的长轴和短轴。

## 组件案例

<SdkExamplePreview category="pick" example="pick-ellipse" title="pickEllipse 椭圆绘制" />

## 方法签名

```js
tools.pickEllipse(callback, data?)
```

回调包含 `eastRadius`、`northRadius`、`semiMajorAxis`、`semiMinorAxis`、`rotation`、`center`、`control` 和 `unit`。半轴与方向半径按配置 `unit: 'm' / 'km'` 返回，默认米；`rotation` 仍为弧度。

使用尺寸初始化椭圆时，半轴和方向半径采用实例配置的 `unit`，也可以通过初始数据的 `unit` 单独指定。

```js
const tools = new PickTools(viewer, {
  color: '#c89bff',
  fillOpacity: 0.28,
  isReserve: true
})

tools.pickEllipse((result) => {
  console.log(result.semiMajorAxis, result.semiMinorAxis)
})
```
