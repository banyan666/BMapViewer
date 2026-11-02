import offline from './offline.js'
import customProvider from './custom-provider.js'
import amap from './amap.js'
import arcgis from './arcgis.js'
import cesium from './cesium.js'
import cesiumTerrain from './cesium-terrain.js'
import baidu from './baidu.js'
import tencent from './tencent.js'
import google from './google.js'
import tdt from './tdt.js'
import tdtTerrain from './tdt-terrain.js'
import geovis from './geovis.js'

export const baseMapExamples = [
  offline,
  customProvider,
  arcgis,
  cesium,
  amap,
  cesiumTerrain,
  baidu,
  tencent,
  google,
  tdt,
  tdtTerrain,
  geovis,
]

export const baseMapGroups = [...new Set(baseMapExamples.map((item) => item.group))]
