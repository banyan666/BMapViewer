import * as Cesium from 'cesium'
import { uuid } from '../utils/utils.js'

const DEFAULT_CONFIG = {
  text: 'text',
  dpr: 1,
  maxWidth: 180,
  fontSize: 18,
  fontFamily: '"Microsoft YaHei", "PingFang SC", sans-serif',
  fontWeight: 600,
  fontStyle: 'normal',
  lineHeight: 1.25,
  color: '#ffffff',
  showBackground: false,
  backgroundColor: 'transparent',
  padding: [6, 3],
  border: false,
  borderColor: '#ffffff',
  borderWidth: 1,
  borderRadius: 2,
  textAlign: 'center',
  overflowMode: 'ellipsis',
  shadowColor: 'rgba(0, 0, 0, 0.65)',
  shadowBlur: 2,
  offset: [0, 0],
  scale: 1,
  scaleByDistance: [150000, 1, 400000, 0.5],
  pixelOffsetScaleByDistance: null,
  distanceDisplayCondition: null,
  horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
  verticalOrigin: Cesium.VerticalOrigin.CENTER,
  disableDepthTestDistance: Number.POSITIVE_INFINITY,
  enableCollisionDetection: true,
  collisionThreshold: 0.2,
  collisionPadding: 2,
  collisionCellSize: 96,
  hideStrategy: 'distance',
  allowClick: false,
}

function toFiniteNumber(value, fallback) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value))
}

function normalizeData(data) {
  if (Array.isArray(data)) return data
  if (data?.type === 'FeatureCollection' && Array.isArray(data.features)) return data.features
  if (data?.type === 'Feature') return [data]
  return null
}

function normalizePair(value, fallback) {
  if (Array.isArray(value)) {
    return [
      toFiniteNumber(value[0], fallback[0]),
      toFiniteNumber(value[1], fallback[1]),
    ]
  }
  if (Number.isFinite(Number(value))) {
    const number = Number(value)
    return [number, number]
  }
  return [...fallback]
}

function toNearFarScalar(value, fallback = null) {
  if (value instanceof Cesium.NearFarScalar) return value
  if (Array.isArray(value) && value.length >= 4) {
    return new Cesium.NearFarScalar(
      toFiniteNumber(value[0], 0),
      toFiniteNumber(value[1], 1),
      toFiniteNumber(value[2], Number.MAX_VALUE),
      toFiniteNumber(value[3], 1),
    )
  }
  if (value && typeof value === 'object') {
    return new Cesium.NearFarScalar(
      toFiniteNumber(value.near, 0),
      toFiniteNumber(value.nearValue, 1),
      toFiniteNumber(value.far, Number.MAX_VALUE),
      toFiniteNumber(value.farValue, 1),
    )
  }
  return fallback
}

function toDistanceDisplayCondition(value) {
  if (value instanceof Cesium.DistanceDisplayCondition) return value
  if (Array.isArray(value) && value.length >= 2) {
    return new Cesium.DistanceDisplayCondition(
      Math.max(0, toFiniteNumber(value[0], 0)),
      Math.max(0, toFiniteNumber(value[1], Number.MAX_VALUE)),
    )
  }
  if (value && typeof value === 'object') {
    return new Cesium.DistanceDisplayCondition(
      Math.max(0, toFiniteNumber(value.near, 0)),
      Math.max(0, toFiniteNumber(value.far, Number.MAX_VALUE)),
    )
  }
  return undefined
}

function toHorizontalOrigin(value) {
  if (typeof value !== 'string') return value ?? Cesium.HorizontalOrigin.CENTER
  return {
    left: Cesium.HorizontalOrigin.LEFT,
    center: Cesium.HorizontalOrigin.CENTER,
    right: Cesium.HorizontalOrigin.RIGHT,
  }[value.toLowerCase()] ?? Cesium.HorizontalOrigin.CENTER
}

function toVerticalOrigin(value) {
  if (typeof value !== 'string') return value ?? Cesium.VerticalOrigin.CENTER
  return {
    top: Cesium.VerticalOrigin.TOP,
    center: Cesium.VerticalOrigin.CENTER,
    bottom: Cesium.VerticalOrigin.BOTTOM,
    baseline: Cesium.VerticalOrigin.BASELINE,
  }[value.toLowerCase()] ?? Cesium.VerticalOrigin.CENTER
}

function drawRoundedRect(context, x, y, width, height, radius) {
  const safeRadius = clamp(radius, 0, Math.min(width, height) / 2)
  context.beginPath()
  context.moveTo(x + safeRadius, y)
  context.lineTo(x + width - safeRadius, y)
  context.quadraticCurveTo(x + width, y, x + width, y + safeRadius)
  context.lineTo(x + width, y + height - safeRadius)
  context.quadraticCurveTo(x + width, y + height, x + width - safeRadius, y + height)
  context.lineTo(x + safeRadius, y + height)
  context.quadraticCurveTo(x, y + height, x, y + height - safeRadius)
  context.lineTo(x, y + safeRadius)
  context.quadraticCurveTo(x, y, x + safeRadius, y)
  context.closePath()
}

function truncateText(context, text, maxWidth) {
  const content = String(text ?? '')
  if (!maxWidth || context.measureText(content).width <= maxWidth) return content

  const characters = Array.from(content)
  const ellipsis = '…'
  let low = 0
  let high = characters.length
  while (low < high) {
    const middle = Math.ceil((low + high) / 2)
    const candidate = `${characters.slice(0, middle).join('')}${ellipsis}`
    if (context.measureText(candidate).width <= maxWidth) low = middle
    else high = middle - 1
  }
  return `${characters.slice(0, low).join('')}${ellipsis}`
}

function wrapText(context, text, maxWidth) {
  const paragraphs = String(text ?? '').split(/\r?\n/)
  if (!maxWidth) return paragraphs.length ? paragraphs : ['']

  const lines = []
  paragraphs.forEach((paragraph) => {
    const characters = Array.from(paragraph)
    if (!characters.length) {
      lines.push('')
      return
    }

    let currentLine = ''
    characters.forEach((character) => {
      const candidate = `${currentLine}${character}`
      if (currentLine && context.measureText(candidate).width > maxWidth) {
        lines.push(currentLine)
        currentLine = character
      } else {
        currentLine = candidate
      }
    })
    if (currentLine || !lines.length) lines.push(currentLine)
  })
  return lines.length ? lines : ['']
}

/**
 * Canvas 文字组图层。
 *
 * 每条文字绘制为高 DPI Canvas，并由 BillboardCollection 批量渲染；图层会在
 * 场景渲染后计算屏幕矩形，根据配置自动隐藏发生碰撞的文字。
 */
class TextGroupLayer {
  constructor(viewer, config = {}) {
    if (!viewer) throw new Error('Viewer is required.')

    this.viewer = viewer
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.billboardCollection = new Cesium.BillboardCollection()
    this.layer = this.viewer.scene.primitives.add(this.billboardCollection)
    this.data = []
    this.textMetrics = new Map()
    this.canvasCache = new Map()
    this.creationSequence = 0
    this.destroyed = false

    this.renderListener = () => this.render()
    this.viewer.scene.postRender.addEventListener(this.renderListener)
  }

  resolveStyle(options = {}) {
    const properties = options.properties || {}
    const pick = (key) => properties[key] ?? options[key] ?? this.config[key]
    return {
      text: properties.text ?? properties.name ?? options.text ?? options.name ?? this.config.text,
      dpr: clamp(toFiniteNumber(pick('dpr'), 1), 0.5, 3),
      maxWidth: Math.max(0, toFiniteNumber(pick('maxWidth'), 180)),
      fontSize: Math.max(1, toFiniteNumber(pick('fontSize'), 18)),
      fontFamily: pick('fontFamily'),
      fontWeight: pick('fontWeight'),
      fontStyle: pick('fontStyle'),
      lineHeight: Math.max(1, toFiniteNumber(pick('lineHeight'), 1.25)),
      color: pick('color'),
      showBackground: Boolean(pick('showBackground')),
      backgroundColor: pick('backgroundColor'),
      padding: normalizePair(pick('padding'), [6, 3]),
      border: Boolean(pick('border')),
      borderColor: pick('borderColor'),
      borderWidth: Math.max(0, toFiniteNumber(pick('borderWidth'), 1)),
      borderRadius: Math.max(0, toFiniteNumber(pick('borderRadius'), 2)),
      textAlign: ['left', 'center', 'right'].includes(pick('textAlign'))
        ? pick('textAlign')
        : 'center',
      overflowMode: pick('overflowMode') === 'wrap' ? 'wrap' : 'ellipsis',
      shadowColor: pick('shadowColor'),
      shadowBlur: Math.max(0, toFiniteNumber(pick('shadowBlur'), 2)),
    }
  }

  createTextCanvas(style) {
    const cacheKey = JSON.stringify(style)
    if (this.canvasCache.has(cacheKey)) return this.canvasCache.get(cacheKey)

    const measureCanvas = document.createElement('canvas')
    const measureContext = measureCanvas.getContext('2d')
    const font = `${style.fontStyle} ${style.fontWeight} ${style.fontSize}px ${style.fontFamily}`
    measureContext.font = font

    const textLines = style.overflowMode === 'wrap'
      ? wrapText(measureContext, style.text, style.maxWidth)
      : [truncateText(measureContext, String(style.text ?? '').replace(/\r?\n/g, ' '), style.maxWidth)]
    const textWidth = Math.ceil(Math.max(
      0,
      ...textLines.map((line) => measureContext.measureText(line).width),
    ))
    const lineHeight = Math.ceil(style.fontSize * style.lineHeight)
    const [paddingX, paddingY] = style.padding
    const borderSpace = style.border ? style.borderWidth * 2 : 0
    const width = Math.max(1, Math.ceil(textWidth + paddingX * 2 + borderSpace))
    const height = Math.max(
      1,
      Math.ceil(lineHeight * textLines.length + paddingY * 2 + borderSpace),
    )
    const pixelRatio = clamp((window.devicePixelRatio || 1) * style.dpr, 1, 4)

    const canvas = document.createElement('canvas')
    canvas.width = Math.ceil(width * pixelRatio)
    canvas.height = Math.ceil(height * pixelRatio)
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`

    const context = canvas.getContext('2d')
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    context.scale(pixelRatio, pixelRatio)

    const halfBorder = style.border ? style.borderWidth / 2 : 0
    drawRoundedRect(
      context,
      halfBorder,
      halfBorder,
      width - halfBorder * 2,
      height - halfBorder * 2,
      style.borderRadius,
    )
    if (
      style.showBackground
      && style.backgroundColor
      && style.backgroundColor !== 'transparent'
    ) {
      context.fillStyle = style.backgroundColor
      context.fill()
    }
    if (style.border && style.borderWidth > 0) {
      context.strokeStyle = style.borderColor
      context.lineWidth = style.borderWidth
      context.stroke()
    }

    context.font = font
    context.textAlign = style.textAlign
    context.textBaseline = 'middle'
    context.fillStyle = style.color
    context.shadowColor = style.shadowColor || 'transparent'
    context.shadowBlur = style.shadowBlur

    const textX = style.textAlign === 'left'
      ? paddingX + borderSpace / 2
      : style.textAlign === 'right'
        ? width - paddingX - borderSpace / 2
        : width / 2
    const textAreaHeight = lineHeight * textLines.length
    const firstBaseline = (height - textAreaHeight) / 2 + lineHeight / 2
    textLines.forEach((line, index) => {
      const textY = firstBaseline + index * lineHeight
      if (style.maxWidth > 0) context.fillText(line, textX, textY, style.maxWidth)
      else context.fillText(line, textX, textY)
    })

    const result = { canvas, width, height, text: textLines.join('\n'), lines: textLines }
    this.canvasCache.set(cacheKey, result)
    return result
  }

  setData(data) {
    const items = normalizeData(data)
    if (!items) {
      console.error('data must be an array or GeoJSON FeatureCollection.')
      return []
    }

    this.clearLayer()
    this.data = [...items]
    const billboards = items.map((item) => this.addLayer(item, false)).filter(Boolean)
    this.viewer.scene.requestRender()
    return billboards
  }

  addLayer(options, trackData = true) {
    const coordinates = options?.geometry?.coordinates
    if (!Array.isArray(coordinates) || coordinates.length < 2) {
      console.error('缺少coordinates字段')
      return null
    }
    if (options.geometry.type && options.geometry.type !== 'Point') {
      console.error('TextGroupLayer only supports Point geometry.')
      return null
    }

    const longitude = Number(coordinates[0])
    const latitude = Number(coordinates[1])
    const height = toFiniteNumber(coordinates[2], 0)
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude)) {
      console.error('coordinates must contain valid longitude and latitude.')
      return null
    }

    const properties = options.properties || {}
    const id = properties.id ?? options.id ?? uuid()
    const style = this.resolveStyle(options)
    const textCanvas = this.createTextCanvas(style)
    const offset = normalizePair(properties.offset ?? options.offset ?? this.config.offset, [0, 0])
    const scaleByDistance = toNearFarScalar(
      properties.scaleByDistance ?? options.scaleByDistance ?? this.config.scaleByDistance,
    )
    const pixelOffsetScaleByDistance = toNearFarScalar(
      properties.pixelOffsetScaleByDistance
        ?? options.pixelOffsetScaleByDistance
        ?? this.config.pixelOffsetScaleByDistance,
    )
    const distanceDisplayCondition = toDistanceDisplayCondition(
      properties.distanceDisplayCondition
        ?? options.distanceDisplayCondition
        ?? this.config.distanceDisplayCondition,
    )

    const billboardOptions = {
      position: Cesium.Cartesian3.fromDegrees(longitude, latitude, height),
      image: textCanvas.canvas,
      width: textCanvas.width,
      height: textCanvas.height,
      scale: Math.max(0, toFiniteNumber(properties.scale ?? options.scale, this.config.scale)),
      pixelOffset: new Cesium.Cartesian2(offset[0], offset[1]),
      horizontalOrigin: toHorizontalOrigin(
        properties.horizontalOrigin ?? options.horizontalOrigin ?? this.config.horizontalOrigin,
      ),
      verticalOrigin: toVerticalOrigin(
        properties.verticalOrigin ?? options.verticalOrigin ?? this.config.verticalOrigin,
      ),
      disableDepthTestDistance: toFiniteNumber(
        properties.disableDepthTestDistance ?? options.disableDepthTestDistance,
        this.config.disableDepthTestDistance,
      ),
      color: Cesium.Color.WHITE,
      id,
    }
    if (scaleByDistance) billboardOptions.scaleByDistance = scaleByDistance
    if (pixelOffsetScaleByDistance) {
      billboardOptions.pixelOffsetScaleByDistance = pixelOffsetScaleByDistance
    }
    if (distanceDisplayCondition) {
      billboardOptions.distanceDisplayCondition = distanceDisplayCondition
    }

    const billboard = this.billboardCollection.add(billboardOptions)

    billboard.properties = { ...properties }
    if (!this.config.allowClick) billboard.pickPrimitive = false

    this.creationSequence += 1
    this.textMetrics.set(id, {
      width: textCanvas.width,
      height: textCanvas.height,
      priority: toFiniteNumber(properties.priority ?? options.priority, 0),
      createdOrder: this.creationSequence,
      source: options,
    })
    if (trackData) this.data.push(options)
    return billboard
  }

  getDistanceScale(scalar, distance) {
    if (!(scalar instanceof Cesium.NearFarScalar)) return 1
    if (distance <= scalar.near) return scalar.nearValue
    if (distance >= scalar.far) return scalar.farValue
    const ratio = (distance - scalar.near) / Math.max(1, scalar.far - scalar.near)
    return Cesium.Math.lerp(scalar.nearValue, scalar.farValue, ratio)
  }

  getScreenRect(billboard, metrics) {
    const screenPosition = Cesium.SceneTransforms.wgs84ToWindowCoordinates(
      this.viewer.scene,
      billboard.position,
    )
    if (!screenPosition || !Number.isFinite(screenPosition.x) || !Number.isFinite(screenPosition.y)) {
      return null
    }

    const distance = Cesium.Cartesian3.distance(
      this.viewer.camera.positionWC,
      billboard.position,
    )
    const displayCondition = billboard.distanceDisplayCondition
    if (
      displayCondition
      && (distance < displayCondition.near || distance > displayCondition.far)
    ) return null
    const distanceScale = this.getDistanceScale(billboard.scaleByDistance, distance)
    const offsetScale = this.getDistanceScale(billboard.pixelOffsetScaleByDistance, distance)
    const scale = Math.max(0, billboard.scale * distanceScale)
    const width = metrics.width * scale
    const height = metrics.height * scale
    const offsetX = billboard.pixelOffset.x * offsetScale
    const offsetY = billboard.pixelOffset.y * offsetScale
    const anchorX = screenPosition.x + offsetX
    const anchorY = screenPosition.y + offsetY

    let left = anchorX - width / 2
    if (billboard.horizontalOrigin === Cesium.HorizontalOrigin.LEFT) left = anchorX
    else if (billboard.horizontalOrigin === Cesium.HorizontalOrigin.RIGHT) left = anchorX - width

    let top = anchorY - height / 2
    if (billboard.verticalOrigin === Cesium.VerticalOrigin.TOP) top = anchorY
    else if (
      billboard.verticalOrigin === Cesium.VerticalOrigin.BOTTOM
      || billboard.verticalOrigin === Cesium.VerticalOrigin.BASELINE
    ) top = anchorY - height

    const padding = Math.max(0, toFiniteNumber(this.config.collisionPadding, 2))
    const canvas = this.viewer.scene.canvas
    const viewportWidth = canvas.clientWidth || canvas.width
    const viewportHeight = canvas.clientHeight || canvas.height
    if (left > viewportWidth || left + width < 0 || top > viewportHeight || top + height < 0) {
      return null
    }

    return {
      id: billboard.id,
      billboard,
      left: left - padding,
      right: left + width + padding,
      top: top - padding,
      bottom: top + height + padding,
      width: width + padding * 2,
      height: height + padding * 2,
      area: Math.max(1, (width + padding * 2) * (height + padding * 2)),
      priority: metrics.priority,
      createdOrder: metrics.createdOrder,
      screenPosition,
    }
  }

  render() {
    if (
      this.destroyed
      || !this.viewer
      || this.viewer.isDestroyed()
      || !this.billboardCollection
      || !this.billboardCollection.show
    ) return

    const visibleTexts = []
    for (let index = 0; index < this.billboardCollection.length; index += 1) {
      const billboard = this.billboardCollection.get(index)
      const metrics = this.textMetrics.get(billboard.id)
      const screenRect = metrics ? this.getScreenRect(billboard, metrics) : null
      billboard.show = Boolean(screenRect)
      if (screenRect) visibleTexts.push(screenRect)
    }

    if (!this.config.enableCollisionDetection || visibleTexts.length < 2) return
    this.performCollisionDetection(visibleTexts)
  }

  sortForCollision(rectangles) {
    const distanceToCenter = (rectangle) => {
      const canvas = this.viewer.scene.canvas
      const centerX = (canvas.clientWidth || canvas.width) / 2
      const centerY = (canvas.clientHeight || canvas.height) / 2
      return Math.hypot(
        rectangle.screenPosition.x - centerX,
        rectangle.screenPosition.y - centerY,
      )
    }
    const byPriority = (first, second) => second.priority - first.priority

    switch (this.config.hideStrategy) {
      case 'smaller':
        return [...rectangles].sort((first, second) =>
          byPriority(first, second) || second.area - first.area || first.createdOrder - second.createdOrder)
      case 'newer':
        return [...rectangles].sort((first, second) =>
          byPriority(first, second) || first.createdOrder - second.createdOrder)
      case 'priority':
        return [...rectangles].sort((first, second) =>
          byPriority(first, second) || distanceToCenter(first) - distanceToCenter(second))
      case 'distance':
      default:
        return [...rectangles].sort((first, second) =>
          byPriority(first, second) || distanceToCenter(first) - distanceToCenter(second))
    }
  }

  performCollisionDetection(rectangles) {
    const cellSize = Math.max(16, toFiniteNumber(this.config.collisionCellSize, 96))
    const collisionGrid = new Map()

    const getCellRange = (rectangle) => ({
      minimumX: Math.floor(rectangle.left / cellSize),
      maximumX: Math.floor(rectangle.right / cellSize),
      minimumY: Math.floor(rectangle.top / cellSize),
      maximumY: Math.floor(rectangle.bottom / cellSize),
    })

    this.sortForCollision(rectangles).forEach((rectangle) => {
      const range = getCellRange(rectangle)
      const nearbyRectangles = new Set()
      for (let x = range.minimumX; x <= range.maximumX; x += 1) {
        for (let y = range.minimumY; y <= range.maximumY; y += 1) {
          const cell = collisionGrid.get(`${x}:${y}`)
          cell?.forEach((item) => nearbyRectangles.add(item))
        }
      }

      const collided = [...nearbyRectangles].some((visibleRectangle) =>
        this.checkCollision(rectangle, visibleRectangle))
      rectangle.billboard.show = !collided
      if (collided) return

      for (let x = range.minimumX; x <= range.maximumX; x += 1) {
        for (let y = range.minimumY; y <= range.maximumY; y += 1) {
          const cellKey = `${x}:${y}`
          if (!collisionGrid.has(cellKey)) collisionGrid.set(cellKey, [])
          collisionGrid.get(cellKey).push(rectangle)
        }
      }
    })
  }

  checkCollision(first, second) {
    const left = Math.max(first.left, second.left)
    const right = Math.min(first.right, second.right)
    const top = Math.max(first.top, second.top)
    const bottom = Math.min(first.bottom, second.bottom)
    if (left >= right || top >= bottom) return false

    const intersectionArea = (right - left) * (bottom - top)
    const minimumArea = Math.min(first.area, second.area)
    const threshold = clamp(toFiniteNumber(this.config.collisionThreshold, 0.2), 0, 1)
    return intersectionArea / minimumArea > threshold
  }

  updateLayerById(id, options = {}) {
    const billboard = this.getLayerById(id)
    if (!billboard) return null

    const metrics = this.textMetrics.get(billboard.id)
    const source = metrics?.source || { geometry: {}, properties: {} }
    const nextSource = {
      ...source,
      ...options,
      geometry: options.geometry || source.geometry,
      properties: {
        ...(source.properties || {}),
        ...(options.properties || {}),
        id: billboard.id,
      },
    }
    const coordinates = nextSource.geometry?.coordinates
    if (Array.isArray(coordinates) && coordinates.length >= 2) {
      billboard.position = Cesium.Cartesian3.fromDegrees(
        Number(coordinates[0]),
        Number(coordinates[1]),
        toFiniteNumber(coordinates[2], 0),
      )
    }

    const style = this.resolveStyle(nextSource)
    const textCanvas = this.createTextCanvas(style)
    billboard.image = textCanvas.canvas
    billboard.width = textCanvas.width
    billboard.height = textCanvas.height
    billboard.properties = { ...nextSource.properties }

    this.textMetrics.set(billboard.id, {
      ...metrics,
      width: textCanvas.width,
      height: textCanvas.height,
      priority: toFiniteNumber(nextSource.properties.priority ?? nextSource.priority, 0),
      source: nextSource,
    })
    const dataIndex = this.data.findIndex((item) =>
      (item.properties?.id ?? item.id) === billboard.id)
    if (dataIndex >= 0) this.data[dataIndex] = nextSource
    this.viewer.scene.requestRender()
    return billboard
  }

  removeLayer(billboard) {
    if (!billboard || !this.billboardCollection) return false
    const metrics = this.textMetrics.get(billboard.id)
    this.textMetrics.delete(billboard.id)
    this.data = this.data.filter((item) =>
      item !== metrics?.source && (item.properties?.id ?? item.id) !== billboard.id)
    return this.billboardCollection.remove(billboard)
  }

  getLayerById(id) {
    if (id == null || !this.billboardCollection) return null
    for (let index = 0; index < this.billboardCollection.length; index += 1) {
      const billboard = this.billboardCollection.get(index)
      if (billboard.id === id) return billboard
    }
    return null
  }

  removeLayerById(id) {
    const billboard = this.getLayerById(id)
    return billboard ? this.removeLayer(billboard) : false
  }

  clearLayer() {
    this.billboardCollection?.removeAll()
    this.textMetrics.clear()
    this.data = []
  }

  show() {
    if (!this.billboardCollection) return
    this.billboardCollection.show = true
    this.viewer?.scene.requestRender()
  }

  hide() {
    if (this.billboardCollection) this.billboardCollection.show = false
  }

  setCollisionEnabled(enabled) {
    this.config.enableCollisionDetection = Boolean(enabled)
    this.viewer?.scene.requestRender()
  }

  setCollisionThreshold(value) {
    this.config.collisionThreshold = clamp(toFiniteNumber(value, 0.2), 0, 1)
    this.viewer?.scene.requestRender()
  }

  updateConfig(newConfig = {}, redraw = true) {
    const data = [...this.data]
    this.config = { ...this.config, ...newConfig }
    this.canvasCache.clear()
    if (redraw && data.length) this.setData(data)
    else this.viewer?.scene.requestRender()
  }

  destroy() {
    if (this.destroyed) return
    if (this.viewer && !this.viewer.isDestroyed() && this.renderListener) {
      this.viewer.scene.postRender.removeEventListener(this.renderListener)
    }
    this.renderListener = null
    this.clearLayer()
    this.canvasCache.clear()
    if (this.viewer && !this.viewer.isDestroyed() && this.layer) {
      this.viewer.scene.primitives.remove(this.layer)
    }
    this.layer = null
    this.billboardCollection = null
    this.viewer = null
    this.data = null
    this.destroyed = true
  }

  isDestroyed() {
    return this.destroyed
  }
}

export default TextGroupLayer
