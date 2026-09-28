import iconGroup from './icon-group.js'
import iconCluster from './icon-cluster.js'
import labelGroup from './label-group.js'
import textGroup from './text-group.js'
import lineGroup from './line-group.js'
import linePrimitive from './line-primitive.js'
import build3d from './build-3d.js'
import bubbleDom from './bubble-dom.js'
import bubbleGroup from './bubble-group.js'
import circleGroup from './circle-group.js'
import circleWave from './circle-wave.js'
import circleExplosion from './circle-explosion.js'
import pointRipple from './point-ripple.js'
import polygonPrimitive from './polygon-primitive.js'
import lineMaterial from './line-material.js'
import heatmap from './heatmap.js'
import heatmapPrimitive from './heatmap-primitive.js'
import heatmap3d from './heatmap-3d.js'
import radarScanner3d from './radar-scanner-3d.js'
import gradientWall from './gradient-wall.js'
import dynamicWater from './dynamic-water.js'
import mask from './mask.js'

export const layerExamples = [
  iconGroup,
  iconCluster,
  labelGroup,
  textGroup,
  lineGroup,
  linePrimitive,
  build3d,
  bubbleDom,
  bubbleGroup,
  circleGroup,
  circleWave,
  circleExplosion,
  pointRipple,
  polygonPrimitive,
  mask,
  lineMaterial,
  heatmap,
  heatmapPrimitive,
  heatmap3d,
  radarScanner3d,
  gradientWall,
  dynamicWater,
]

export const layerGroups = [...new Set(layerExamples.map((item) => item.group))]
