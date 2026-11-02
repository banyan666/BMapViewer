# pickPoint 点拾取

`pickPoint` 用于从 Cesium 地球表面获取一个 WGS84 经纬度坐标。设置 `isReserve: true` 后，拾取点会保留在场景中，并支持拖拽调整位置。

## 组件案例

在地图上单击放置点位；按住已生成的点拖拽，可以再次更新位置。

<SdkExamplePreview category="pick" example="pick-point" title="pickPoint 点拾取" />

## 方法签名

```js
tools.pickPoint(callback, data?)
```

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| `callback` | `(coordinates) => void` | 拾取或拖拽结束后触发，返回 `[longitude, latitude]` |
| `data` | `[number, number]` | 可选初始坐标；传入后直接创建点并进入编辑状态 |

## 使用示例

```js
import { PickTools } from 'b-map-viewer'

const tools = new PickTools(viewer, {
  color: '#69b9ff',
  pointSize: 12,
  isReserve: true,
  mouseHints: {
    show: true,
    text: '左键拾取点位',
  },
})

tools.pickPoint((coordinates) => {
  console.log('WGS84 坐标：', coordinates)
})

// 页面卸载时
tools.destroy()
```

## 注意事项

- 默认拾取椭球表面并返回二维坐标；构造时设置 `includeHeight: true`，默认改为拾取地形并返回 `[longitude, latitude, height]`，高度单位为米。
- 拖拽期间工具会暂时关闭相机旋转、平移和缩放，松开鼠标后自动恢复。
- 不需要保留点位时，将 `isReserve` 设为 `false`。

