/**
 * 高性能面图层 - 使用Primitive API
 * 相比Entity/PolygonGraphics，Primitive性能更优
 */
import * as Cesium from 'cesium'
import { uuid } from '../utils/utils.js'

class PolygonPrimitiveLayer {
    constructor(viewer, config = {}) {
        this.viewer = viewer
        this.config = {
            color: '#ffffff',
            lineWidth: 2,
            opacity: 0.6,
            height: 0,
            clampToGround: false,
            showOutline: true,
            ...config
        }
        this.polygonPrimitive = null;//面
        this.linePrimitive = null;//线
        this.data = []
    }

    /**
     * 设置数据
     */
    setData(data) {
        if (!Array.isArray(data)) {
            console.error("data must be an array.")
            return
        }

        this.data = data
        this.clearLayer()
        if (!data.length) return

        let instances = []
        let lineInstances = []

        data.forEach(item => {
            const coordinates = item.geometry?.coordinates
            const type = item.geometry?.type || 'Polygon'
            if (!coordinates || !coordinates.length) return

            const buildPolygon = (rings) => {
                const outerRing = rings[0]
                const holes = rings.slice(1)

                const outerPositions = []
                outerRing.forEach(p => outerPositions.push(p[0], p[1]))

                const holeHierarchies = holes.map(hole => {
                    const holePositions = []
                    hole.forEach(p => holePositions.push(p[0], p[1]))
                    return new Cesium.PolygonHierarchy(
                        Cesium.Cartesian3.fromDegreesArray(holePositions)
                    )
                })

                const polygonGeometry = new Cesium.PolygonGeometry({
                    height: Number(this.config.height) || 0,
                    polygonHierarchy: new Cesium.PolygonHierarchy(
                        Cesium.Cartesian3.fromDegreesArray(outerPositions),
                        holeHierarchies
                    ),
                    vertexFormat: Cesium.PerInstanceColorAppearance.VERTEX_FORMAT
                })

                const id = item.properties?.id || uuid()

                instances.push(new Cesium.GeometryInstance({
                    geometry: polygonGeometry,
                    id,
                    attributes: {
                        color: Cesium.ColorGeometryInstanceAttribute.fromColor(
                            Cesium.Color.fromCssColorString(item.properties?.color || this.config.color)
                                .withAlpha(this.config.opacity)
                        )
                    }
                }))

                if (!this.config.showOutline) return

                const makeLine = (ring) => {
                    const pos = []
                    const height = Number(this.config.height) || 0
                    ring.forEach(p => pos.push(p[0], p[1], height))
                    pos.push(ring[0][0], ring[0][1], height)
                    return Cesium.Cartesian3.fromDegreesArrayHeights(pos)
                }

                // 外环描边
                lineInstances.push(new Cesium.GeometryInstance({
                    geometry: new (this.config.clampToGround ? Cesium.GroundPolylineGeometry : Cesium.PolylineGeometry)({
                        positions: makeLine(outerRing),
                        width: this.config.lineWidth || 2
                    }),
                    id: id,
                    attributes: {
                        color: Cesium.ColorGeometryInstanceAttribute.fromColor(
                            Cesium.Color.fromCssColorString(item.properties?.color || this.config.color)
                        )
                    }
                }))

                // 洞描边
                holes.forEach(hole => {
                    lineInstances.push(new Cesium.GeometryInstance({
                        geometry: new (this.config.clampToGround ? Cesium.GroundPolylineGeometry : Cesium.PolylineGeometry)({
                            positions: makeLine(hole),
                            width: this.config.lineWidth || 2
                        }),
                        id: id,
                        attributes: {
                            color: Cesium.ColorGeometryInstanceAttribute.fromColor(
                                Cesium.Color.fromCssColorString(item.properties?.color || this.config.color)
                            )
                        }
                    }))
                })
            }

            if (type === 'Polygon') {
                buildPolygon(coordinates)
            }

            if (type === 'MultiPolygon') {
                coordinates.forEach(polygonRings => {
                    buildPolygon(polygonRings)
                })
            }
        })

        if (!instances.length) return
        this._primitiveCollection = this.config.clampToGround ? this.viewer.scene.groundPrimitives : this.viewer.scene.primitives

        if (this.config.clampToGround) {
            this.polygonPrimitive = this._primitiveCollection.add(new Cesium.GroundPrimitive({
                geometryInstances: instances,
                appearance: new Cesium.PerInstanceColorAppearance({ flat: true, translucent: true }),
                classificationType: Cesium.ClassificationType.TERRAIN,
                asynchronous: true,
            }))
            if (lineInstances.length) this.linePrimitive = this._primitiveCollection.add(new Cesium.GroundPolylinePrimitive({
                geometryInstances: lineInstances,
                appearance: new Cesium.PolylineColorAppearance({ translucent: true }),
                classificationType: Cesium.ClassificationType.TERRAIN,
                asynchronous: true,
            }))
            return
        }

        // 面外观
        const appearance = new Cesium.PerInstanceColorAppearance({
            translucent: false,
            closed: true,
            faceForward:true,
            renderState: Cesium.RenderState.fromCache({
                depthTest: { enabled: true },
                depthMask: true, //写入深度，防止颜色污染
                blending: Cesium.BlendingState.ALPHA_BLEND
            })
        })
        this.polygonPrimitive = this.viewer.scene.primitives.add(
            new Cesium.Primitive({
                geometryInstances: instances,
                appearance,
                asynchronous: false
            })
        )

        // 线外观
        const lineAppearance = new Cesium.PolylineColorAppearance({ translucent: false })

        if (lineInstances.length) this.linePrimitive = this.viewer.scene.primitives.add(
            new Cesium.Primitive({
                geometryInstances: lineInstances,
                appearance: lineAppearance,
                asynchronous: false
            })
        )
    }

    /**
     * 清空图层
     */
    clearLayer() {
        if (this.polygonPrimitive) {
            this._primitiveCollection.remove(this.polygonPrimitive)
            this.polygonPrimitive = null
            if (this.linePrimitive) this._primitiveCollection.remove(this.linePrimitive)
            this.linePrimitive = null
        }
    }

    /**
     * 显示
     */
    show() {
        if (!this.polygonPrimitive) return
        this.polygonPrimitive.show = true
        if (this.linePrimitive) this.linePrimitive.show = true
    }

    /**
     * 隐藏
     */
    hide() {
        if (!this.polygonPrimitive) return
        this.polygonPrimitive.show = false
        if (this.linePrimitive) this.linePrimitive.show = false
    }

    /**
     * 根据ID获取面对象
     */
    getLayerById(id) {
        if (!this.polygonPrimitive) return null
        return this.polygonPrimitive.getGeometryInstanceAttributes(id)
    }

    /**
     * 根据ID获取数据
     */
    getLayerDataById(id) {
        return this.data.find(item => item.properties?.id === id)
    }

    /**
     * 销毁
     */
    destroy() {
        this.clearLayer()
        this.viewer = null
        this.data = []
    }
}

export default PolygonPrimitiveLayer
