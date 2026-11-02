# Build3DLayer 三维建筑

加载 3D Tiles 建筑数据，支持高度渐变、动态扫光，以及按建筑标识设置颜色。颜色可在运行时更新，适用于建筑分类、选中高亮和状态展示。

## 组件案例

<LayerExamplePreview example="build-3d" title="Build3DLayer 三维建筑" :height="500" />

示例默认开启高度渐变、关闭扫光。左键点击修改该建筑的渐变顶部颜色，右键恢复全部建筑颜色。

## 创建图层

```js
import { MapLayers } from 'b-map-viewer'

const layer = new MapLayers.Build3DLayer(viewer, {
  url: '/3d-tiles/tileset.json',
  featureIdProperty: 'id',
  show: true,
  shader: {
    enabled: true,
    gradientEnabled: true,
    sweepEnabled: false,
    minColor: '#09213c',
    maxColor: '#36caff',
    sweepColor: '#a5f6ff',
    modelHeight: 100,
    heightOffset: 0,
    sweepWidth: 0.04,
    speed: 2,
    active: true
  }
})

await layer.load()
layer.flyTo()
```

### 构造参数

| 字段 | 默认值 | 作用 |
| --- | --- | --- |
| `url` | 必填 | `tileset.json` 地址，支持字符串或 `Cesium.Resource` |
| `name` | `'Build3DLayer'` | 图层名称 |
| `show` | `true` | 是否显示 |
| `featureIdProperty` | `'id'` | 建筑标识对应的元数据字段 |
| `options` | `{}` | `Cesium3DTileset.fromUrl` 的加载参数，如 `maximumScreenSpaceError` |
| `shader` | `false` | 内置着色效果；可传布尔值或下表配置 |
| `style` | 无 | 原生 3D Tiles 样式；仅在内置着色效果关闭时应用 |

不配置 `shader` 时保留模型原有材质。加载白膜数据即可显示白膜；不会将已有纹理的模型强制改白。

### shader 参数

| 字段 | 默认值 | 作用 |
| --- | --- | --- |
| `enabled` | `false` | 开启内置着色效果 |
| `gradientEnabled` | `true` | 开启高度渐变 |
| `sweepEnabled` | `false` | 开启扫光条带 |
| `active` | `true` | 播放扫光动画；关闭时停留在当前帧 |
| `minColor` | `'#09090e'` | 低处颜色 |
| `maxColor` | `'#0080ff'` | 高处颜色 |
| `sweepColor` | `'#00aeeb'` | 扫光颜色 |
| `modelHeight` | `100` | 渐变高度范围，必须大于 0 |
| `heightOffset` | `0` | 高度计算偏移，可为负数 |
| `sweepWidth` | `0.02` | 扫光条带宽度，必须大于 0 |
| `speed` | `2` | 扫光速度；值越大越快，0 表示静止，2 约为每 5 秒循环一次 |

三种着色颜色支持 CSS 颜色或 `Cesium.Color`，使用其 RGB 分量。高度按模型局部 Z 轴计算；`heightOffset` 只调整着色位置，不移动模型。

## 按建筑标识改色

```js
// ID 取自 3D Tiles 元数据中的 featureIdProperty 字段。
// 渐变开启时，修改的是该建筑的 maxColor。
layer.setFeatureColor('building-001', '#ffb347')
layer.setFeatureColor('building-002', 'rgba(255, 90, 90, 0.8)')

// 全量替换改色列表，未出现在新列表中的建筑恢复原色。
layer.setFeatureColors([
  { id: 'building-001', color: '#ffb347' },
  { id: 'building-003', color: '#38d9a9' }
])

layer.clearFeatureColor('building-001')
layer.clearFeatureColors()
```

改色方法可以在加载前调用；瓦片重新进入视野后仍会应用已设置的颜色。数字和字符串标识统一按字符串匹配；相同标识的建筑一并改色。没有对应元数据标识的建筑不会被匹配。

渐变开启时，改色只替换对应建筑的 `maxColor`，保留 `minColor`、高度渐变和扫光效果，不影响其他建筑。清除后恢复图层配置的 `maxColor`。

渐变关闭时，改色作为建筑的基础颜色；若扫光开启，仍会叠加扫光。内置着色器关闭时则直接使用建筑颜色。图层只接收标识与颜色，状态与颜色的对应关系由调用方组织。

```js
// 将外部数据转换成颜色列表。
const colors = records.map((item) => ({
  id: item.id,
  color: colorByCategory[item.category]
}))
layer.setFeatureColors(colors)

// 返回已配置的 Cesium.Color 副本；未配置时返回 undefined。
const color = layer.getFeatureColor('building-001')

// 仅返回当前已加载的 Feature；瓦片卸载后应重新获取，不要长期持有。
const features = layer.getFeaturesById('building-001')
```

## 动态调整效果

```js
layer.setShader({ sweepEnabled: true, speed: 3, sweepWidth: 0.06, sweepColor: '#ffffff' })
layer.setShader({ gradientEnabled: true, sweepEnabled: false })
layer.setShader({ gradientEnabled: false, sweepEnabled: true })
layer.stop()           // 暂停动画
layer.start()          // 继续动画
layer.resetTime()      // 从起始帧播放
layer.setShader(false) // 关闭全部内置效果，保留建筑改色
layer.setShader(true)  // 使用当前配置重新开启
const options = layer.getShaderOptions()
```

`setShader(options)` 合并当前配置，并默认开启效果；显式传入 `enabled: false` 可保持关闭。

首次调用 `setShader()` 或使用 `shader: true` 时仅开启渐变，扫光需要显式设置 `sweepEnabled: true`。`start()` 只恢复动画，不会自动开启已关闭的扫光。

## 原生样式

```js
// 可传颜色条件数组、原生样式对象或 Cesium3DTileStyle。
layer.setStyle([
  ["${Height} >= 60", "color('#36caff')"],
  ['true', "color('#d6e5f5')"]
])
layer.setStyle(null) // 清除原生样式
```

`setStyle` 切换到原生样式模式并关闭内置着色器；`setShader` 开启后暂停原生样式，再次关闭则恢复原生样式。两种模式下都可使用建筑改色方法。

## 加载与清理

| 方法 | 作用 |
| --- | --- |
| `load(url?)` | 加载并返回 Tileset；相同地址不重复创建 |
| `getTileset()` | 获取当前 Tileset，未加载时返回 null |
| `flyTo(duration?, options?)` | 定位图层，默认飞行 1.2 秒；options 支持原生包围球飞行配置 |
| `show() / hide()` | 显示或隐藏图层；隐藏时暂停内部动画更新 |
| `clearLayer()` | 移除模型并释放监听和着色器，保留配置及改色列表，可再次加载 |
| `destroy()` | 销毁图层并清空改色列表 |
| `isDestroyed()` | 判断图层是否已销毁 |

新地址加载成功后替换旧模型；请求失败保留旧模型。清理、销毁或后续加载会使尚未结束的旧请求失效，旧请求以 `AbortError` 结束。

```js
try {
  await layer.load()
} catch (error) {
  if (error.name !== 'AbortError') throw error
}

// 页面卸载或切换示例时：
layer.destroy()
```

## 旧版调用迁移

不再接收 `alertList`、`alertKey` 或写入建筑业务属性。请将外部数据映射为 `{ id, color }`，使用 `setFeatureColors` 更新。旧版 `minInterval`、`maxInterval` 改为固定的 0–1 归一化范围，可通过 `modelHeight` 与 `heightOffset` 调整渐变。
