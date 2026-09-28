# AMapImageryProvider 高德地图

`AMapImageryProvider` 使用 `wprd0` 服务加载高德地图瓦片。设置 `crs: 'WGS84'` 后，Provider 会使用 GCJ-02 切片纠偏，使业务 WGS84 坐标与底图对齐。

## 组件案例

<SdkExamplePreview category="base-map" example="amap" title="AMapImageryProvider 高德地图" />

## BaseMap 用法

```js
const baseMap = new BaseMaps.BaseMap(viewer, {
  type: 'amap',
  style: 7, // 6～10，也可使用 img、elec、cva
  scl: 1,
  crs: 'WGS84',
  maximumLevel: 18,
})
```

| 参数 | 常用值 | 说明 |
| --- | --- | --- |
| `style` | `6`～`10` | 地图样式；`img`、`elec`、`cva` 分别兼容 `6`、`7`、`8` |
| `scale` | `1`、`2` | 普通屏或高清屏参数；仅在传入时追加到请求 |
| `lang` | `zh_cn` | 瓦片语言，默认 `zh_cn` |
| `size` | `1` | 高德瓦片请求的 `size` 参数 |
| `scl` | `1`、`2` | 注记开关；`1` 显示文字注记，`2` 隐藏注记，默认 `1` |
| `ltype` | 数字 | 可选的高德图层内容参数，会原样传入瓦片请求 |
| `queryParameters` | 对象 | 追加或覆盖瓦片查询参数 |
| `crs` | `WGS84` | 启用 GCJ-02 切片纠偏 |
| `url` | URL 模板 | 覆盖 SDK 默认服务模板 |
| `subdomains` | 数组 | 自定义服务子域名，默认 `['1', '2', '3', '4']` |
