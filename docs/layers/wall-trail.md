# WallTrailLayer 流动墙体

`WallTrailLayer` 用于展示电子围栏、区域边界与警戒墙，通过沿高度方向循环的栅栏纹理表现动态效果。支持配置墙体颜色、透明度、高度、流动方向与速度。

## 组件案例

<LayerExamplePreview example="wall-trail" title="WallTrailLayer 流动墙体" :height="500" />


## 用法

```js
const layer = new MapLayers.WallTrailLayer(viewer, {
  color: '#33cc66', opacity: 0.7,
  height: 250, baseHeight: 0,
  speed: 3, direction: 'up',
})
layer.setData([{
  geometry: {
    type: 'Polygon',
    coordinates: [[
      [125.829, 44.1448], [125.839, 44.1448],
      [125.839, 44.1502], [125.829, 44.1502],
      [125.829, 44.1448],
    ]],
  },
  properties: { id: 'wall-1', name: '流动围墙' },
}])

layer.setOptions({ speed: 5, direction: 'down' })
// layer.stop(); layer.start()
// 退出页面时：layer.destroy()
```

## 配置

| 字段 | 默认值 | 作用 |
| --- | --- | --- |
| `color` | `'#33cc66'` | CSS 颜色或 `Cesium.Color` |
| `opacity` | `0.7` | 透明度，0～1，与颜色 alpha 相乘 |
| `height` | `250` | 二维坐标的墙高，米，须大于 0 |
| `baseHeight` | `0` | 墙底椭球高，米，支持负数 |
| `speed` | `3` | 流动速度，0 为静止；1 约每秒前进 0.06 个周期 |
| `direction` | `'up'` | `'up'` 向上、`'down'` 向下 |
| `repeat` | `1` | 竖向光带周期数，正整数 |
| `brightness` | `3` | 亮度倍率，非负数 |
| `image` | 内置 `wall-fence.png` | 墙体纹理图片地址 |
| `closed` | `false` | 是否自动闭合线数据；面数据始终闭合 |
| `autoStart` | `true` | 是否自动播放；通过 setOptions 修改时同步切换播放状态 |

同名 `properties` 字段优先于图层配置，用于单项颜色、透明度、高度与流动样式。播放开关由图层统一控制。

## 数据规范

使用 SDK `{ geometry, properties }` 数组，支持 `LineString`、`MultiLineString`、`Polygon`、`MultiPolygon`；面中的外环与内环分别生成墙体。业务 ID 可为字符串或数字，同一图层内不得重复；未传 ID 时自动生成。

坐标为 WGS84 `[经度, 纬度, 顶部高程?]`。二维坐标的顶高为 `baseHeight + height`；第三维存在时直接作为该点的绝对顶高，须高于墙底。`Polygon` 无需手动重复首点，图层会自动闭合；闭合环至少包含 3 个不同点，开放线至少包含 2 个。

```js
layer.addLayer({
  geometry: {
    type: 'LineString',
    coordinates: [[125.81, 44.13, 300], [125.82, 44.14, 600], [125.83, 44.135, 450]],
  },
  properties: { id: 'variable-wall', color: '#00e7ff', baseHeight: 20, speed: 5 },
})
```

## 方法

| 方法 | 作用 |
| --- | --- |
| `setData(data)` | 校验后替换全部数据，并重置动画时间；保留当前播放与显隐状态 |
| `addLayer(item)` | 增加一项，返回 Entity 或多部分 Entity 数组 |
| `setOptions(options)` / `getOptions()` | 更新全局配置 / 获取配置；单项样式优先 |
| `getLayerById(id)` / `getLayersById(id)` | 获取业务项的首个 / 全部 Entity |
| `getLayerDataById(id)` | 获取业务项数据 |
| `removeLayer(entity)` | 移除该 Entity 所属的完整业务项 |
| `removeLayerById(id)` | 按业务 ID 移除，返回移除的 Entity 数量 |
| `start()` / `stop()` | 播放或继续 / 暂停；重复调用不叠加监听 |
| `resetTime()` | 重置光带相位 |
| `show()` / `hide()` | 显示并恢复原播放状态 / 隐藏并冻结动画 |
| `clearLayer()` | 清空本图层数据与实体，并移除动画监听 |
| `destroy()` / `isDestroyed()` | 销毁 / 检查销毁状态 |

动画按真实经过时间推进，不依赖帧率或 Cesium 时钟倍率；开启 `requestRenderMode` 时也会主动请求渲染。图层不改变 Viewer 的地形、深度检测、时钟或其他业务实体。需要真实地形遮挡时，可由应用开启 `viewer.scene.globe.depthTestAgainstTerrain`，并按地形高程配置墙底。
