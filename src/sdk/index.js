import BMapViewer from './components/BMapViewer.vue'
import PickTools from './utils/PickTools.js'
import SpatialAnalysis from './utils/SpatialAnalysis.js'
import TerrainAnalysis from './utils/TerrainAnalysis.js'
import EarthColor from './utils/EarthColor.js'
import MapLayers from './layer/index.js'
import BaseMaps from './base-map/index.js'
import WeatherEffects from './weather/index.js'
import * as turf from '@turf/turf'
import 'cesium/Build/Cesium/Widgets/widgets.css'
import './styles/popup.css'

BMapViewer.install = (app) => {
    app.component('BMapViewer', BMapViewer)
}

const BMapViewerPlugin = {
    install(app) {
        app.use(BMapViewer)
    },
}

export { MapLayers, BaseMaps, WeatherEffects }
export {
    BaseMap,
    CesiumTerrain,
    TdtTerrain,
    createCesiumTerrainProvider,
    CESIUM_WORLD_TERRAIN_ASSET_ID,
    createCesiumImageryProvider,
    cesiumImageryStyles,
    createImageryProvider,
    imageryProviderTypes,
    AMapImageryProvider,
    ArcGISImageryProvider,
    arcgisWorldImageryUrl,
    BaiduImageryProvider,
    baiduImageryStyles,
    TencentImageryProvider,
    TdtImageryProvider,
    TdtTerrainProvider,
    tdtTerrainUrl,
    tdtTerrainSubdomains,
    GoogleImageryProvider,
    googleImageryStyles,
    GeoVisImageryProvider,
    GCJ02TilingScheme,
    BD09TilingScheme,
    CustomGeographicTilingScheme,
    CustomMercatorTilingScheme,
    BD09Projection,
    CoordTransform,
} from './base-map/index.js'
export {
    WeatherSystem,
    createWeatherEffect,
    weatherEffectTypes,
    BaseWeatherEffect,
    RainEffect,
    SnowEffect,
    FogEffect,
    HeightFogEffect,
    SandstormEffect,
    CloudEffect,
    LightningEffect,
} from './weather/index.js'
export { PickTools, SpatialAnalysis, TerrainAnalysis, EarthColor, turf }
export { useCesium } from './composables/useCesium'
export { BMapViewer }
export default BMapViewerPlugin

