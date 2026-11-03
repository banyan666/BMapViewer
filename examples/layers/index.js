import iconGroup from './icon-group.js'
import iconCluster from './icon-cluster.js'
import iconClusterBasic from './icon-cluster-basic.js'
import labelGroup from './label-group.js'
import textGroup from './text-group.js'
import lineGroup from './line-group.js'
import linePrimitive from './line-primitive.js'
import build3d from './build-3d.js'
import bubbleDom from './bubble-dom.js'
import bubbleGroup from './bubble-group.js'
import circleGroup from './circle-group.js'
import circleBlur from './circle-blur.js'
import circleWave from './circle-wave.js'
import circleExplosion from './circle-explosion.js'
import pointRipple from './point-ripple.js'
import radarScan from './radar-scan.js'
import polygonPrimitive from './polygon-primitive.js'
import lineMaterial from './line-material.js'
import flowLine from './flow-line.js'
import lineLightingTrail from './line-lighting-trail.js'
import heatmap from './heatmap.js'
import heatmapPrimitive from './heatmap-primitive.js'
import heatmap3d from './heatmap-3d.js'
import radarScanner3d from './radar-scanner-3d.js'
import gradientWall from './gradient-wall.js'
import dynamicWater from './dynamic-water.js'
import waterFlow from './water-flow.js'
import flood from './flood.js'
import wallTrail from './wall-trail.js'
import diffuseWall from './diffuse-wall.js'
import mask from './mask.js'

export const layerExamples = [
  iconGroup,
  iconCluster,
  iconClusterBasic,
  labelGroup,
  textGroup,
  lineGroup,
  linePrimitive,
  build3d,
  bubbleDom,
  bubbleGroup,
  circleGroup,
  circleBlur,
  circleWave,
  circleExplosion,
  pointRipple,
  radarScan,
  polygonPrimitive,
  mask,
  lineMaterial,
  flowLine,
  lineLightingTrail,
  heatmap,
  heatmapPrimitive,
  heatmap3d,
  radarScanner3d,
  gradientWall,
  dynamicWater,
  waterFlow,
  flood,
  wallTrail,
  diffuseWall,
]

export const layerGroups = [...new Set(layerExamples.map((item) => item.group))]
