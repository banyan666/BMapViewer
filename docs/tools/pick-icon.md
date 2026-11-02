# pickPointIcon 图标点拾取

`pickPointIcon` 使用 Billboard 图标标记拾取位置，坐标回调和拖拽编辑方式与 `pickPoint` 一致。适合设备选址、事件标记和地图落点。

## 组件案例

在地图上单击放置图标；按住图标拖拽，可以更新其 WGS84 坐标。

<SdkExamplePreview category="pick" example="pick-icon" title="pickPointIcon 图标点拾取" />

## 方法签名

```js
tools.pickPointIcon(callback, data?)
```

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| `callback` | `(coordinates) => void` | 放置或拖拽结束后触发，返回 `[longitude, latitude]` |
| `data` | `[number, number]` | 可选初始坐标 |

图标样式通过构造函数的 `icon` 配置：

| 参数 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `icon.url` | `string` | SDK 内置图标 | 图片 URL、导入后的资源地址或 Data URL |
| `icon.width` | `number` | `32` | 图标显示宽度 |
| `icon.height` | `number` | `32` | 图标显示高度 |

## 使用示例

```js
const tools = new PickTools(viewer, {
  isReserve: true,
  icon: {
    url: '/images/device-marker.png',
    width: 36,
    height: 42,
  },
  mouseHints: {
    show: true,
    text: '左键放置图标',
  },
})

tools.pickPointIcon((coordinates) => {
  console.log('图标坐标：', coordinates)
})
```

## 注意事项

- 图标底部中心与拾取坐标对齐。
- 构造时设置 `includeHeight: true`，拾取及拖拽回调返回 `[longitude, latitude, height]`，高度为当前地形的椭球高，单位固定为米。
- `isReserve: true` 时才会在首次拾取后进入拖拽编辑状态。
- 页面卸载时调用 `destroy()` 清理鼠标事件。

