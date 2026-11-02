import distancePick from './distance-pick.js'
import areaPick from './area-pick.js'
import circleAreaPick from './circle-area-pick.js'
import overlapAreaPick from './overlap-area-pick.js'
import { bufferExamples } from './buffer.js'
import pointsInPolygon from './points-in-polygon.js'
import nearestPointOnLine from './nearest-point-on-line.js'
import nearbyFeatures from './nearby-features.js'
import differenceArea from './difference-area.js'
import unionArea from './union-area.js'
import lineInPolygon from './line-in-polygon.js'
import coverage from './coverage.js'

export const analysisExamples = [distancePick, areaPick, circleAreaPick, overlapAreaPick, ...bufferExamples, pointsInPolygon, nearestPointOnLine, nearbyFeatures, differenceArea, unionArea, lineInPolygon, coverage]
