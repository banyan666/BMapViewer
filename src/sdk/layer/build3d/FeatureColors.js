import * as Cesium from 'cesium'
import { buildColor } from '../material/build3d.js'

export function featureKey(id) {
  if (typeof id !== 'string' && !(typeof id === 'number' && Number.isFinite(id))) throw new TypeError('Feature id must be a string or finite number.')
  return String(id)
}

function visitFeatures(content, visit) {
  if (typeof content?.getFeature === 'function') {
    for (let i = 0; i < content.featuresLength; i++) visit(content.getFeature(i))
  }
  for (const inner of content?.innerContents || []) visitFeatures(inner, visit)
}

// Keep overrides separate from tile metadata; cache feature handles only until tile unload.
export default class FeatureColors {
  constructor(property) {
    this.property = property
    this.colors = new Map()
    this.tiles = new Map()
    this.index = new Map()
    this.revision = 0
    this.styleRevision = 0
    this.style = undefined
    this.shaderActive = false
  }

  track(tile) {
    if (this.tiles.has(tile)) return this.tiles.get(tile)
    const record = { entries: [], overrides: [], visible: false, revision: -1, styleRevision: -1 }
    const seen = new Set()
    visitFeatures(tile.content, (feature) => {
      if (seen.has(feature)) return
      seen.add(feature)
      const id = feature.getProperty?.(this.property)
      if (typeof id !== 'string' && !(typeof id === 'number' && Number.isFinite(id))) return
      const key = featureKey(id)
      record.entries.push({ feature, key, original: Cesium.Color.clone(feature.color || Cesium.Color.WHITE), applied: false })
      if (!this.index.has(key)) this.index.set(key, new Set())
      this.index.get(key).add(feature)
    })
    this.tiles.set(tile, record)
    return record
  }

  visible(tile) {
    const record = this.track(tile)
    if (record.styleRevision !== this.styleRevision) {
      for (const entry of record.entries) {
        // Modern glTF content can defer native styling until after tileVisible.
        // Evaluate the baseline rather than capturing a stale override as the original color.
        entry.original = this.styleRevision > 0
          ? Cesium.Color.clone(this.style?.color?.evaluateColor(entry.feature) || Cesium.Color.WHITE)
          : Cesium.Color.clone(entry.feature.color || Cesium.Color.WHITE)
        entry.applied = false
      }
      record.styleRevision = this.styleRevision
      record.revision = -1
    }
    record.visible = true
    return this.apply(record)
  }

  apply(record) {
    if (!record.visible) return false
    if (record.revision === this.revision) {
      let changed = false
      // Only inspect explicitly colored features, not every building each frame.
      for (const entry of record.overrides) {
        if (!Cesium.Color.equals(entry.feature.color, entry.rendered)) {
          entry.feature.color = entry.rendered
          changed = true
        }
      }
      return changed
    }
    record.overrides = []
    for (const entry of record.entries) {
      const color = this.colors.get(entry.key)
      if (color) {
        // Batch textures store 8-bit colors. Compare against the same precision to avoid
        // repeatedly rewriting colors such as alpha=0.5 (stored as 128/255).
        const rendered = Cesium.Color.fromBytes(...color.toBytes())
        if (this.shaderActive && rendered.red === 1 && rendered.green === 1 && rendered.blue === 1) rendered.blue = 254 / 255
        entry.feature.color = rendered
        entry.rendered = rendered
        entry.applied = true
        record.overrides.push(entry)
      } else if (entry.applied) {
        entry.feature.color = entry.original
        entry.applied = false
      }
    }
    record.revision = this.revision
    return true
  }

  refresh() {
    this.revision++
    for (const record of this.tiles.values()) this.apply(record)
  }

  setShaderActive(active) {
    if (active === this.shaderActive) return
    this.shaderActive = active
    this.refresh()
  }

  styleChanged(style) {
    this.style = style
    this.styleRevision++
    this.revision++
    // Wait until the next visible frame before applying the new baseline and overrides.
    for (const record of this.tiles.values()) record.visible = false
  }

  set(id, color) { this.colors.set(featureKey(id), buildColor(color)); this.refresh() }

  replace(items) {
    if (!Array.isArray(items)) throw new TypeError('colors must be an array of { id, color }.')
    const next = new Map()
    for (const item of items) {
      const key = featureKey(item?.id)
      if (next.has(key)) throw new Error(`Duplicate feature id: ${key}`)
      next.set(key, buildColor(item.color))
    }
    this.colors = next
    this.refresh()
  }

  clear(id) {
    if (id === undefined) this.colors.clear()
    else this.colors.delete(featureKey(id))
    this.refresh()
  }

  get(id) { return Cesium.Color.clone(this.colors.get(featureKey(id))) }
  getFeatures(id) { return [...(this.index.get(featureKey(id)) || [])] }

  unload(tile) {
    const record = this.tiles.get(tile)
    if (!record) return
    for (const { feature, key } of record.entries) {
      const entries = this.index.get(key)
      entries.delete(feature)
      if (!entries.size) this.index.delete(key)
    }
    this.tiles.delete(tile)
  }

  detach() { this.tiles.clear(); this.index.clear() }
}
