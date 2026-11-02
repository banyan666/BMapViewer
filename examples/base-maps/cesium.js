import { CESIUM_ION_TOKEN } from '../config/cesium.js'

const token = import.meta.env?.VITE_CESIUM_ION_TOKEN || CESIUM_ION_TOKEN

export default {
  id: 'cesium',
  name: 'Cesium World Imagery',
  title: 'Cesium 官方地图',
  group: '互联网底图',
  summary: '加载 Cesium ion 官方影像；支持中文标注、地图样式及瓦片协议，Token 与语言配置按实例生效。',
  code: `// 申请 Token：https://ion.cesium.com/tokens
const token = ${JSON.stringify(token)}

const baseMap = new BaseMaps.BaseMap(viewer, {
  type: 'cesium',
  token,
  style: 'img_cva', // img：卫星影像；img_cva：带标注影像；elec：电子地图
  language: 'zh-CN', // 简体中文；也可使用 zh-TW、en-US 等
  tileProtocol: 'https',
  crs: 'WGS84',
  layerOptions: { alpha: 1, brightness: 1 },
})

// 工作台会等待 baseMap.readyPromise，切换示例时自动清理。
// 项目中可使用 await baseMap.readyPromise 获取已就绪的 Provider。
return baseMap`,
}
