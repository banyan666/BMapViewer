import * as Cesium from 'cesium'
import { uuid } from '../utils/utils.js'

class LineGroupLayer {

    constructor(viewer, config) {
        this.viewer = viewer;

        this.config = {
            type: 'default',
            color: '#ffffff',
            width: 2,
            height: 0,
            ...config
        };

        this.polylineCollection = new Cesium.PolylineCollection();
        this.layer = this.viewer.scene.primitives.add(this.polylineCollection);
    }

    /**
     * 设置数据
     */
    setData(data) {
        this.clearLayer();

        if (!Array.isArray(data)) {
            console.error("data must be an array.");
            return;
        }

        data.forEach(item => this.addLayer(item));
    }

    /**
     * 根据type获取材质
     */
    getMaterial(type, options = {}) {

        const color = options.color
            ? Cesium.Color.fromCssColorString(options.color)
            : Cesium.Color.fromCssColorString(this.config.color);

        switch (type) {

            // 默认
            case "default":
                return Cesium.Material.fromType("Color", {
                    color: color
                });

            // 虚线
            case "dash":
                return Cesium.Material.fromType("PolylineDash", {
                    color: color,
                    dashLength: options?.dashLength ||this.config?.dashLength || 16,
                    gapColor:options?.gapColor ? new Cesium.Color.fromCssColorString(options?.gapColor):this.config?.gapColor?new Cesium.Color.fromCssColorString(this.config?.gapColor):Cesium.Color.TRANSPARENT,
                });

            // 发光
            case "glow":
                return Cesium.Material.fromType("PolylineGlow", {
                    glowPower: options.glowPower || this.config?.glowPower|| 0.25,
                    taperPower: options.taperPower || this.config?.taperPower || 1.0,
                    color: color
                });

            // 描边
            case "outline":
                return Cesium.Material.fromType("PolylineOutline", {
                    color: color,
                    outlineColor: options.outlineColor
                        ? Cesium.Color.fromCssColorString(options.outlineColor)
                        : this.config?.outlineColor?new Cesium.Color.fromCssColorString(this.config?.outlineColor):new Cesium.Color.fromCssColorString('#ff0000'),
                    outlineWidth: options.outlineWidth || this.config?.outlineWidth || 1
                });

            // 箭头
            case "arrow":
                return Cesium.Material.fromType("PolylineArrow", {
                    color: color
                });

            default:
                return Cesium.Material.fromType("Color", {
                    color: color
                });
        }
    }

    /**
     * 添加线
     */
    addLayer(options) {

        if (!options?.geometry?.coordinates) {
            console.error("缺少coordinates字段");
            return;
        }

        const coordinates = options.geometry.coordinates;

        const positions = [];

        coordinates.forEach(coord => {
            positions.push(coord[0], coord[1], coord[2] ?? this.config.height);
        });

        const type = options.properties?.type || this.config.type;

        const material = this.getMaterial(type, options.properties);

        const polyline = this.polylineCollection.add({
            positions: Cesium.Cartesian3.fromDegreesArrayHeights(positions),
            width: options?.properties?.width ||this.config.width,
            material: material,
            id: options.properties?.id || uuid(),
        });

        polyline.properties = {
            ...options.properties
        };

        return polyline;
    }

    /**
     * 移除
     */
    removeLayer(polyline) {
        if (!polyline) return;
        this.polylineCollection.remove(polyline);
    }

    /**
     * 清空
     */
    clearLayer() {
        this.polylineCollection.removeAll();
    }

    /**
     * 显示
     */
    show() {
        if (this.polylineCollection) {
            this.polylineCollection.show = true;
        }
    }

    /**
     * 隐藏
     */
    hide() {
        if (this.polylineCollection) {
            this.polylineCollection.show = false;
        }
    }

    /**
     * 根据ID删除
     */
    removeLayerById(id) {

        const polylines = this.polylineCollection._polylines;

        for (let i = 0; i < polylines.length; i++) {

            if (polylines[i].id === id) {

                this.polylineCollection.remove(polylines[i]);

                break;
            }

        }

    }

    /**
     * 销毁
     */
    destroy() {

        this.viewer.scene.primitives.remove(this.layer);

        this.polylineCollection = null;

        this.layer = null;

    }

}

export default LineGroupLayer;
