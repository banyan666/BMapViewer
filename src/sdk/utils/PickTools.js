/**
 * 获取点位
 */
import * as Cesium from 'cesium'
import icon from '../assets/position.png'

const MIN_SHAPE_SIZE = 0.1
const SHAPE_DISTANCE_FIELDS = ['radius', 'sideLength', 'width', 'height', 'eastRadius', 'northRadius', 'semiMajorAxis', 'semiMinorAxis']

const normalizeUnit = (unit) => {
    if (unit !== 'm' && unit !== 'km') {
        throw new RangeError('PickTools unit must be m or km.')
    }
    return unit
}

const isCoordinate = (value) => (
    Array.isArray(value)
    && value.length >= 2
    && Number.isFinite(Number(value[0]))
    && Number.isFinite(Number(value[1]))
)

const cloneCoordinate = (value) => [Number(value[0]), Number(value[1])]

const toCartesian = (coordinate) => Cesium.Cartesian3.fromDegrees(coordinate[0], coordinate[1], coordinate[2] ?? 0)

const toCoordinate = (cartesian, includeHeight = false) => {
    const cartographic = Cesium.Cartographic.fromCartesian(cartesian)
    const coordinate = [
        Cesium.Math.toDegrees(cartographic.longitude),
        Cesium.Math.toDegrees(cartographic.latitude),
    ]
    if (includeHeight) coordinate.push(cartographic.height)
    return coordinate
}

const getLocalOffset = (origin, target) => {
    const frame = Cesium.Transforms.eastNorthUpToFixedFrame(toCartesian(origin))
    const inverse = Cesium.Matrix4.inverseTransformation(frame, new Cesium.Matrix4())
    const local = Cesium.Matrix4.multiplyByPoint(inverse, toCartesian(target), new Cesium.Cartesian3())
    return { east: local.x, north: local.y }
}

const offsetCoordinate = (origin, east, north) => {
    const frame = Cesium.Transforms.eastNorthUpToFixedFrame(toCartesian(origin))
    const cartesian = Cesium.Matrix4.multiplyByPoint(
        frame,
        new Cesium.Cartesian3(east, north, 0),
        new Cesium.Cartesian3(),
    )
    return toCoordinate(cartesian)
}

const getSurfaceDistance = (start, end) => {
    const startCartographic = Cesium.Cartographic.fromDegrees(start[0], start[1])
    const endCartographic = Cesium.Cartographic.fromDegrees(end[0], end[1])
    return new Cesium.EllipsoidGeodesic(startCartographic, endCartographic).surfaceDistance
}

export default class PickTools {
    // 默认仍按椭球拾取；山区可显式启用地形交点拾取。
    _pickPosition(position, ellipsoid = this.viewer.scene.globe?.ellipsoid || Cesium.Ellipsoid.WGS84) {
        if (this.config.pickSurface === 'terrain') {
            const ray = this.viewer.scene.camera.getPickRay(position)
            return ray ? this.viewer.scene.globe.pick(ray, this.viewer.scene) : undefined
        }
        return this.viewer.scene.camera.pickEllipsoid(position, ellipsoid)
    }

    // 点、图标、折线和多边形可选返回椭球高（米）；不受规则图形 unit 影响。
    _toCoordinate(cartesian) {
        return toCoordinate(cartesian, this.config.includeHeight)
    }

    constructor(viewer,config) {
        if (config?.pickSurface != null && !['ellipsoid', 'terrain'].includes(config.pickSurface)) throw new RangeError('PickTools pickSurface must be ellipsoid or terrain.')
        this.viewer = viewer
        this.config = {
            // 规则图形尺寸的输入/输出单位；Cesium 内部始终使用米。
            unit: normalizeUnit(config?.unit ?? 'm'),
            pickSurface: config?.pickSurface ?? (config?.includeHeight === true ? 'terrain' : 'ellipsoid'),
            includeHeight: config?.includeHeight === true,
            // 几何-边框宽度
            lineWidth: config?.lineWidth || 2,
            color: config?.color || "#00ffff",
            mouseHints: {
                show: config?.mouseHints?.show || false,
                text: config?.mouseHints?.text ||'左键拾取,双击结束'
            },
            isReserve: config?.isReserve || false,
            pointSize: config?.pointSize || 10,
            fillOpacity: Cesium.Math.clamp(Number(config?.fillOpacity ?? 0.35), 0, 1),
            icon:{
                url: config?.icon?.url || icon,
                width: config?.icon?.width || 32,
                height: config?.icon?.height || 32
            }
        };
        this.handler = null
        this.label =  null
        this.viewer.cesiumWidget.screenSpaceEventHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
    }
    moveLabel(){
        if(this.handler && this.config.mouseHints.show){
            this.handler.setInputAction( (e)=>{
                const movePosition = this._pickPosition(e.endPosition);
                if (!movePosition) return;
                const randiansPos = Cesium.Cartographic.fromCartesian(movePosition);
                const lon= Cesium.Math.toDegrees(randiansPos.longitude)
                const lat= Cesium.Math.toDegrees(randiansPos.latitude)
                this.addLabel(movePosition,[lon,lat])
            }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
        }
    }

    /**
     * 拾取点
     * @param callback
     */
    pickPoint(callback,data=[]){
        let pointEntity = null
        let point = data
        const createPointEntity = () => {
            // 创建点实例
            if(!pointEntity){
                pointEntity = this.viewer.entities.add({
                    position: toCartesian(point),
                    point: {
                        heightReference: this.config.pickSurface === 'terrain' ? Cesium.HeightReference.CLAMP_TO_GROUND : Cesium.HeightReference.NONE,
                        pixelSize: this.config.pointSize,
                        color: Cesium.Color.fromCssColorString(this.config.color),
                        outlineColor: Cesium.Color.WHITE,
                        outlineWidth: 2,
                    }
                });
            }else{
                pointEntity.position = toCartesian(point)
            }
        }
        //开启拖拽点位编辑
        const startEdit = () => {
            this.handler = new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas);
            // 监听鼠标左键按下
            this.handler.setInputAction((e) => {
                const feature = this.viewer.scene.pick(e.position);
                if(Cesium.defined(feature) && feature.id === pointEntity){
                        document.body.style.cursor = 'move';
                        this.viewer.scene.screenSpaceCameraController.enableRotate = false;
                        this.viewer.scene.screenSpaceCameraController.enableTranslate = false;
                        this.viewer.scene.screenSpaceCameraController.enableZoom = false;
                        this.handler.setInputAction((e)=>{
                            const movePosition = this._pickPosition(e.endPosition);
                            if (!movePosition) return; // 如果没有点击到地面，返回

                            const randiansPos = Cesium.Cartographic.fromCartesian(movePosition);
                            const lon = Cesium.Math.toDegrees(randiansPos.longitude);
                            const lat = Cesium.Math.toDegrees(randiansPos.latitude);
                            point = this._toCoordinate(movePosition)
                            pointEntity.position = toCartesian(point)
                        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE)
                    }
            }, Cesium.ScreenSpaceEventType.LEFT_DOWN)
            this.handler.setInputAction((e)=>{
                this.viewer.scene.screenSpaceCameraController.enableRotate = true;
                this.viewer.scene.screenSpaceCameraController.enableTranslate = true;
                this.viewer.scene.screenSpaceCameraController.enableZoom = true;
                document.body.style.cursor = 'default';
                this.handler.removeInputAction(Cesium.ScreenSpaceEventType.MOUSE_MOVE);
                const feature = this.viewer.scene.pick(e.position);
                if(Cesium.defined(feature) && feature.id === pointEntity){
                    callback && callback(point);  // 触发回调，传递坐标点
                }
            },Cesium.ScreenSpaceEventType.LEFT_UP)
        }
        if( point && point.length){
            createPointEntity()
            startEdit()
            return
        }
        this.handler = new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas);
        this.moveLabel()
        this.handler.setInputAction( (e)=>{
            const clickPosition = this._pickPosition(e.position);
            if (!clickPosition) return;
            const randiansPos = Cesium.Cartographic.fromCartesian(clickPosition);
            let lon= Cesium.Math.toDegrees(randiansPos.longitude)
            let lat = Cesium.Math.toDegrees(randiansPos.latitude)
            point = this._toCoordinate(clickPosition)
            createPointEntity()
            !this.config.isReserve && this.viewer.entities.remove(pointEntity)
            this.destroy()
            this.removeLabel()
            if(Number.isFinite(lon) && Number.isFinite(lat)){
                this.config.isReserve && startEdit()
                callback && callback(point)
            }
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
    }

    /**
     * 拾取图标点
     */
    pickPointIcon(callback,data=[]){
        let pointEntity = null
        let point = data
        let clickId =  null
        const createPointEntity = () => {
            // 创建点实例
            if(!pointEntity){
                pointEntity = this.viewer.entities.add({
                    position: toCartesian(point),
                    billboard: {
                        image: this.config.icon.url,
                        scaleByDistance: new Cesium.NearFarScalar(500000, 1, 1000000, 0.5),
                        show: true,
                        horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
                        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                        width: this.config.icon.width,
                        height: this.config.icon.height,

                    }
                });
            }else{
                pointEntity.position = toCartesian(point)
            }
        }
        //开启拖拽点位编辑
        const startEdit = () => {
            this.handler = new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas);
            // 监听鼠标左键按下
            this.handler.setInputAction((e) => {
                const feature = this.viewer.scene.pick(e.position);
                if(Cesium.defined(feature) && feature.id === pointEntity){
                    clickId = feature.id
                    document.body.style.cursor = 'move';
                    this.viewer.scene.screenSpaceCameraController.enableRotate = false;
                    this.viewer.scene.screenSpaceCameraController.enableTranslate = false;
                    this.viewer.scene.screenSpaceCameraController.enableZoom = false;
                    this.handler.setInputAction((e)=>{
                        const movePosition = this._pickPosition(e.endPosition);
                        if (!movePosition) return; // 如果没有点击到地面，返回

                        const randiansPos = Cesium.Cartographic.fromCartesian(movePosition);
                        const lon = Cesium.Math.toDegrees(randiansPos.longitude);
                        const lat = Cesium.Math.toDegrees(randiansPos.latitude);
                        point = this._toCoordinate(movePosition)
                        pointEntity.position = toCartesian(point)
                    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE)
                }
            }, Cesium.ScreenSpaceEventType.LEFT_DOWN)
            this.handler.setInputAction((e)=>{
                this.viewer.scene.screenSpaceCameraController.enableRotate = true;
                this.viewer.scene.screenSpaceCameraController.enableTranslate = true;
                this.viewer.scene.screenSpaceCameraController.enableZoom = true;
                document.body.style.cursor = 'default';
                this.handler.removeInputAction(Cesium.ScreenSpaceEventType.MOUSE_MOVE);
                if(clickId === pointEntity){
                    callback && callback(point);  // 触发回调，传递坐标点
                }
            },Cesium.ScreenSpaceEventType.LEFT_UP)
        }
        if( point && point.length){
            createPointEntity()
            startEdit()
            return
        }
        this.handler = new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas);
        this.moveLabel()
        this.handler.setInputAction( (e)=>{
            const clickPosition = this._pickPosition(e.position);
            if (!clickPosition) return;
            const randiansPos = Cesium.Cartographic.fromCartesian(clickPosition);
            let lon= Cesium.Math.toDegrees(randiansPos.longitude)
            let lat = Cesium.Math.toDegrees(randiansPos.latitude)
            point = this._toCoordinate(clickPosition)
            createPointEntity()
            !this.config.isReserve && this.viewer.entities.remove(pointEntity)
            this.destroy()
            this.removeLabel()
            if(Number.isFinite(lon) && Number.isFinite(lat)){
                this.config.isReserve && startEdit()
                callback && callback(point)
            }
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
    }
    /**
     * 拾取线
     * @param callback
     * @param data
     */
    pickLine(callback,data=[]) {
        let points = data;
        let polylineEntity = null;  // 用于存储绘制的线段
        let tempPolylineEntity = null;  // 临时线段，跟随鼠标移动
        let pointsEntity = []; // 用于存储绘制的点
        let clickIndex= -1
        // 初始化线实例
        const createLineEntity = () => {
            // 绘制线段
            if (points.length > 1) {
                // 更新现有的 polylineEntity 或者创建新的 polylineEntity
                if (!polylineEntity) {
                    polylineEntity = this.viewer.entities.add({
                        polyline: {
                            positions: new Cesium.CallbackProperty(() => {
                                return points.map((point) => {
                                    return toCartesian(point);
                                });
                            }, false),
                            width: this.config.lineWidth,
                            material: Cesium.Color.fromCssColorString(this.config.color),
                            clampToGround:true,
                            zIndex:1
                        }
                    });
                } else {
                    // 更新 polyline 的坐标点
                    polylineEntity.polyline.positions = new Cesium.CallbackProperty(() => {
                        return points.map((point) => {
                            return toCartesian(point);
                        });
                    }, false);
                }
            }
        }
        const createPointEntity = (position) => {
            // 创建点实例
            pointsEntity.push(this.viewer.entities.add({
                position: toCartesian(position),
                point: {
                    heightReference: this.config.pickSurface === 'terrain' ? Cesium.HeightReference.CLAMP_TO_GROUND : Cesium.HeightReference.NONE,
                    pixelSize:this.config.pointSize,
                    color: Cesium.Color.fromCssColorString(this.config.color),
                    outlineColor: Cesium.Color.WHITE,
                    outlineWidth: 2,
                    zIndex:2,
                    disableDepthTestDistance: Number.POSITIVE_INFINITY,
                }
            }));
        }
        //开启拖拽点位编辑
        const startEdit = () => {
            this.handler = new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas);
            // 监听鼠标左键按下
            this.handler.setInputAction((e) => {
                const feature = this.viewer.scene.pick(e.position);
                clickIndex =  -1
                if(Cesium.defined(feature)){
                    let index = pointsEntity.findIndex(item=>item===feature.id)
                    if(index!==-1){
                        clickIndex = index
                        document.body.style.cursor = 'move';
                        this.viewer.scene.screenSpaceCameraController.enableRotate = false;
                        this.viewer.scene.screenSpaceCameraController.enableTranslate = false;
                        this.viewer.scene.screenSpaceCameraController.enableZoom = false;
                        this.handler.setInputAction((e)=>{
                            const movePosition = this._pickPosition(e.endPosition);
                            if (!movePosition) return; // 如果没有点击到地面，返回

                            const randiansPos = Cesium.Cartographic.fromCartesian(movePosition);
                            const lon = Cesium.Math.toDegrees(randiansPos.longitude);
                            const lat = Cesium.Math.toDegrees(randiansPos.latitude);
                            points[index] = this._toCoordinate(movePosition)
                            // 更新 polyline 的坐标点
                            polylineEntity.polyline.positions = new Cesium.CallbackProperty(() => {
                                return points.map((point) => {
                                    return toCartesian(point);
                                });
                            }, false);
                            pointsEntity[index].position.setValue(toCartesian(points[index]));
                        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE)
                    }
                }
            }, Cesium.ScreenSpaceEventType.LEFT_DOWN)
            this.handler.setInputAction((e)=>{
                this.viewer.scene.screenSpaceCameraController.enableRotate = true;
                this.viewer.scene.screenSpaceCameraController.enableTranslate = true;
                this.viewer.scene.screenSpaceCameraController.enableZoom = true;
                document.body.style.cursor = 'default';
                this.handler.removeInputAction(Cesium.ScreenSpaceEventType.MOUSE_MOVE);
                const feature = this.viewer.scene.pick(e.position);
                if(Cesium.defined(feature) && clickIndex>-1){
                    callback && callback(points);  // 触发回调，传递坐标点
                }
            },Cesium.ScreenSpaceEventType.LEFT_UP)
        }
        if(points.length>1){
            createLineEntity();
            points.forEach((point) => {
                createPointEntity(point);
            });
            startEdit()
            return
        }
        this.handler = new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas);
        // 监听鼠标移动，动态更新线段
        this.handler.setInputAction((e) => {
            const movePosition = this._pickPosition(e.endPosition);
            if (!movePosition) return; // 如果没有点击到地面，返回

            const randiansPos = Cesium.Cartographic.fromCartesian(movePosition);
            const lon = Cesium.Math.toDegrees(randiansPos.longitude);
            const lat = Cesium.Math.toDegrees(randiansPos.latitude);
            this.addLabel(movePosition,[lon,lat])
            // 更新跟随鼠标的临时线段（只要鼠标移动时）
            if (points.length > 0) {
                if (!tempPolylineEntity) {
                    tempPolylineEntity = this.viewer.entities.add({
                        polyline: {
                            positions: new Cesium.CallbackProperty(() => {
                                // 在最后一个点击点和鼠标当前位置之间画线
                                let lastPoint = points[points.length - 1];
                                return [
                                    toCartesian(lastPoint),
                                    toCartesian(this._toCoordinate(movePosition))
                                ];
                            }, false),
                            width: this.config.lineWidth,
                            material: new Cesium.PolylineDashMaterialProperty({
                                color: Cesium.Color.fromCssColorString(this.config.color).withAlpha(0.5), // 虚线颜色及透明度
                                dashLength: 20 //短划线长度
                            })

                        }
                    });
                } else {
                    tempPolylineEntity.polyline.positions = new Cesium.CallbackProperty(() => {
                        let lastPoint = points[points.length - 1];
                        return [
                            toCartesian(lastPoint),
                            toCartesian(this._toCoordinate(movePosition))
                        ];
                    }, false);
                }
            }
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
        // 监听左键点击，记录坐标并绘制线段
        this.handler.setInputAction((e) => {
            const clickPosition = this._pickPosition(e.position);
            if (!clickPosition) return; // 如果没有点击到地面，返回

            const randiansPos = Cesium.Cartographic.fromCartesian(clickPosition);
            const lon = Cesium.Math.toDegrees(randiansPos.longitude);
            const lat = Cesium.Math.toDegrees(randiansPos.latitude);
            if(points.length > 0){
                let lastLon = points[points.length - 1][0];
                let lastLat = points[points.length - 1][1];
                if(lastLon===lon && lastLat===lat){
                    return;
                }
            }
            points.push(this._toCoordinate(clickPosition));  // 保存坐标（可选包含高度）

            // 绘制线段
            createLineEntity()
            createPointEntity(points.at(-1))

        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

        // 监听右键点击，结束绘制，回调并销毁事件
        this.handler.setInputAction((e) => {
            this.viewer.entities.remove(tempPolylineEntity);
            this.destroy()
            if(points.length<2){
                this.viewer.entities.remove(pointsEntity[0])
                console.warn('请至少选择两个点')
            }else{
                if(!this.config.isReserve){
                    this.viewer.entities.remove(polylineEntity);
                    pointsEntity.forEach(item=>{
                        this.viewer.entities.remove(item)
                    })
                }else {
                    startEdit()
                }
                callback && callback(points);  // 触发回调，传递坐标点
            }

        }, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
    }
    /**
     * 拾取面
     * @param callback
     */
    pickPolygon(callback,data= []) {
        let points = data;
        let polylineEntity = null;  // 用于存储绘制的线段
        let polygonEntity = null; // 用于存储绘制的面
        let tempPolylineEntity = null;  // 临时线段，跟随鼠标移动
        let pointsEntity = []; // 用于存储绘制的点

        let clickIndex= -1
        // 初始化线实例
        const createLineEntity = (points) => {
            // 绘制线段
            if (points.length > 1) {

                // 更新现有的 polylineEntity 或者创建新的 polylineEntity
                if (!polylineEntity) {
                    polylineEntity = this.viewer.entities.add({
                        polyline: {
                            positions: new Cesium.CallbackProperty(() => {
                                return points.map((point) => {
                                    return toCartesian(point);
                                });
                            }, false),
                            width: this.config.lineWidth,
                            material: Cesium.Color.fromCssColorString(this.config.color),
                            clampToGround:true,
                            zIndex:1
                        }
                    });
                } else {
                    // 更新 polyline 的坐标点
                    polylineEntity.polyline.positions = new Cesium.CallbackProperty(() => {
                        return points.map((point) => {
                            return toCartesian(point);
                        });
                    }, false);
                }
            }
        }
        // 初始化面实例
        const createPolygonEntity = () => {
            if(points.length>2){
                let nowPoints = []
                points.forEach(item=>{
                    nowPoints.push(item[0], item[1])
                })
                if(!polygonEntity){
                    polygonEntity = this.viewer.entities.add({
                        polygon: {
                            hierarchy: new Cesium.CallbackProperty(() => {
                                return new Cesium.PolygonHierarchy(Cesium.Cartesian3.fromDegreesArray(nowPoints));
                            }, false),
                            material: Cesium.Color.fromCssColorString(this.config.color).withAlpha(this.config.fillOpacity),
                            outline: false
                        }
                    })
                }else{
                    polygonEntity.polygon.hierarchy = new Cesium.CallbackProperty(() => {
                        return new Cesium.PolygonHierarchy(Cesium.Cartesian3.fromDegreesArray(nowPoints));
                    }, false);
                }
            }
        }
        // 初始化点实例
        const createPointEntity = (position) => {
            // 创建点实例
            pointsEntity.push(this.viewer.entities.add({
                position: toCartesian(position),
                point: {
                    heightReference: this.config.pickSurface === 'terrain' ? Cesium.HeightReference.CLAMP_TO_GROUND : Cesium.HeightReference.NONE,
                    pixelSize:this.config.pointSize,
                    color: Cesium.Color.fromCssColorString(this.config.color),
                    outlineColor: Cesium.Color.WHITE,
                    outlineWidth: 2,
                    zIndex:2,
                    disableDepthTestDistance: Number.POSITIVE_INFINITY,
                }
            }));
        }
        //开启拖拽点位编辑
        const startEdit = () => {
            this.handler = new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas);
            // 监听鼠标左键按下
            this.handler.setInputAction((e) => {
                const feature = this.viewer.scene.pick(e.position);
                clickIndex =  -1
                if(Cesium.defined(feature)){
                    let index = pointsEntity.findIndex(item=>item===feature.id)
                    if(index!==-1){
                        clickIndex = index
                        document.body.style.cursor = 'move';
                        this.viewer.scene.screenSpaceCameraController.enableRotate = false;
                        this.viewer.scene.screenSpaceCameraController.enableTranslate = false;
                        this.viewer.scene.screenSpaceCameraController.enableZoom = false;
                        this.handler.setInputAction((e)=>{
                            const movePosition = this._pickPosition(e.endPosition);
                            if (!movePosition) return; // 如果没有点击到地面，返回

                            const randiansPos = Cesium.Cartographic.fromCartesian(movePosition);
                            const lon = Cesium.Math.toDegrees(randiansPos.longitude);
                            const lat = Cesium.Math.toDegrees(randiansPos.latitude);
                            points[index] = this._toCoordinate(movePosition)
                            let linePoints = [...points,points[0]]
                            // 更新 polyline 的坐标点
                            createLineEntity(linePoints)
                            let nowPoints = []
                            points.forEach(item=>{
                                nowPoints.push(item[0], item[1])
                            })
                            polygonEntity.polygon.hierarchy = new Cesium.CallbackProperty(() => {
                                return new Cesium.PolygonHierarchy(Cesium.Cartesian3.fromDegreesArray(nowPoints));
                            }, false)
                            pointsEntity[index].position.setValue(toCartesian(points[index]));
                        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE)
                    }
                }
            }, Cesium.ScreenSpaceEventType.LEFT_DOWN)
            this.handler.setInputAction((e)=>{
                this.viewer.scene.screenSpaceCameraController.enableRotate = true;
                this.viewer.scene.screenSpaceCameraController.enableTranslate = true;
                this.viewer.scene.screenSpaceCameraController.enableZoom = true;
                document.body.style.cursor = 'default';
                this.handler.removeInputAction(Cesium.ScreenSpaceEventType.MOUSE_MOVE);
                const feature = this.viewer.scene.pick(e.position);
                if(Cesium.defined(feature) && clickIndex>-1){
                    callback && callback(points);  // 触发回调，传递坐标点
                }
            },Cesium.ScreenSpaceEventType.LEFT_UP)
        }
        if(points.length>1){
            let linePoints = [...points,points[0]]
            createLineEntity(linePoints);
            createPolygonEntity()
            points.forEach((point) => {
                createPointEntity(point);
            });
            startEdit()
            return
        }
        this.handler = new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas);
        // 监听鼠标移动，动态更新线段
        this.handler.setInputAction((e) => {
            const movePosition = this._pickPosition(e.endPosition);
            if (!movePosition) return; // 如果没有点击到地面，返回

            const randiansPos = Cesium.Cartographic.fromCartesian(movePosition);
            const lon = Cesium.Math.toDegrees(randiansPos.longitude);
            const lat = Cesium.Math.toDegrees(randiansPos.latitude);
            this.addLabel(movePosition,[lon,lat])
            // 更新跟随鼠标的临时线段（只要鼠标移动时）
            if (points.length > 0) {
                if (!tempPolylineEntity) {
                    tempPolylineEntity = this.viewer.entities.add({
                        polyline: {
                            positions: new Cesium.CallbackProperty(() => {
                                // 在最后一个点击点和鼠标当前位置之间画线
                                let firstPoint = points[0];
                                let lastPoint = points[points.length - 1];
                                return [
                                    toCartesian(lastPoint),
                                    toCartesian(this._toCoordinate(movePosition)),
                                    toCartesian(firstPoint)
                                ];
                            }, false),
                            width: this.config.lineWidth,
                            material: new Cesium.PolylineDashMaterialProperty({
                                color: Cesium.Color.fromCssColorString(this.config.color).withAlpha(0.5), // 虚线颜色及透明度
                                dashLength: 20 //短划线长度
                            })

                        }
                    });
                } else {
                    tempPolylineEntity.polyline.positions = new Cesium.CallbackProperty(() => {
                        let lastPoint = points[points.length - 1];
                        let firstPoint = points[0];
                        return [
                            toCartesian(lastPoint),
                            toCartesian(this._toCoordinate(movePosition)),
                            toCartesian(firstPoint)
                        ];
                    }, false);
                }
            }
            if(points.length>1){
                let nowPoints = []
                points.forEach(item=>{
                    nowPoints.push(item[0], item[1])
                })
                if(!polygonEntity){
                    polygonEntity = this.viewer.entities.add({
                        polygon: {
                            hierarchy: new Cesium.CallbackProperty(() => {
                                let lastLon = nowPoints[nowPoints.length - 2];
                                let lastLat = nowPoints[nowPoints.length - 1];
                                if(lastLon!==lon && lastLat!==lat){
                                    nowPoints.push(lon, lat)
                                }
                                return new Cesium.PolygonHierarchy(Cesium.Cartesian3.fromDegreesArray(nowPoints));
                            }, false),
                            material: Cesium.Color.fromCssColorString(this.config.color).withAlpha(this.config.fillOpacity),
                            outline: false
                        }
                    })
                }else{
                    polygonEntity.polygon.hierarchy = new Cesium.CallbackProperty(() => {
                        let lastLon = nowPoints[nowPoints.length - 2];
                        let lastLat = nowPoints[nowPoints.length - 1];
                        if(lastLon!==lon && lastLat!==lat){
                            nowPoints.push(lon, lat)
                        }
                        return new Cesium.PolygonHierarchy(Cesium.Cartesian3.fromDegreesArray(nowPoints));
                    }, false);
                }
            }
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
        // 监听左键点击，记录坐标并绘制线段
        this.handler.setInputAction((e) => {
            const clickPosition = this._pickPosition(e.position);
            if (!clickPosition) return; // 如果没有点击到地面，返回

            const randiansPos = Cesium.Cartographic.fromCartesian(clickPosition);
            const lon = Cesium.Math.toDegrees(randiansPos.longitude);
            const lat = Cesium.Math.toDegrees(randiansPos.latitude);
            if(points.length > 0){
                let lastLon = points[points.length - 1][0];
                let lastLat = points[points.length - 1][1];
                if(lastLon===lon && lastLat===lat){
                    return;
                }
            }
            points.push(this._toCoordinate(clickPosition));  // 保存坐标（可选包含高度）

            // 绘制线段
            createLineEntity(points)
            createPolygonEntity()
            createPointEntity(points.at(-1))

        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

        // 监听右键点击，结束绘制，回调并销毁事件
        this.handler.setInputAction((e) => {
            this.viewer.entities.remove(tempPolylineEntity);
            this.destroy()
            if(points.length<3){
                pointsEntity.forEach(item=>{
                    this.viewer.entities.remove(item)
                })
                this.viewer.entities.remove(polylineEntity)
                console.warn('请至少选择三个点')
            }else{
                if(!this.config.isReserve){
                    this.viewer.entities.remove(polylineEntity);
                    this.viewer.entities.remove(polygonEntity);
                    pointsEntity.forEach(item=>{
                        this.viewer.entities.remove(item)
                    })
                }else {
                    // 更新 polyline 的坐标点
                    let linePoints = []
                    points.forEach(item=>{
                        linePoints.push([...item])
                    })
                    linePoints.push([...points[0]])
                    createLineEntity(linePoints)
                    startEdit()
                }
                callback && callback(points);  // 触发回调，传递坐标点
            }

        }, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
    }

    /**
     * 绘制正方形。第一次单击确定一个角点，第二次单击确定对角方向。
     * @param {Function} callback 完成或编辑后的回调
     * @param {Object|Array} data 可选的初始图形数据
     */
    pickSquare(callback, data = []) {
        this._pickRegularShape('square', callback, data)
    }

    /**
     * 绘制矩形。两次单击分别确定一组对角点。
     * @param {Function} callback 完成或编辑后的回调
     * @param {Object|Array} data 可选的初始图形数据
     */
    pickRectangle(callback, data = []) {
        this._pickRegularShape('rectangle', callback, data)
    }

    /**
     * 绘制圆形。第一次单击确定圆心，第二次单击确定半径，半径单位由 config.unit 指定。
     * @param {Function} callback 完成或编辑后的回调
     * @param {Object|Array} data 可选的初始图形数据
     */
    pickCircle(callback, data = []) {
        this._pickRegularShape('circle', callback, data)
    }

    /**
     * 绘制椭圆。第一次单击确定中心，第二次单击确定东西、南北方向半径。
     * @param {Function} callback 完成或编辑后的回调
     * @param {Object|Array} data 可选的初始图形数据
     */
    pickEllipse(callback, data = []) {
        this._pickRegularShape('ellipse', callback, data)
    }

    _normalizeShapeData(type, data) {
        if (!data || (Array.isArray(data) && data.length === 0)) return null

        if (Array.isArray(data) && isCoordinate(data[0]) && isCoordinate(data[1])) {
            return {
                anchor: cloneCoordinate(data[0]),
                control: cloneCoordinate(data[1]),
            }
        }

        if (typeof data !== 'object' || Array.isArray(data)) return null

        // 带单位的回调结果可以重新传入；未指定 data.unit 时采用实例配置。
        const metersPerUnit = normalizeUnit(data.unit ?? this.config.unit) === 'km' ? 1000 : 1

        let anchor = data.anchor || data.center || data.southwest
        let control = data.control || data.northeast

        if (!isCoordinate(anchor) && Array.isArray(data.coordinates) && isCoordinate(data.coordinates[0])) {
            anchor = data.coordinates[0]
        }
        if (!isCoordinate(control) && Array.isArray(data.coordinates)) {
            const oppositeIndex = data.coordinates.length > 2 ? 2 : 1
            control = data.coordinates[oppositeIndex]
        }

        if (isCoordinate(anchor) && !isCoordinate(control) && type === 'circle') {
            const radius = Number(data.radius) * metersPerUnit
            if (Number.isFinite(radius) && radius > 0) {
                control = offsetCoordinate(anchor, radius, 0)
            }
        }

        if (isCoordinate(anchor) && !isCoordinate(control) && type === 'ellipse') {
            const major = Number(data.semiMajorAxis) * metersPerUnit
            const minor = Number(data.semiMinorAxis) * metersPerUnit
            const eastRadius = Number(data.eastRadius) * metersPerUnit
            const northRadius = Number(data.northRadius) * metersPerUnit
            if (Number.isFinite(eastRadius) && Number.isFinite(northRadius)) {
                control = offsetCoordinate(anchor, eastRadius, northRadius)
            } else if (Number.isFinite(major) && Number.isFinite(minor)) {
                const isEastMajor = Math.abs(Number(data.rotation) - Cesium.Math.PI_OVER_TWO) < 0.001
                control = offsetCoordinate(anchor, isEastMajor ? major : minor, isEastMajor ? minor : major)
            }
        }

        if (!isCoordinate(anchor) || !isCoordinate(control)) return null
        return {
            anchor: cloneCoordinate(anchor),
            control: cloneCoordinate(control),
        }
    }

    // 内部几何尺寸保持米制，避免 unit: 'km' 导致绘制或拖拽的图形缩小 1000 倍。
    _buildShapeResult(type, anchor, control) {
        if (!isCoordinate(anchor) || !isCoordinate(control)) return null

        if (type === 'rectangle') {
            const coordinates = [
                cloneCoordinate(anchor),
                [control[0], anchor[1]],
                cloneCoordinate(control),
                [anchor[0], control[1]],
            ]
            const width = getSurfaceDistance(coordinates[0], coordinates[1])
            const height = getSurfaceDistance(coordinates[0], coordinates[3])
            if (width < MIN_SHAPE_SIZE || height < MIN_SHAPE_SIZE) return null
            return {
                type: 'rectangle',
                anchor: cloneCoordinate(anchor),
                control: cloneCoordinate(control),
                center: [(anchor[0] + control[0]) / 2, (anchor[1] + control[1]) / 2],
                west: Math.min(anchor[0], control[0]),
                south: Math.min(anchor[1], control[1]),
                east: Math.max(anchor[0], control[0]),
                north: Math.max(anchor[1], control[1]),
                width,
                height,
                coordinates,
            }
        }

        const offset = getLocalOffset(anchor, control)

        if (type === 'square') {
            const sideLength = Math.max(Math.abs(offset.east), Math.abs(offset.north))
            if (sideLength < MIN_SHAPE_SIZE) return null
            const east = (offset.east < 0 ? -1 : 1) * sideLength
            const north = (offset.north < 0 ? -1 : 1) * sideLength
            const coordinates = [
                cloneCoordinate(anchor),
                offsetCoordinate(anchor, east, 0),
                offsetCoordinate(anchor, east, north),
                offsetCoordinate(anchor, 0, north),
            ]
            return {
                type: 'square',
                anchor: cloneCoordinate(anchor),
                control: cloneCoordinate(coordinates[2]),
                center: offsetCoordinate(anchor, east / 2, north / 2),
                sideLength,
                width: sideLength,
                height: sideLength,
                coordinates,
            }
        }

        if (type === 'circle') {
            const radius = getSurfaceDistance(anchor, control)
            if (radius < MIN_SHAPE_SIZE) return null
            return {
                type: 'circle',
                center: cloneCoordinate(anchor),
                control: cloneCoordinate(control),
                radius,
            }
        }

        const eastRadius = Math.abs(offset.east)
        const northRadius = Math.abs(offset.north)
        if (eastRadius < MIN_SHAPE_SIZE || northRadius < MIN_SHAPE_SIZE) return null
        const isEastMajor = eastRadius >= northRadius
        return {
            type: 'ellipse',
            center: cloneCoordinate(anchor),
            control: cloneCoordinate(control),
            eastRadius,
            northRadius,
            semiMajorAxis: Math.max(eastRadius, northRadius),
            semiMinorAxis: Math.min(eastRadius, northRadius),
            rotation: isEastMajor ? Cesium.Math.PI_OVER_TWO : 0,
            rotationDegrees: isEastMajor ? 90 : 0,
        }
    }

    _formatShapeResult(result) {
        const formatted = { ...result, unit: this.config.unit }
        const metersPerUnit = this.config.unit === 'km' ? 1000 : 1
        for (const field of SHAPE_DISTANCE_FIELDS) {
            if (Number.isFinite(result[field])) formatted[field] = result[field] / metersPerUnit
        }
        return formatted
    }

    _pickRegularShape(type, callback, data) {
        this.destroy()

        const initialState = this._normalizeShapeData(type, data)
        const state = {
            anchor: initialState?.anchor || null,
            control: initialState?.control || null,
        }
        const entities = []
        const handles = []
        let shapeEntity = null
        let outlineEntity = null
        let activeHandle = -1

        const getResult = () => this._buildShapeResult(type, state.anchor, state.control)
        const screenToCoordinate = (position) => {
            const cartesian = this._pickPosition(
                position,
                this.viewer.scene.globe?.ellipsoid || Cesium.Ellipsoid.WGS84,
            )
            return cartesian ? toCoordinate(cartesian) : null
        }
        const restoreCameraControls = () => {
            const controller = this.viewer.scene.screenSpaceCameraController
            controller.enableRotate = true
            controller.enableTranslate = true
            controller.enableZoom = true
            document.body.style.cursor = 'default'
        }
        const removeEntities = () => {
            entities.forEach((entity) => this.viewer.entities.remove(entity))
            entities.length = 0
            handles.length = 0
            shapeEntity = null
            outlineEntity = null
        }
        const getHandleCoordinate = (index) => {
            if (index === 0) return state.anchor
            const result = getResult()
            return type === 'square' ? result?.control : state.control
        }
        const createHandle = (index) => {
            if (handles[index]) return handles[index]
            const entity = this.viewer.entities.add({
                position: new Cesium.CallbackProperty(() => {
                    const coordinate = getHandleCoordinate(index)
                    return coordinate ? toCartesian(coordinate) : undefined
                }, false),
                point: {
                    heightReference: this.config.pickSurface === 'terrain' ? Cesium.HeightReference.CLAMP_TO_GROUND : Cesium.HeightReference.NONE,
                    pixelSize: this.config.pointSize,
                    color: Cesium.Color.fromCssColorString(this.config.color),
                    outlineColor: Cesium.Color.WHITE,
                    outlineWidth: 2,
                    disableDepthTestDistance: Number.POSITIVE_INFINITY,
                },
            })
            handles[index] = entity
            entities.push(entity)
            return entity
        }
        const ensureShapeEntities = () => {
            const result = getResult()
            if (!result || shapeEntity) return Boolean(result)

            createHandle(1)
            const color = Cesium.Color.fromCssColorString(this.config.color)
            if (type === 'square' || type === 'rectangle') {
                shapeEntity = this.viewer.entities.add({
                    polygon: {
                        hierarchy: new Cesium.CallbackProperty(() => {
                            const current = getResult()
                            if (!current) return undefined
                            const values = current.coordinates.flatMap((coordinate) => coordinate)
                            return new Cesium.PolygonHierarchy(Cesium.Cartesian3.fromDegreesArray(values))
                        }, false),
                        material: color.withAlpha(this.config.fillOpacity),
                        outline: false,
                    },
                })
                outlineEntity = this.viewer.entities.add({
                    polyline: {
                        positions: new Cesium.CallbackProperty(() => {
                            const current = getResult()
                            if (!current) return []
                            return [...current.coordinates, current.coordinates[0]].map(toCartesian)
                        }, false),
                        width: this.config.lineWidth,
                        material: color,
                        clampToGround: true,
                    },
                })
                entities.push(shapeEntity, outlineEntity)
            } else {
                shapeEntity = this.viewer.entities.add({
                    position: new Cesium.CallbackProperty(() => {
                        const current = getResult()
                        return current ? toCartesian(current.center) : undefined
                    }, false),
                    ellipse: {
                        semiMajorAxis: new Cesium.CallbackProperty(() => {
                            const current = getResult()
                            return current?.semiMajorAxis || current?.radius || MIN_SHAPE_SIZE
                        }, false),
                        semiMinorAxis: new Cesium.CallbackProperty(() => {
                            const current = getResult()
                            return current?.semiMinorAxis || current?.radius || MIN_SHAPE_SIZE
                        }, false),
                        rotation: new Cesium.CallbackProperty(() => getResult()?.rotation || 0, false),
                        material: color.withAlpha(this.config.fillOpacity),
                        outline: true,
                        outlineColor: color,
                        outlineWidth: this.config.lineWidth,
                    },
                })
                entities.push(shapeEntity)
            }
            return true
        }
        const emitResult = () => {
            const result = getResult()
            if (result) callback && callback(this._formatShapeResult(result))
        }
        const startEdit = () => {
            this.destroy()
            this.handler = new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas)
            this.handler.setInputAction((event) => {
                const feature = this.viewer.scene.pick(event.position)
                activeHandle = handles.findIndex((entity) => entity === feature?.id)
                if (activeHandle < 0) return
                document.body.style.cursor = 'move'
                const controller = this.viewer.scene.screenSpaceCameraController
                controller.enableRotate = false
                controller.enableTranslate = false
                controller.enableZoom = false
                this.handler.setInputAction((moveEvent) => {
                    const coordinate = screenToCoordinate(moveEvent.endPosition)
                    if (!coordinate) return
                    if (activeHandle === 0) state.anchor = coordinate
                    else state.control = coordinate
                    this.viewer.scene.requestRender()
                }, Cesium.ScreenSpaceEventType.MOUSE_MOVE)
            }, Cesium.ScreenSpaceEventType.LEFT_DOWN)
            this.handler.setInputAction(() => {
                const shouldEmit = activeHandle >= 0
                activeHandle = -1
                restoreCameraControls()
                this.handler.removeInputAction(Cesium.ScreenSpaceEventType.MOUSE_MOVE)
                if (shouldEmit) emitResult()
            }, Cesium.ScreenSpaceEventType.LEFT_UP)
        }
        const finishDrawing = () => {
            const result = getResult()
            if (!result) return
            this.destroy()
            if (this.config.isReserve) startEdit()
            else removeEntities()
            callback && callback(this._formatShapeResult(result))
        }

        if (initialState) {
            if (ensureShapeEntities()) {
                createHandle(0)
                startEdit()
                return
            }
            state.anchor = null
            state.control = null
        }

        this.handler = new Cesium.ScreenSpaceEventHandler(this.viewer.scene.canvas)
        this.handler.setInputAction((event) => {
            const coordinate = screenToCoordinate(event.endPosition)
            if (!coordinate) return
            this.addLabel(toCartesian(coordinate), coordinate)
            if (!state.anchor) return
            state.control = coordinate
            ensureShapeEntities()
            this.viewer.scene.requestRender()
        }, Cesium.ScreenSpaceEventType.MOUSE_MOVE)
        this.handler.setInputAction((event) => {
            const coordinate = screenToCoordinate(event.position)
            if (!coordinate) return
            if (!state.anchor) {
                state.anchor = coordinate
                createHandle(0)
                return
            }
            state.control = coordinate
            if (ensureShapeEntities()) finishDrawing()
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK)
    }

    addLabel(movePosition,position){
        if(!this.label){
            this.label = this.viewer.entities.add({
                label: {
                    text: '',
                    showBackground: true,
                    font: '14px sans-serif',
                    horizontalOrigin: Cesium.HorizontalOrigin.LEFT,
                    verticalOrigin: Cesium.VerticalOrigin.TOP,
                    pixelOffset: new Cesium.Cartesian2(10, 10),
                    fillColor: Cesium.Color.WHITE,
                    outlineColor: Cesium.Color.BLACK,
                    disableDepthTestDistance: Number.POSITIVE_INFINITY,
                }
            })
        }
        this.label.position = movePosition
        this.label.label.text = this.config.mouseHints.text +'\n'+`经度：${position[0]}°\n纬度：${position[1]}°`
    }
    removeLabel(){
        this.label && this.viewer.entities.remove(this.label)
        this.label = null
    }
    clear(){
        this.destroy()
        this.viewer.entities.removeAll()
    }
    destroy(){
        this.removeLabel()
        this.handler && this.handler.destroy()
        this.handler = null
        const controller = this.viewer?.scene?.screenSpaceCameraController
        if(controller){
            controller.enableRotate = true
            controller.enableTranslate = true
            controller.enableZoom = true
        }
        if(typeof document !== 'undefined') document.body.style.cursor = 'default'
    }


}
