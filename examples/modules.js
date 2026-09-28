import { baseMapExamples } from './base-maps/index.js'
import { layerExamples } from './layers/index.js'
import { pickExamples } from './picks/index.js'
import { weatherExamples } from './weather/index.js'

const hostedDocsBase = import.meta.env.VITE_DOCS_BASE_URL?.replace(/\/$/, '')
const githubRepository = 'https://github.com/banyan666/BMapViewer'

export const exampleCounts = Object.freeze({
  baseMaps: baseMapExamples.length,
  layers: layerExamples.length,
  pickTools: pickExamples.length,
  weather: weatherExamples.length,
})

function formatMetric(value) {
  return String(value).padStart(2, '0')
}

function createDocsLink(page) {
  if (hostedDocsBase) return `${hostedDocsBase}/${page}`
  return `${githubRepository}/blob/main/docs/${page}.md`
}

export const projectLinks = {
  docs: hostedDocsBase ? `${hostedDocsBase}/` : `${githubRepository}/tree/main/docs`,
  gettingStarted: createDocsLink('getting-started'),
  github: githubRepository,
}

export const exampleModules = [
  {
    id: 'base-maps',
    code: 'BASE',
    route: 'base-maps',
    eyebrow: 'BASE MAPS',
    title: '底图模块',
    description: '独立管理离线瓦片、多源互联网底图与三维地形，统一处理 Provider、坐标偏移、切片方案和资源生命周期。',
    status: `${exampleCounts.baseMaps} 个示例可运行`,
    metric: formatMetric(exampleCounts.baseMaps),
    metricLabel: 'MAP / TERRAIN',
    action: '进入底图目录',
    accent: 'cyan',
    docs: createDocsLink('base-maps'),
    features: ['离线瓦片', '高德', '百度', '腾讯', 'ArcGIS', '天地图', 'Cesium ion 地形', 'Google', 'GeoVis', '自定义切片'],
  },
  {
    id: 'layers',
    code: 'LYR',
    route: 'layers',
    eyebrow: 'MAP LAYERS',
    title: '图层示例',
    description: '在同一 Cesium 场景中浏览、编辑并运行点、线、面、气泡、热力图与三维场景示例。',
    status: `${exampleCounts.layers} 个示例可运行`,
    metric: formatMetric(exampleCounts.layers),
    metricLabel: 'LIVE EXAMPLES',
    action: '进入图层目录',
    accent: 'blue',
    docs: createDocsLink('layers'),
    features: ['点位标注', '线面图层', '三维场景', '动态效果', '专题分析'],
  },
  {
    id: 'pick-tools',
    code: 'PICK',
    route: 'pick-tools',
    eyebrow: 'INTERACTION TOOLS',
    title: '拾取与绘制工具',
    description: '在 Cesium 场景中拾取点、图标点、线、多边形与规则图形，并提供实时反馈和控制点拖拽编辑。',
    status: `${exampleCounts.pickTools} 个示例可运行`,
    metric: formatMetric(exampleCounts.pickTools),
    metricLabel: 'PICK MODES',
    action: '进入拾取示例',
    accent: 'blue',
    docs: createDocsLink('tools/pick-tool'),
    features: ['点拾取', '线面绘制', '正方形/矩形', '圆形/椭圆', '拖拽编辑'],
  },
  {
    id: 'weather',
    code: 'WX',
    route: 'weather',
    eyebrow: 'WEATHER PARTICLES',
    title: '天气粒子系统',
    description: '使用 Cesium 后处理阶段呈现降雨、降雪、距离雾、沙尘、世界空间体积云与闪电，并统一管理效果生命周期。',
    status: `${exampleCounts.weather} 个示例可运行`,
    metric: formatMetric(exampleCounts.weather),
    metricLabel: 'LIVE EFFECTS',
    action: '进入天气实验室',
    accent: 'amber',
    docs: createDocsLink('weather'),
    features: ['雨', '雪', '雾', '沙尘', '云层', '闪电'],
  },
  {
    id: 'spatial-analysis',
    code: 'GEO',
    eyebrow: 'SPATIAL ANALYSIS',
    title: '空间分析',
    description: 'SDK 直接导出 Turf，使用统一 GeoJSON 数据完成距离、缓冲、包含关系与空间计算。',
    status: 'Turf 已集成',
    metric: 'TURF',
    metricLabel: 'GEO ENGINE',
    action: '查看分析文档',
    accent: 'green',
    docs: createDocsLink('tools/turf'),
    features: ['GeoJSON', '距离计算', '缓冲分析', '空间关系', '数据转换'],
  },
]

export function findExampleModule(route) {
  return exampleModules.find((module) => module.route === route)
}
