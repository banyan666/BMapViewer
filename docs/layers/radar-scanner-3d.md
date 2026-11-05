# RadarScanner3DLayer 三维雷达扫描图层

展示半透明半球探测范围及旋转扫描扇面，支持批量雷达、独立样式配置和按 ID 管理。

## 组件案例

<LayerExamplePreview example="radar-scanner-3d" title="RadarScanner3DLayer 三维雷达" />

## 使用示例

```js
import { MapLayers } from 'b-map-viewer'

const layer = new MapLayers.RadarScanner3DLayer(viewer, {
  radius: 1500,
  color: '#26f5e5',
  outlineColor: '#a8fff7',
  hemisphereAlpha: 0.16,
  scanAlpha: 0.7,
  speed: 1.35,
  autoStart: true,
})

layer.setData([
  {
    geometry: { type: 'Point', coordinates: [125.834, 44.147, 0] },
    properties: { id: 'jiutai-radar', name: '九台雷达' },
  },
  {
    geometry: { type: 'Point', coordinates: [125.869, 44.165, 100] },
    properties: {
      id: 'east-radar', name: '东侧雷达', radius: 900,
      color: '#69b9ff', speed: -0.8,
    },
  },
])

// layer.stop()
// layer.start()
// layer.hide()
// layer.show()
// layer.removeLayerById('east-radar')
// 页面卸载时：layer.destroy()
```

## 数据格式

`setData(data)` 接收符合 [SDK 数据规范](/data) 的数组。每条数据创建一个雷达，构造函数只设置默认样式，不创建雷达。

| 字段 | 作用 |
| --- | --- |
| `geometry.type` | 固定为 `Point` |
| `geometry.coordinates` | `[经度, 纬度]` 或 `[经度, 纬度, 海拔高度]`，高度单位为米 |
| `properties.id` | 雷达标识，支持字符串和数字，省略时自动生成；同一图层内不能重复 |
| `properties.name` | 雷达名称 |
| `properties` 中的样式字段 | 覆盖当前雷达的同名全局配置 |

坐标第三位优先于 `height` 配置，明确传入 `0` 表示海拔 0 米。数字 ID `0` 有效；数字 `1` 与字符串 `'1'` 视为相同 ID。自定义业务属性会保留在雷达实体的 `properties` 中。

## 配置项

`new MapLayers.RadarScanner3DLayer(viewer, options)`

除 `autoStart` 外，下表字段均可在每条数据的 `properties` 中覆盖。

| 字段 | 类型 | 默认值 | 作用 |
| --- | --- | --- | --- |
| `radius` | number | `1000` | 半球及扫描扇面半径，单位为米，必须大于 0 |
| `height` | number | `0` | 未传坐标第三位时使用的中心海拔高度，单位为米 |
| `color` | string / Cesium.Color | `'#05fbf8'` | 半球和扫描扇面颜色 |
| `speed` | number | `1` | 每次时钟更新的旋转角度；正负值表示相反方向，`0` 表示静止 |
| `heading` | number | `0` | 初始扫描角度，单位为度；`0` 朝东，`90` 朝北 |
| `hemisphereAlpha` | number | `0.5` | 半球透明度，范围 0～1 |
| `scanAlpha` | number | `0.6` | 扫描扇面透明度，范围 0～1 |
| `outline` | boolean | `true` | 是否显示半球轮廓线 |
| `outlineColor` | string / Cesium.Color | `'#f1f105'` | 半球轮廓线颜色 |
| `autoStart` | boolean | `false` | 加载数据后是否自动开始扫描 |

`speed` 沿用时钟逐帧更新方式，不是每秒角速度，实际旋转速度受刷新频率影响。

## 方法

| 方法 | 返回值 | 作用 |
| --- | --- | --- |
| `setData(data)` | 当前图层 | 全量替换数据；空数组清空图层 |
| `addLayer(item)` | Entity | 追加单条 Point 数据，返回半球主体实体 |
| `setOptions(options)` | 当前图层 | 更新全局配置；单条数据的显式配置仍优先 |
| `getOptions()` | object | 获取全局配置副本 |
| `getLayerById(id)` | Entity / null | 获取指定雷达的半球主体 |
| `getLayersById(id)` | Entity[] | 获取指定雷达的半球和扫描扇面 |
| `getLayerDataById(id)` | object / null | 获取指定雷达的 SDK 格式数据 |
| `removeLayer(entity)` | boolean | 传入半球或扫描扇面，删除所属的整个雷达 |
| `removeLayerById(id)` | number | 删除整个雷达，成功返回 `1`，未找到返回 `0` |
| `start()` / `stop()` | 当前图层 | 启动、暂停扫描，暂停时保留当前朝向 |
| `show()` / `hide()` | 当前图层 | 显示、隐藏所有雷达；隐藏期间暂停更新 |
| `setVisible(visible)` | 当前图层 | 设置图层可见性 |
| `clearLayer()` | 当前图层 | 清空数据和实体，移除扫描监听 |
| `destroy()` | — | 销毁图层并移除数据源，可重复调用 |
| `isDestroyed()` | boolean | 查询是否已销毁 |

无效坐标、无效配置或重复 ID 会抛出错误；替换数据前先完成校验，校验失败时保留原数据。图层资源由独立数据源管理，不影响其他图层。

## 旧版调用迁移

不再使用构造参数 `position` 或 `createRadar()` 创建雷达，请将坐标放入 `geometry.coordinates`，通过 `setData()` / `addLayer()` 加载。原来的颜色、半径和扫描参数仍可作为全局默认值传入。
