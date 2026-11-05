import * as Cesium from 'cesium'
import { uuid } from '../utils/utils.js'

const defaults = {
    radius: 1000, height: 0, color: '#05fbf8', speed: 1, heading: 0,
    hemisphereAlpha: 0.5, scanAlpha: 0.6, outline: true, outlineColor: '#f1f105', autoStart: false,
}

function normalize(options) {
    const config = { ...options }
    if ('position' in config) throw new TypeError('RadarScanner3DLayer: use geometry.coordinates in setData(), not options.position.')
    for (const key of ['radius', 'height', 'speed', 'heading', 'hemisphereAlpha', 'scanAlpha']) {
        if (!Number.isFinite(config[key])) throw new TypeError(`RadarScanner3DLayer.${key} must be finite.`)
    }
    if (config.radius <= 0) throw new RangeError('RadarScanner3DLayer.radius must be greater than zero.')
    for (const key of ['hemisphereAlpha', 'scanAlpha']) {
        if (config[key] < 0 || config[key] > 1) throw new RangeError(`RadarScanner3DLayer.${key} must be between 0 and 1.`)
    }
    for (const key of ['outline', 'autoStart']) {
        if (typeof config[key] !== 'boolean') throw new TypeError(`RadarScanner3DLayer.${key} must be boolean.`)
    }
    for (const key of ['color', 'outlineColor']) {
        const value = config[key]
        const color = value instanceof Cesium.Color ? Cesium.Color.clone(value)
            : typeof value === 'string' ? Cesium.Color.fromCssColorString(value) : null
        if (!color || ![color.red, color.green, color.blue, color.alpha].every(Number.isFinite)) {
            throw new TypeError(`RadarScanner3DLayer.${key} must be a CSS color or Cesium.Color.`)
        }
        config[key] = value instanceof Cesium.Color ? color : value
    }
    return config
}

/** 三维半球雷达；数据采用 SDK Point geometry / properties 数组。 */
export default class RadarScanner3DLayer {
    constructor(viewer, options = {}) {
        if (!viewer?.scene || !viewer?.dataSources || !viewer?.clock || viewer.isDestroyed?.()) {
            throw new Error('RadarScanner3DLayer requires a usable Cesium Viewer.')
        }
        this.config = normalize({ ...defaults, ...options })
        this.viewer = viewer
        this.layer = new Cesium.CustomDataSource('radar-scanner-3d-layer')
        this.data = []
        this.entities = []
        this._records = new Map()
        this._visible = true
        this._running = this.config.autoStart
        this._destroyed = false
        this.eventListener = null
        const layer = this.layer
        // 数据源异步挂载完成时，清理已销毁图层的迟到资源。
        Promise.resolve(viewer.dataSources.add(layer)).then(() => {
            if (this._destroyed && !viewer.isDestroyed?.()) viewer.dataSources.remove(layer, true)
        })
    }
    _assertAlive() {
        if (this._destroyed || this.viewer?.isDestroyed?.()) throw new Error('RadarScanner3DLayer has been destroyed.')
    }
    _prepare(item, config = this.config) {
        const geometry = item?.geometry, coordinates = geometry?.coordinates
        if (geometry?.type !== 'Point' || !Array.isArray(coordinates) || ![2, 3].includes(coordinates.length)
            || !Array.from(coordinates).every(Number.isFinite) || Math.abs(coordinates[0]) > 180 || Math.abs(coordinates[1]) > 90) {
            throw new TypeError('RadarScanner3DLayer requires Point coordinates [longitude, latitude, height?].')
        }
        if (item.properties != null && (typeof item.properties !== 'object' || Array.isArray(item.properties))) {
            throw new TypeError('RadarScanner3DLayer.properties must be an object.')
        }
        const properties = { ...item.properties }
        properties.id ??= uuid()
        if (!['string', 'number'].includes(typeof properties.id) || properties.id === ''
            || (typeof properties.id === 'number' && !Number.isFinite(properties.id))) {
            throw new TypeError('RadarScanner3DLayer.properties.id must be a nonempty string or finite number.')
        }
        const options = normalize({ ...config, ...properties })
        const center = [...coordinates.slice(0, 2), coordinates[2] ?? options.height]
        return { feature: { ...item, geometry: { ...geometry, coordinates: [...coordinates] }, properties },
            options, center, heading: options.heading,
            enu: Cesium.Transforms.eastNorthUpToFixedFrame(Cesium.Cartesian3.fromDegrees(...center)) }
    }
    setData(data) {
        this._assertAlive()
        if (!Array.isArray(data)) throw new TypeError('RadarScanner3DLayer data must be an array.')
        const records = Array.from(data, item => this._prepare(item))
        const ids = records.map(record => String(record.feature.properties.id))
        if (new Set(ids).size !== ids.length) throw new Error('RadarScanner3DLayer IDs must be unique.')
        this.clearLayer()
        records.forEach(record => this._add(record))
        this._syncAnimation(); this._requestRender()
        return this
    }
    addLayer(item) {
        this._assertAlive()
        const record = this._prepare(item)
        if (this._records.has(String(record.feature.properties.id))) throw new Error('RadarScanner3DLayer IDs must be unique.')
        const entity = this._add(record)
        this._syncAnimation(); this._requestRender()
        return entity
    }
    _add(record) {
        const { options, feature } = record, color = this.getColor(options.color)
        record.positions = this._scanPositions(record)
        const common = () => ({ show: this._visible, name: feature.properties.name || '三维雷达',
            properties: new Cesium.PropertyBag({ ...feature.properties, center: [...record.center] }) })
        record.hemisphere = this.layer.entities.add({
            ...common(), id: String(feature.properties.id), position: Cesium.Cartesian3.fromDegrees(...record.center),
            ellipsoid: { radii: new Cesium.Cartesian3(options.radius, options.radius, options.radius),
                maximumCone: Cesium.Math.PI_OVER_TWO, material: color.withAlpha(options.hemisphereAlpha),
                outline: options.outline, outlineColor: this.getColor(options.outlineColor) },
        })
        record.scan = this.layer.entities.add({ ...common(),
            wall: { positions: new Cesium.CallbackProperty(() => record.positions, false),
                minimumHeights: new Array(record.positions.length).fill(record.center[2]),
                material: color.withAlpha(options.scanAlpha) },
        })
        for (const entity of [record.hemisphere, record.scan]) {
            entity._bmapLayerId = feature.properties.id
            entity._bmapFeature = feature
            this.entities.push(entity)
        }
        this.data.push(feature)
        this._records.set(String(feature.properties.id), record)
        return record.hemisphere
    }
    _scanPositions(record) {
        const heading = Cesium.Math.toRadians(record.heading), local = new Cesium.Cartesian3()
        const positions = [Cesium.Cartesian3.fromDegrees(...record.center)]
        for (let degree = 0; degree <= 90; degree += 2) {
            const angle = Cesium.Math.toRadians(degree), horizontal = record.options.radius * Math.cos(angle)
            local.x = horizontal * Math.cos(heading)
            local.y = horizontal * Math.sin(heading)
            local.z = record.options.radius * Math.sin(angle)
            positions.push(Cesium.Matrix4.multiplyByPoint(record.enu, local, new Cesium.Cartesian3()))
        }
        return positions
    }
    setOptions(patch = {}) {
        this._assertAlive()
        const config = normalize({ ...this.config, ...patch })
        const records = this.data.map(item => {
            const record = this._prepare(item, config)
            if (!Object.hasOwn(patch, 'heading')) record.heading = this._records.get(String(item.properties.id)).heading
            return record
        })
        this.clearLayer()
        this.config = config
        if (Object.hasOwn(patch, 'autoStart')) this._running = config.autoStart
        records.forEach(record => this._add(record))
        this._syncAnimation(); this._requestRender()
        return this
    }
    getOptions() { return normalize({ ...this.config }) }
    _syncAnimation() {
        this._removeTick?.(); this._removeTick = null; this.eventListener = null
        if (!this._running || !this._visible || ![...this._records.values()].some(record => record.options.speed !== 0)) return
        this.eventListener = () => {
            if (this.viewer?.isDestroyed?.()) { this.destroy(); return }
            this._records.forEach(record => {
                if (record.options.speed === 0) return
                record.heading = ((record.heading + record.options.speed) % 360 + 360) % 360
                record.positions = this._scanPositions(record)
            })
            this._requestRender()
        }
        this._removeTick = this.viewer.clock.onTick.addEventListener(this.eventListener)
    }
    start() { this._assertAlive(); this._running = true; this._syncAnimation(); return this }
    stop() { this._running = false; this._syncAnimation(); return this }
    setVisible(visible) {
        this._assertAlive()
        this._visible = Boolean(visible); this.layer.show = this._visible
        this.entities.forEach(entity => { entity.show = this._visible })
        this._syncAnimation(); this._requestRender()
        return this
    }
    show() { return this.setVisible(true) }
    hide() { return this.setVisible(false) }
    getLayerById(id) { return this._records.get(String(id))?.hemisphere || null }
    getLayersById(id) { const record = this._records.get(String(id)); return record ? [record.hemisphere, record.scan] : [] }
    getLayerDataById(id) { return this._records.get(String(id))?.feature || null }
    removeLayer(entity) {
        const record = [...this._records.values()].find(item => item.hemisphere === entity || item.scan === entity)
        return record ? this.removeLayerById(record.feature.properties.id) > 0 : false
    }
    removeLayerById(id) {
        this._assertAlive()
        const entities = this.getLayersById(id)
        if (!entities.length) return 0
        entities.forEach(entity => this.layer.entities.remove(entity))
        this.entities = this.entities.filter(entity => !entities.includes(entity))
        this.data = this.data.filter(item => String(item.properties.id) !== String(id))
        this._records.delete(String(id))
        this._syncAnimation(); this._requestRender()
        return 1
    }
    clearLayer() {
        this._removeTick?.(); this._removeTick = null; this.eventListener = null
        this.layer?.entities.removeAll()
        this.entities = []; this.data = []; this._records.clear()
        this._requestRender()
        return this
    }
    getColor(value) { return value instanceof Cesium.Color ? Cesium.Color.clone(value) : Cesium.Color.fromCssColorString(value) }
    _requestRender() { if (this.viewer && !this.viewer.isDestroyed?.()) this.viewer.scene.requestRender() }
    isDestroyed() { return this._destroyed }
    destroy() {
        if (this._destroyed) return
        this.clearLayer()
        if (!this.viewer.isDestroyed?.()) this.viewer.dataSources.remove(this.layer, true)
        this._running = false; this._destroyed = true; this.layer = null; this.viewer = null
    }
}
