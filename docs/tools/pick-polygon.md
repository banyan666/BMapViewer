# pickPolygon 多边形绘制

`pickPolygon` 用于拾取三个以上顶点并创建闭合区域。绘制过程中会实时显示边界和填充预览，适合圈选范围、规划区域和空间查询输入。

## 组件案例

左键依次添加顶点，双击闭合并结束绘制；至少需要三个点。

<SdkExamplePreview category="pick" example="pick-polygon" title="pickPolygon 多边形绘制" />

## 方法签名

```js
tools.pickPolygon(callback, data?)
```

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| `callback` | `(coordinates) => void` | 完成绘制或节点编辑后触发 |
| `data` | `Array<[number, number]>` | 可选初始顶点数组 |

## 使用示例

```js
const tools = new PickTools(viewer, {
  color: '#69b9ff',
  lineWidth: 3,
  pointSize: 10,
  isReserve: true,
  mouseHints: {
    show: true,
    text: '左键添加顶点，双击结束',
  },
})

tools.pickPolygon((coordinates) => {
  console.log('多边形顶点：', coordinates)
})
```

## 数据衔接

回调返回的是顶点数组，可以直接转换为 GeoJSON Polygon；构造 GeoJSON 时需要将首个坐标再次追加到末尾形成闭合环。

构造时设置 `includeHeight: true`，拾取及拖拽回调返回三维顶点数组 `[[longitude, latitude, height], ...]`，高度单位固定为米，并默认拾取当前地形表面。不设置时保持原来的二维坐标格式。

```js
const ring = [...coordinates, coordinates[0]]
const polygon = {
  type: 'Feature',
  properties: {},
  geometry: { type: 'Polygon', coordinates: [ring] },
}
```

页面卸载时调用 `tools.destroy()`，并按业务需要清理由工具保留的 Entity。

