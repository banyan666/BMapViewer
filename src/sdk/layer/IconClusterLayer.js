import * as Cesium from 'cesium'
import { uuid } from '../utils/utils.js'

const DEFAULT_CLUSTER_STYLES = [
  { min: 2, size: 34, color: '#1c86d1dd' },
  { min: 50, size: 40, color: '#43b86add' },
  { min: 100, size: 46, color: '#f56c6cdd' },
  { min: 200, size: 52, color: '#e6a23cdd' },
]

const DEFAULT_MARKER_ICON = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" width="42" height="52" viewBox="0 0 42 52">
    <path fill="#31c8ff" stroke="#d9f8ff" stroke-width="2" d="M21 1C10 1 1 10 1 21c0 14.8 20 30 20 30s20-15.2 20-30C41 10 32 1 21 1Z"/>
    <circle cx="21" cy="20" r="7" fill="#07384e"/>
  </svg>
`)}`

const DEFAULT_CONFIG = {
  enabled: true,
  pixelRange: 36,
  minimumClusterSize: 2,
  icon: DEFAULT_MARKER_ICON,
  width: 34,
  height: 42,
  color: '#ffffff',
  offset: [0, 0],
  disableDepthTestDistance: Number.POSITIVE_INFINITY,
  clusterStyles: DEFAULT_CLUSTER_STYLES,
  clusterTextColor: '#ffffff',
  clusterStrokeColor: '#d9f8ffff',
  clusterStrokeWidth: 2,
  clusterFontSize: 15,
  clusterShowText: true,
  clusterText: '{count}',
  clusterTextPosition: 'top',
  clusterTextGap: 6,
  clusterTextOffset: [0, 0],
  clusterTextOutlineColor: '#071b28',
  clusterTextOutlineWidth: 2,
}

function toFiniteNumber(value, fallback) {
  const number = Number(value)
  return Number.isFinite(number) ? number : fallback
}

function toColor(value, fallback = Cesium.Color.WHITE) {
  if (value instanceof Cesium.Color) return value
  return Cesium.Color.fromCssColorString(value) || fallback
}

function toPixelOffset(value) {
  if (value instanceof Cesium.Cartesian2) return value
  const offset = Array.isArray(value) ? value : [0, 0]
  return new Cesium.Cartesian2(
    toFiniteNumber(offset[0], 0),
    toFiniteNumber(offset[1], 0),
  )
}

function normalizeClusterStyles(styles) {
  const source = Array.isArray(styles) && styles.length ? styles : DEFAULT_CLUSTER_STYLES
  return source
    .map((style, index) => ({
      min: Math.max(1, Math.floor(toFiniteNumber(
        style.min ?? style.num,
        DEFAULT_CLUSTER_STYLES[index]?.min ?? (index + 1) * 50,
      ))),
      size: Math.max(20, toFiniteNumber(style.size, 34)),
      color: style.color || '#1c86d1dd',
      strokeColor: style.strokeColor,
      strokeWidth: style.strokeWidth,
      textColor: style.textColor,
      fontSize: style.fontSize,
      icon: style.icon,
      width: style.width,
      height: style.height,
      showText: style.showText,
      text: style.text,
      textPosition: style.textPosition,
      textGap: style.textGap,
      textOffset: style.textOffset,
      textOutlineColor: style.textOutlineColor,
      textOutlineWidth: style.textOutlineWidth,
    }))
    .sort((first, second) => first.min - second.min)
}

function normalizeData(data) {
  if (Array.isArray(data)) return data
  if (data?.type === 'FeatureCollection' && Array.isArray(data.features)) return data.features
  if (data?.type === 'Feature') return [data]
  return null
}

/**
 * 图标聚合图层。
 *
 * 使用 Cesium.CustomDataSource 与 EntityCluster 管理点位，在相机缩放时自动在
 * 单个 Billboard 和聚合 Billboard 之间切换。
 */
class IconClusterLayer {
  constructor(viewer, config = {}) {
    if (!viewer) throw new Error('Viewer is required.')

    const requestedStyles = config.clusterStyles ?? config.colorArr ?? DEFAULT_CLUSTER_STYLES
    this.viewer = viewer
    this.config = {
      ...DEFAULT_CONFIG,
      ...config,
      clusterStyles: normalizeClusterStyles(requestedStyles),
    }
    this.data = []
    this.dataSource = new Cesium.CustomDataSource(config.name || 'bmap-viewer-icon-cluster')
    this.clusterIconCache = new Map()
    this.removeClusterListener = null
    this.destroyed = false

    this.viewer.dataSources.add(this.dataSource)
    this.applyClustering()
    this.bindClusterStyle()
  }

  applyClustering() {
    const clustering = this.dataSource.clustering
    clustering.enabled = Boolean(this.config.enabled)
    clustering.pixelRange = Math.max(0, toFiniteNumber(this.config.pixelRange, 36))
    clustering.minimumClusterSize = Math.max(
      1,
      Math.floor(toFiniteNumber(this.config.minimumClusterSize, 2)),
    )
    this.forceCluster()
  }

  bindClusterStyle() {
    this.removeClusterListener?.()
    this.removeClusterListener = this.dataSource.clustering.clusterEvent.addEventListener(
      (clusteredEntities, cluster) => {
        const count = clusteredEntities.length
        const style = this.getClusterStyle(count)
        const text = this.formatClusterText(count, style, clusteredEntities)
        const width = style.icon ? Math.max(1, toFiniteNumber(style.width, style.size)) : style.size
        const height = style.icon ? Math.max(1, toFiniteNumber(style.height, style.size)) : style.size

        cluster.label.show = false
        cluster.point.show = false
        cluster.billboard.show = true
        cluster.billboard.image = style.icon || this.createClusterImage(count, style, text)
        cluster.billboard.width = width
        cluster.billboard.height = height
        cluster.billboard.color = Cesium.Color.WHITE
        cluster.billboard.pixelOffset = new Cesium.Cartesian2(0, 0)
        cluster.billboard.scale = 1
        cluster.billboard.horizontalOrigin = Cesium.HorizontalOrigin.CENTER
        cluster.billboard.verticalOrigin = Cesium.VerticalOrigin.CENTER
        cluster.billboard.disableDepthTestDistance = this.config.disableDepthTestDistance
        cluster.billboard.id = cluster.label.id
        cluster.billboard.properties = {
          type: 'cluster',
          count,
          entities: clusteredEntities,
        }
        cluster.label.properties = cluster.billboard.properties
        if (style.icon) this.applyClusterLabel(cluster.label, text, style, width, height)
      },
    )
  }

  getClusterStyle(count) {
    let selected = this.config.clusterStyles[0]
    this.config.clusterStyles.forEach((style) => {
      if (count >= style.min) selected = style
    })
    return selected
  }

  formatClusterText(count, style = this.getClusterStyle(count), entities = []) {
    const format = style.text ?? this.config.clusterText
    const text = typeof format === 'function'
      ? format(count, entities)
      : String(format ?? '{count}').replaceAll('{count}', String(count))
    return text == null ? '' : String(text)
  }

  applyClusterLabel(label, text, style, width, height) {
    label.show = Boolean(this.config.clusterShowText !== false && style.showText !== false && text)
    label.text = text
    label.font = `700 ${Math.max(1, toFiniteNumber(style.fontSize, this.config.clusterFontSize))}px "Cascadia Code", "Microsoft YaHei", sans-serif`
    label.fillColor = toColor(style.textColor || this.config.clusterTextColor)
    label.style = Cesium.LabelStyle.FILL_AND_OUTLINE
    label.outlineColor = toColor(style.textOutlineColor || this.config.clusterTextOutlineColor)
    label.outlineWidth = Math.max(0, toFiniteNumber(style.textOutlineWidth, this.config.clusterTextOutlineWidth))
    label.showBackground = false
    label.scale = 1
    label.disableDepthTestDistance = this.config.disableDepthTestDistance

    const gap = Math.max(0, toFiniteNumber(style.textGap, this.config.clusterTextGap))
    const position = style.textPosition ?? this.config.clusterTextPosition
    const extraOffset = toPixelOffset(style.textOffset ?? this.config.clusterTextOffset)
    let x = 0
    let y = 0
    label.horizontalOrigin = Cesium.HorizontalOrigin.CENTER
    label.verticalOrigin = Cesium.VerticalOrigin.CENTER
    switch (position) {
      case 'bottom':
        y = height / 2 + gap
        label.verticalOrigin = Cesium.VerticalOrigin.TOP
        break
      case 'left':
        x = -(width / 2 + gap)
        label.horizontalOrigin = Cesium.HorizontalOrigin.RIGHT
        break
      case 'right':
        x = width / 2 + gap
        label.horizontalOrigin = Cesium.HorizontalOrigin.LEFT
        break
      default:
        y = -(height / 2 + gap)
        label.verticalOrigin = Cesium.VerticalOrigin.BOTTOM
        break
    }
    label.pixelOffset = new Cesium.Cartesian2(x + extraOffset.x, y + extraOffset.y)
  }

  createClusterImage(count, style = this.getClusterStyle(count), text = this.formatClusterText(count, style)) {
    const strokeColor = style.strokeColor || this.config.clusterStrokeColor
    const strokeWidth = Math.max(
      0,
      toFiniteNumber(style.strokeWidth, this.config.clusterStrokeWidth),
    )
    const textColor = style.textColor || this.config.clusterTextColor
    const showText = this.config.clusterShowText !== false && style.showText !== false
    const cacheKey = JSON.stringify([
      showText ? text : '',
      style.size,
      style.color,
      strokeColor,
      strokeWidth,
      textColor,
      style.fontSize || this.config.clusterFontSize,
    ])
    if (this.clusterIconCache.has(cacheKey)) return this.clusterIconCache.get(cacheKey)

    const size = style.size
    const pixelRatio = 2
    const canvas = document.createElement('canvas')
    canvas.width = size * pixelRatio
    canvas.height = size * pixelRatio
    const context = canvas.getContext('2d')
    context.scale(pixelRatio, pixelRatio)

    const center = size / 2
    const radius = center - Math.max(1, strokeWidth / 2)
    context.beginPath()
    context.arc(center, center, radius, 0, Math.PI * 2)
    context.fillStyle = style.color
    context.shadowColor = style.color
    context.shadowBlur = Math.max(4, size * 0.16)
    context.fill()
    context.shadowBlur = 0

    if (strokeWidth > 0) {
      context.strokeStyle = strokeColor
      context.lineWidth = strokeWidth
      context.stroke()
    }

    context.beginPath()
    context.arc(center, center, Math.max(1, radius - 4), 0, Math.PI * 2)
    context.strokeStyle = 'rgba(255, 255, 255, 0.2)'
    context.lineWidth = 1
    context.stroke()

    if (showText && text) {
      const configuredFontSize = toFiniteNumber(style.fontSize, this.config.clusterFontSize)
      const fittedFontSize = Math.max(10, Math.min(configuredFontSize, size / Math.max(2.2, text.length * 0.68)))
      context.fillStyle = textColor
      context.font = `700 ${fittedFontSize}px "Cascadia Code", "Microsoft YaHei", sans-serif`
      context.textAlign = 'center'
      context.textBaseline = 'middle'
      context.fillText(text, center, center + 0.5)
    }

    const image = canvas.toDataURL('image/png')
    this.clusterIconCache.set(cacheKey, image)
    return image
  }

  /**
   * 批量设置数据，支持 SDK 点数据数组或 GeoJSON FeatureCollection。
   */
  setData(data) {
    const items = normalizeData(data)
    if (!items) {
      console.error('data must be an array or GeoJSON FeatureCollection.')
      return []
    }

    this.clearLayer()
    this.data = items
    const entities = items.map((item) => this.addLayer(item)).filter(Boolean)
    this.forceCluster()
    return entities
  }

  /**
   * 从 URL、Cesium.Resource 或本地对象加载 GeoJSON 点数据。
   */
  async load(dataOrUrl) {
    if (typeof dataOrUrl !== 'string' && !(dataOrUrl instanceof Cesium.Resource)) {
      return this.setData(dataOrUrl)
    }
    const resource = dataOrUrl instanceof Cesium.Resource
      ? dataOrUrl
      : new Cesium.Resource({ url: dataOrUrl })
    const data = await resource.fetchJson()
    return this.setData(data)
  }

  /**
   * 添加单个点位。
   */
  addLayer(options) {
    const coordinates = options?.geometry?.coordinates
    if (!Array.isArray(coordinates) || coordinates.length < 2) {
      console.error('缺少coordinates字段')
      return null
    }
    if (options.geometry.type && options.geometry.type !== 'Point') {
      console.error('IconClusterLayer only supports Point geometry.')
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
    const entityId = properties.id ?? options.id ?? uuid()
    const entity = this.dataSource.entities.add({
      id: String(entityId),
      position: Cesium.Cartesian3.fromDegrees(longitude, latitude, height),
      properties: { ...properties },
      billboard: {
        image: properties.icon || options.icon || this.config.icon,
        width: toFiniteNumber(properties.width ?? options.width, this.config.width),
        height: toFiniteNumber(properties.height ?? options.height, this.config.height),
        color: toColor(properties.color || options.color || this.config.color),
        horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        pixelOffset: toPixelOffset(properties.offset || options.offset || this.config.offset),
        disableDepthTestDistance: this.config.disableDepthTestDistance,
        scaleByDistance: this.config.scaleByDistance
          || new Cesium.NearFarScalar(150000, 1, 400000, 0.5),
      },
    })
    entity.bmapViewerSource = options
    return entity
  }

  removeLayer(entity) {
    if (!entity) {
      console.error('Entity is required to remove.')
      return false
    }
    const removed = this.dataSource.entities.remove(entity)
    if (removed) this.forceCluster()
    return removed
  }

  getLayerById(id) {
    if (id == null) {
      console.error('ID is required to get.')
      return null
    }
    return this.dataSource.entities.getById(String(id)) || null
  }

  removeLayerById(id) {
    const entity = this.getLayerById(id)
    return entity ? this.removeLayer(entity) : false
  }

  clearLayer() {
    if (!this.dataSource) return
    this.dataSource.entities.removeAll()
    this.data = []
    this.forceCluster()
  }

  show() {
    if (this.dataSource) this.dataSource.show = true
  }

  hide() {
    if (this.dataSource) this.dataSource.show = false
  }

  setEnabled(enabled) {
    this.config.enabled = Boolean(enabled)
    this.dataSource.clustering.enabled = this.config.enabled
    this.forceCluster()
  }

  updateConfig(newConfig = {}) {
    const requestedStyles = Object.prototype.hasOwnProperty.call(newConfig, 'clusterStyles')
      ? newConfig.clusterStyles
      : Object.prototype.hasOwnProperty.call(newConfig, 'colorArr')
        ? newConfig.colorArr
        : this.config.clusterStyles
    this.config = {
      ...this.config,
      ...newConfig,
      clusterStyles: normalizeClusterStyles(requestedStyles),
    }
    this.clusterIconCache.clear()
    this.applyClustering()
  }

  forceCluster() {
    if (!this.dataSource || !this.viewer || this.viewer.isDestroyed()) return
    const clustering = this.dataSource.clustering
    const pixelRange = clustering.pixelRange
    clustering.pixelRange = pixelRange === 0 ? 1 : 0
    clustering.pixelRange = pixelRange
    this.viewer.scene.requestRender()
  }

  destroy() {
    if (this.destroyed) return
    this.removeClusterListener?.()
    this.removeClusterListener = null
    this.clusterIconCache.clear()
    this.clearLayer()
    if (this.viewer && !this.viewer.isDestroyed() && this.viewer.dataSources.contains(this.dataSource)) {
      this.viewer.dataSources.remove(this.dataSource, true)
    }
    this.dataSource = null
    this.viewer = null
    this.data = null
    this.destroyed = true
  }

  isDestroyed() {
    return this.destroyed
  }
}

export default IconClusterLayer
