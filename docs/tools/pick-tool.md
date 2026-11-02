# PickTools 鼠标拾取工具

`PickTools` 类是一个交互式绘图和拾取工具，支持在 Cesium 场景中绘制点、图标、线、多边形、正方形、矩形、圆形和椭圆。它内置了实时预览、浮动提示标签以及基于控制点拖拽的几何体编辑功能。

示例站提供独立的拾取工作台。进入示例主页后选择“拾取与绘制工具”，可以切换八种模式、编辑代码并查看实时回调。

## 拾取案例目录

| 能力 | 方法 | 交互方式 | 文档与实时案例 |
| --- | --- | --- | --- |
| 点拾取 | `pickPoint` | 单击确定点位，保留后可拖拽 | [查看点拾取](/tools/pick-point) |
| 图标点拾取 | `pickPointIcon` | 单击放置图标，保留后可拖拽 | [查看图标点拾取](/tools/pick-icon) |
| 线绘制 | `pickLine` | 单击添加折点，双击结束 | [查看线绘制](/tools/pick-line) |
| 多边形绘制 | `pickPolygon` | 单击添加顶点，双击闭合 | [查看多边形绘制](/tools/pick-polygon) |
| 正方形绘制 | `pickSquare` | 两次单击确定一组对角点 | [查看正方形绘制](/tools/pick-square) |
| 矩形绘制 | `pickRectangle` | 两次单击确定一组对角点 | [查看矩形绘制](/tools/pick-rectangle) |
| 圆形绘制 | `pickCircle` | 先定圆心，再定半径 | [查看圆形绘制](/tools/pick-circle) |
| 椭圆绘制 | `pickEllipse` | 先定中心，再定东西/南北半径 | [查看椭圆绘制](/tools/pick-ellipse) |

## 构造函数

`new PickTools(viewer, config)`

| 参数 | 类型 | 描述 |
| :--- | :--- | :--- |
| viewer | object | Cesium Viewer 实例 |
| config | object | 全局配置项 |

### config 参数说明

| 参数 | 类型 | 默认值 | 描述 |
| :--- | :--- | :--- | :--- |
| unit | `'m' / 'km'` | `'m'` | 规则图形尺寸的输入、输出单位：米或千米 |
| pickSurface | `'ellipsoid' / 'terrain'` | `'ellipsoid'` | 拾取椭球交点或已加载地形交点；开启 `includeHeight` 且未指定本项时使用 `'terrain'`；天空不返回地形坐标 |
| includeHeight | boolean | false | 点、图标、线和多边形回调是否包含第三维高度，固定为米 |
| lineWidth | number | 2 | 线条或边界的宽度（像素） |
| color | string | "#00ffff" | 几何体的主要颜色 |
| pointSize | number | 10 | 节点点的大小（像素） |
| fillOpacity | number | 0.35 | 多边形和规则图形填充透明度，取值范围 0～1 |
| isReserve | boolean | false | 绘制结束后是否保留几何体在地图上 |
| mouseHints | object | - | 鼠标跟随提示配置 |
| mouseHints.show | boolean | false | 是否显示鼠标提示标签 |
| mouseHints.text | string | '左键拾取,双击结束' | 提示标签的基础文本 |
| icon | object | - | 图标配置（用于 `pickPointIcon`） |
| icon.url | string | - | 图标图片地址 |
| icon.width | number | 32 | 图标显示宽度 |
| icon.height | number | 32 | 图标显示高度 |

`unit` 控制圆半径、正方形边长、矩形宽高和椭圆半轴；规则图形回调会携带 `unit` 字段。点、线、多边形的经纬度坐标，以及像素样式和旋转角度不受影响。

圆和椭圆初始数据中的尺寸默认采用实例的 `unit`，也可以通过 `data.unit` 指定该数据的单位。带单位的回调结果可以直接传回对应绘制方法继续编辑。

开启 `includeHeight: true` 后，`pickPoint` / `pickPointIcon` 返回 `[经度, 纬度, 高度]`，`pickLine` / `pickPolygon` 返回三维坐标组；首次绘制与拖拽编辑都保留高度。地形高度来自当前加载的地形表面，为 WGS84 椭球高，固定使用米，不受 `unit` 影响。正方形、矩形、圆和椭圆的几何回调格式保持不变。

```js
const tools = new PickTools(viewer, { includeHeight: true, isReserve: true })
tools.pickLine((coordinates) => {
  console.log(coordinates) // [[经度, 纬度, 高度米], ...]
})
```

## 核心方法

## pickPoint(callback, data) 点绘制
- 参数：
  - `callback`: (Array) => void。完成后回调，返回 `[lon, lat]`。
  - `data`: (Array, 可选)。初始坐标，若传入则直接进入编辑模式。
- 描述：在地图上点击以拾取一个点。如果 `isReserve` 为真，绘制后允许拖拽点位进行编辑。

## pickPointIcon(callback, data) 图标点绘制
- 描述：逻辑同 `pickPoint`，但渲染为 Billboard 图标。

## pickLine(callback, data) 线绘制
- 参数：
  - `callback`: (Array) => void。完成后回调，返回坐标数组 `[[lon, lat], ...]`。
  - `data`: (Array, 可选)。初始点位数组，若传入则直接进入编辑模式。
- 交互：左键点击添加点，**双击**结束绘制。
- 描述：绘制折线。绘图过程中会有虚线跟随鼠标，若 `isReserve` 为真，结束绘制后可通过拖拽折点进行修改。

## pickPolygon(callback, data) 多边形绘制
- 交互：左键点击添加点，**双击**自动闭合并结束绘制。
- 描述：绘制多边形面。支持实时填充预览。

## pickSquare(callback, data) 正方形绘制
- 交互：第一次单击确定角点，第二次单击确定对角方向。
- 回调：返回 `type`、`anchor`、`control`、`center`、`sideLength`、`width`、`height`、`coordinates` 和 `unit`。
- 描述：东西、南北跨度会自动取较大值，使四条边保持等长。

## pickRectangle(callback, data) 矩形绘制
- 交互：两次单击确定一组对角点。
- 回调：返回边界 `west/south/east/north`、中心点、宽高、四个顶点和 `unit`，宽高单位由 `unit` 指定。

## pickCircle(callback, data) 圆形绘制
- 交互：第一次单击确定圆心，第二次单击确定半径。
- 回调：返回 `{ type, center, control, radius, unit }`，其中 `radius` 单位由 `unit` 指定。

## pickEllipse(callback, data) 椭圆绘制
- 交互：第一次单击确定中心，第二次单击确定东西和南北方向半径。
- 回调：返回长短半轴、方向半径、旋转角度、中心、控制点和 `unit`，尺寸单位由 `unit` 指定。

### clear()
- 描述：清空场景中由该工具创建的所有实体。

### destroy()
- 描述：移除鼠标监听器并清理临时标签。

## 使用示例

```js
import { PickTools } from "b-map-viewer";

const tools = new PickTools(viewer, {
    unit: 'km', // m / km，规则图形尺寸单位
    color: '#ff0000',
    isReserve: true,
    mouseHints: { show: true }
});

// 1. 拾取一个点
tools.pickPoint((coords) => {
    console.log('拾取点坐标：', coords); // [lon, lat]
});

// 2. 绘制多边形并进入编辑模式
tools.pickPolygon((points) => {
    console.log('多边形顶点：', points); // [[lon, lat], ...]
});

// 3. 绘制圆形
tools.pickCircle((result) => {
    console.log('圆心与半径：', result.center, result.radius, result.unit); // 半径单位 km
});

// 4. 销毁工具
// tools.destroy();
```

## 功能特性

- **交互反馈**：在绘制线和面时，程序会自动计算并显示一段跟随鼠标的临时路径（线为虚线段，面为连接首尾的闭合填充区域），提供良好的预判感。
- **编辑模式**：当 `isReserve` 设置为 `true` 时，几何体在绘制完成后不会消失。此时，工具将开启编辑监听，用户可以点击并拖拽几何体的任意节点（折点）进行实时位置调整，每次松开均会触发回调。
- **坐标感知**：鼠标移动时，工具会自动在光标处悬浮显示当前的经纬度坐标（需开启 `mouseHints.show`）。
- **坐标规范**：所有回调返回的坐标均为 WGS84 经纬度数组，方便与业务系统对接。
