# FlowLineLayer 流动线图层

`FlowLineLayer` 使用 `PolylineGeometry` 和自定义流动材质，在线路上呈现沿坐标方向移动的渐变光段。支持普通流动和增强脉冲，适用于交通线路、管网流向与数据传输路径。

## 组件案例

<LayerExamplePreview example="flow-line" title="FlowLineLayer 流动线" />


## 构造函数

`new MapLayers.FlowLineLayer(viewer, config)`

| 字段 | 类型 | 默认值 | 作用 |
| --- | --- | --- | --- |
| `type` | `string` | `'flow'` | `'flow'` 普通流动，`'enhanced'` 增加脉冲和边缘发光 |
| `color` | CSS 颜色或 `Cesium.Color` | `'#b5ff33'` | 线路颜色 |
| `width` | `number` | `3` | 线宽，单位为像素 |
| `opacity` | `number` | `0.8` | 透明度，范围 0–1，与颜色自身的 alpha 相乘 |
| `speed` | `number` | `5` | 流动速度；正值沿坐标顺序流动，负值反向，0 停止 |
| `percent` | `number` | `0.15` | 光段占整条线路的比例，范围 0.001–1 |
| `gradient` | `number` | `0.4` | 尾部渐变长度占光段的比例，范围 0.001–1 |
| `pulse` | `number` | `0.5` | 增强模式的脉冲频率，0 关闭脉冲 |
| `backgroundAlpha` | `number` | `0.8` | 非光段部分的相对透明度，范围 0–1，0 隐藏底线 |
| `brightness` | `number` | `1` | 整体自发光亮度倍率，范围 0–10 |
| `glowStrength` | `number` | `1.5` | 移动光段的额外发光强度，范围 0–10，0 关闭额外发光 |
| `glowColor` | CSS 颜色或 `Cesium.Color` | `'#00e7ff'` | 移动光段的发光颜色，颜色 alpha 控制额外发光量 |
| `height` | `number` | `0` | 未提供顶点高度时使用的海拔高度，单位为米 |
| `autoStart` | `boolean` | `true` | 加载线路后是否自动播放 |
| `allowPicking` | `boolean` | `true` | 是否允许拾取线路 |

## 数据格式

使用 SDK 的 [线数据规范](/data#线)，支持 `LineString` 和 `MultiLineString`。顶点坐标为 `[经度, 纬度, 高度?]`，`properties` 可覆盖构造配置中的样式字段；`autoStart` 为整个图层的播放设置。

```js
import { MapLayers } from 'b-map-viewer'

const layer = new MapLayers.FlowLineLayer(viewer, {
  type: 'enhanced',
  color: '#0099ff',
  width: 5,
  speed: 5,
  percent: 0.22,
  gradient: 0.7,
  backgroundAlpha: 0.8,
  brightness: 1.15,
  glowStrength: 2,
  glowColor: '#00e7ff',
  height: 8,
})

layer.setData([
  {
    geometry: {
      type: 'LineString',
      coordinates: [[125.815, 44.154], [125.828, 44.147], [125.839, 44.151]],
    },
    properties: { id: 'flow-a', name: '输送线路' },
  },
  {
    geometry: {
      type: 'MultiLineString',
      coordinates: [
        [[125.821, 44.139], [125.833, 44.144], [125.848, 44.156]],
        [[125.833, 44.144], [125.840, 44.138]],
      ],
    },
    properties: { id: 'flow-b', color: '#ffd46b', speed: -4, type: 'flow' },
  },
])

layer.setOptions({ percent: 0.3, opacity: 0.7 })
```

## 方法

| 方法 | 作用 |
| --- | --- |
| `setData(features)` | 替换全部线路，返回图层实例 |
| `addLayer(feature)` | 添加一项线数据，返回对应 `Cesium.Primitive` |
| `setOptions(options)` | 更新全局配置；数据中单独设置的字段优先 |
| `getLayerById(id)` | 获取对应 Primitive |
| `getLayerDataById(id)` | 获取对应原始数据 |
| `removeLayer(primitive)` / `removeLayerById(id)` | 移除指定线路 |
| `start()` / `stop()` | 播放或暂停流动，暂停时保留当前位置 |
| `show()` / `hide()` | 显示或隐藏全部线路 |
| `clearLayer()` | 清空线路并释放渲染监听和动画定时器 |
| `destroy()` | 清理线路、动画资源和 Viewer 引用 |

流动速度按实际时间计算。`speed: 5` 约每 3.33 秒完成一个周期。颜色、速度及渐变参数通过材质更新，线宽和默认高度变化时会重建线几何。线路使用绝对海拔高度；需要展示在地形上方时，应提供对应的顶点高度。
