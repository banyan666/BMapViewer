# PolygonPrimitiveLayer 高性能面图层

`PolygonPrimitiveLayer` 类使用 Cesium 的 `Primitive` API 来渲染多边形面几何体（Polygon/MultiPolygon）。相比 Entity API，它在渲染大量面数据时性能更优，且内置了自动描边功能。
## 组件案例

<LayerExamplePreview example="polygon-primitive" title="PolygonPrimitiveLayer 高性能面" />
## 构造函数

`new PolygonPrimitiveLayer(viewer, config)`

| 参数 | 类型 | 描述 |
| :--- | :--- | :--- |
| viewer | object | Cesium Viewer 实例 |
| config | object | 全局样式配置项 |

### config 参数说明

| 参数 | 类型 | 默认值 | 描述 |
| :--- | :--- | :--- | :--- |
| color | string | '#ffffff' | 默认填充及描边颜色 |
| opacity | number | 0.6 | 面的透明度 (0-1) |
| lineWidth | number | 2 | 描边线条宽度（单位：像素） |
| height | number | 0 | 面及描边相对于地球椭球面的高度（单位：米），可用于错开叠加面的渲染高度 |
| clampToGround | boolean | false | 将面及描边贴合真实地形，启用后忽略 `height` |
| showOutline | boolean | true | 是否显示边界描边 |

## 方法说明

### setData(data)
- 参数：`data` (Array) - 符合 [数据规范](/data.html#面) 的面数据数组。支持 `Polygon` 和 `MultiPolygon`。
- 描述：清空当前图层并使用高性能 Primitive 重新加载面数据，同时自动生成对应的边界描边。

### getLayerById(id)
- 参数：`id` (string) - 面的唯一标识符。
- 返回值：`Cesium.GeometryInstanceAttributes`
- 描述：获取指定 ID 的面对象（几何体实例属性）。

### getLayerDataById(id)
- 参数：`id` (string) - 面的唯一标识符。
- 返回值：`Object`
- 描述：根据 ID 在原始 `data` 数组中查找对应的原始数据项。

### clearLayer()
- 描述：从场景中安全移除当前的面 Primitive 和线 Primitive。

### show() / hide()
- 描述：控制图层（面及描边）的整体显示与隐藏。

### destroy()
- 描述：销毁图层并释放资源。

## 使用示例

```js
import { MapLayers } from "b-map-viewer";

// 1. 初始化高性能面图层
const polygonLayer = new MapLayers.PolygonPrimitiveLayer(viewer, {
    color: '#00ff00',
    opacity: 0.5,
    lineWidth: 3
});

// 2. 加载数据
polygonLayer.setData([
    {
        geometry: {
            type: 'Polygon',
            coordinates: [
                [
                    [125.80, 44.17],
                    [125.87, 44.17],
                    [125.87, 44.11],
                    [125.80, 44.11],
                    [125.80, 44.17]
                ]
            ]
        },
        properties: {
            id: 'p-region-1',
            name: '示例区域'
        }
    }
]);

// 3. 隐藏图层
// polygonLayer.hide();
```

## 注意事项
- **自动闭合**：对于传入的坐标环，如果首尾点不一致，组件在生成描边时会自动闭合。
- **复合几何体**：支持 `MultiPolygon` 类型，会自动解析并将所有子多边形组合。
- **性能细节**：该图层使用了 `PerInstanceColorAppearance`，允许每个实例拥有独立的颜色，但材质效果固定，也支持在`properties`中定义单独面的颜色。
