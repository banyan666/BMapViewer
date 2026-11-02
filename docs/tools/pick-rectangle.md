# pickRectangle 矩形绘制

`pickRectangle` 使用两次单击确定一组对角点，并实时生成经纬线方向对齐的矩形。

## 组件案例

<SdkExamplePreview category="pick" example="pick-rectangle" title="pickRectangle 矩形绘制" />

## 方法签名

```js
tools.pickRectangle(callback, data?)
```

回调包含 `west`、`south`、`east`、`north`、`center`、`width`、`height`、`coordinates` 和 `unit`。边界与顶点采用 WGS84，经纬向宽高按配置 `unit: 'm' / 'km'` 返回，默认米。

```js
const tools = new PickTools(viewer, {
  color: '#ffc85c',
  fillOpacity: 0.28,
  isReserve: true
})

tools.pickRectangle((result) => {
  console.log(result.width, result.height, result.coordinates)
})
```
