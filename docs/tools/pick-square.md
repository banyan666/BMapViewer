# pickSquare 正方形绘制

`pickSquare` 通过两个对角控制点绘制正方形。第二个点与首点在局部东西、南北方向上的较大距离会作为边长，因此图形始终保持等宽等高。

## 组件案例

<SdkExamplePreview category="pick" example="pick-square" title="pickSquare 正方形绘制" />

## 方法签名

```js
tools.pickSquare(callback, data?)
```

回调结果包含 `center`、`sideLength`、`width`、`height`、四个 WGS84 顶点 `coordinates` 和 `unit`。边长与宽高按配置 `unit: 'm' / 'km'` 返回，默认米；经纬度坐标不变。设置 `isReserve: true` 后，可拖拽两个对角控制点继续编辑。

```js
const tools = new PickTools(viewer, {
  color: '#63e6be',
  fillOpacity: 0.28,
  isReserve: true
})

tools.pickSquare((result) => {
  console.log(result.sideLength, result.coordinates)
})
```
