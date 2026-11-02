import * as Cesium from "cesium";
import { VolumeTexture } from "./gl/VolumeTexture.js";
import { atmosphereUniforms } from "./atmosphere/atmosphereGlsl.js";
import { computeLayerUniforms } from "./CloudLayers.js";
import { bayerOffsets } from "./bayer.js";

// 云 march 所需的全部 uniform：纹理 + 参数 + 云层 + 大气 + 相机矩阵。
// 单位：米（ECEF）。Cesium 世界系即 ECEF，故 worldToECEFMatrix = 单位阵。

const BOTTOM_RADIUS = 6360000; // m（与大气 LUT 的 6360km 对齐）
const TOP_RADIUS = 6420000; // m

// WGS84 椭球半径（用于 altitudeCorrection）
const WGS84_A = Cesium.Ellipsoid.WGS84.radii.x;
const WGS84_B = Cesium.Ellipsoid.WGS84.radii.z;
const WGS84_A2 = WGS84_A * WGS84_A;
const WGS84_B2 = WGS84_B * WGS84_B;

const scratchSurface = new Cesium.Cartesian3();
const scratchNormal = new Cesium.Cartesian3();

const fract = (x) => x - Math.floor(x);

// 移植 getAltitudeCorrectionOffset：椭球表面点的密切球中心，取负。
function computeAltitudeCorrection(cameraPositionECEF, result) {
  const surface = Cesium.Ellipsoid.WGS84.scaleToGeodeticSurface(
    cameraPositionECEF,
    scratchSurface,
  );
  if (!surface) {
    return Cesium.Cartesian3.clone(Cesium.Cartesian3.ZERO, result);
  }
  const n = Cesium.Cartesian3.fromElements(
    surface.x / WGS84_A2,
    surface.y / WGS84_A2,
    surface.z / WGS84_B2,
    scratchNormal,
  );
  Cesium.Cartesian3.normalize(n, n);
  // center = surface - n * bottomRadius；altitudeCorrection = -center
  const center = Cesium.Cartesian3.subtract(
    surface,
    Cesium.Cartesian3.multiplyByScalar(n, BOTTOM_RADIUS, n),
    result,
  );
  return Cesium.Cartesian3.negate(center, result);
}

export class CloudUniforms {
  constructor(context, { noise, weather, stbn, atmo }) {
    this._context = context;
    this._noise = noise;
    this._weather = weather;
    this._stbn = stbn;
    this._atmo = atmo;

    // 1×1×1 全零假 shadowBuffer（Phase 3 无级联阴影）
    try {
      this._fakeShadow = new VolumeTexture({
        context,
        source: {
          arrayBufferView: new Uint8Array(4),
          width: 1,
          height: 1,
          depth: 1,
        },
        pixelFormat: Cesium.PixelFormat.RGBA,
        pixelDatatype: Cesium.PixelDatatype.UNSIGNED_BYTE,
        flipY: false,
        sampler: new Cesium.Sampler({
          minificationFilter: Cesium.TextureMinificationFilter.NEAREST,
          magnificationFilter: Cesium.TextureMagnificationFilter.NEAREST,
        }),
      });

      // 1×1 假深度（globeDepthTexture 未就绪时兜底：打包深度=1 → 无遮挡）
      this._dummyDepth = new Cesium.Texture({
        context,
        width: 1,
        height: 1,
        pixelFormat: Cesium.PixelFormat.RGBA,
        pixelDatatype: Cesium.PixelDatatype.UNSIGNED_BYTE,
        source: {
          arrayBufferView: new Uint8Array([255, 255, 255, 255]),
          width: 1,
          height: 1,
        },
      });

    } catch (error) {
      this.destroy();
      throw error;
    }

    // 可调参数
    this.params = {
      scatteringCoefficient: 1,
      absorptionCoefficient: 0,
      coverage: 0.3,
      localWeatherRepeat: 100,
      shapeRepeat: 0.0003,
      shapeDetailRepeat: 0.006,
      turbulenceRepeat: 20,
      turbulenceDisplacement: 350,
    };
    this.scattering = {
      skyLightScale: 1,
      groundBounceScale: 1,
      powderScale: 0.8,
      powderExponent: 150,
    };
    // high 预设
    this.march = {
      maxIterationCount: 500,
      minStepSize: 50,
      maxStepSize: 1000,
      maxRayDistance: 2e5,
      perspectiveStepScale: 1.01,
      minDensity: 1e-5,
      minExtinction: 1e-5,
      minTransmittance: 1e-2,
      maxIterationCountToSun: 2,
      maxIterationCountToGround: 3,
      minSecondaryStepSize: 100,
      secondaryStepScale: 2,
    };
    this.haze = {
      hazeDensityScale: 3e-5,
      hazeExponent: 1e-3,
      hazeScatteringCoefficient: 0.9,
      hazeAbsorptionCoefficient: 0.5,
    };

    this.temporalUpscale = false; // Phase 6:1/4 线性分辨率 march + Bayer 抖动
    this.disableSceneClamp = false; // A/B 调试：true 时 march 跳过地形深度裁剪
    this.layers = null; // 由 pipeline 注入
    this.shadow = null; // { texture, matrices, intervals, far, texelSize }，由 ShadowPass 注入
    this._layerUniforms = null;
    this._layersDirty = true;

    // 风场（纹理空间/秒，GUI 换算写入）；offset 每帧按真实时间累积，驱动云移动。
    this.wind = {
      localWeatherVelocity: new Cesium.Cartesian2(0, 0),
      shapeVelocity: new Cesium.Cartesian3(0, 0, 0),
      shapeDetailVelocity: new Cesium.Cartesian3(0, 0, 0),
    };
    this._localWeatherOffset = new Cesium.Cartesian2(0, 0);
    this._shapeOffset = new Cesium.Cartesian3(0, 0, 0);
    this._shapeDetailOffset = new Cesium.Cartesian3(0, 0, 0);
    this._lastWindNowMs = undefined;

    // 每帧状态
    this._state = {
      viewMatrix: new Cesium.Matrix4(),
      inverseViewMatrix: new Cesium.Matrix4(),
      inverseProjectionMatrix: new Cesium.Matrix4(),
      reprojectionMatrix: new Cesium.Matrix4(),
      viewReprojectionMatrix: new Cesium.Matrix4(),
      sunDirection: new Cesium.Cartesian3(0, 0, 1),
      altitudeCorrection: new Cesium.Cartesian3(),
      cameraPositionECEF: new Cesium.Cartesian3(),
      cameraDirection: new Cesium.Cartesian3(0, 0, -1),
      cameraNear: 1,
      cameraFar: 1e7,
      cameraHeight: 0,
      resolution: new Cesium.Cartesian2(1, 1),
      temporalJitter: new Cesium.Cartesian2(0, 0),
      targetUvScale: new Cesium.Cartesian2(1, 1),
      mipLevelScale: 1,
      depthIsValid: 1, // 本帧 globe 深度是否新鲜（0=stale，shader 跳过深度读取）
      historyClipRelax: 0, // 相机平移时放宽 TAA variance clipping（0=静止严格）
      marchJitterFreeze: 0, // 运动时冻结 march 起始抖动（0=静止全抖动，1=固定相位）
      sunMotion: 0, // 拖时间轴时太阳运动强度（带衰减，驱动 marchJitterFreeze）
      frame: 0,
    };
    this._prevProjection = null;
    this._prevView = null;
    this._scratch = {
      camPos: new Cesium.Cartesian3(),
      proj: new Cesium.Matrix4(),
      m: new Cesium.Matrix4(),
    };
  }

  markLayersDirty() {
    this._layersDirty = true;
  }

  get state() {
    return this._state;
  }

  _updateLayers() {
    if (this._layersDirty && this.layers) {
      this._layerUniforms = computeLayerUniforms(this.layers);
      this._layersDirty = false;
    }
    return this._layerUniforms;
  }

  /** 每帧更新相机/太阳/矩阵/帧号（在执行 march pass 前调用） */
  update(scene, targetWidth, targetHeight) {
    const camera = scene.camera;
    const s = this._state;
    const sc = this._scratch;

    // 帧号在最前自增：抖动、march、resolve 读到同一 frame（升采样 Bayer 归属对齐）
    s.frame = (s.frame + 1) % 1000000;

    // 风场位移累积：用真实时间（performance.now），不用 Cesium clock——
    // 拖时间轴改变 clock.currentTime 只应改变太阳方向，不应带动云跳位。
    {
      const nowMs = performance.now();
      const dt =
        this._lastWindNowMs === undefined
          ? 0
          : Math.min(Math.max((nowMs - this._lastWindNowMs) / 1000, 0), 0.1);
      this._lastWindNowMs = nowMs;
      const w = this.wind;

      this._localWeatherOffset.x += w.localWeatherVelocity.x * dt;
      this._localWeatherOffset.y += w.localWeatherVelocity.y * dt;
      // 被 length() 派生 evolution（clouds.glsl），不能 fract 回绕；仅作极端量级下的
      // 保护性整数回绕（常规风速下需连续运行数百天才会触发，实际不会遇到）。
      if (Math.abs(this._localWeatherOffset.x) > 1e4) {
        this._localWeatherOffset.x -= Math.trunc(this._localWeatherOffset.x);
      }
      if (Math.abs(this._localWeatherOffset.y) > 1e4) {
        this._localWeatherOffset.y -= Math.trunc(this._localWeatherOffset.y);
      }

      // shape/detail 纹理 REPEAT、周期 1 → fract 回绕对采样无感，避免无界增长。
      this._shapeOffset.x = fract(this._shapeOffset.x + w.shapeVelocity.x * dt);
      this._shapeOffset.y = fract(this._shapeOffset.y + w.shapeVelocity.y * dt);
      this._shapeOffset.z = fract(this._shapeOffset.z + w.shapeVelocity.z * dt);
      this._shapeDetailOffset.x = fract(
        this._shapeDetailOffset.x + w.shapeDetailVelocity.x * dt,
      );
      this._shapeDetailOffset.y = fract(
        this._shapeDetailOffset.y + w.shapeDetailVelocity.y * dt,
      );
      this._shapeDetailOffset.z = fract(
        this._shapeDetailOffset.z + w.shapeDetailVelocity.z * dt,
      );
    }

    Cesium.Matrix4.clone(camera.viewMatrix, s.viewMatrix);
    Cesium.Matrix4.clone(camera.inverseViewMatrix, s.inverseViewMatrix);

    const projection = camera.frustum.projectionMatrix;
    const prevProj = this._prevProjection ?? projection;
    const prevView = this._prevView ?? camera.viewMatrix;

    if (this.temporalUpscale) {
      // march 在 1/4 线性分辨率；resolution=lowRes*4，Bayer 子像素抖动
      const lowW = Math.ceil(targetWidth / 4);
      const lowH = Math.ceil(targetHeight / 4);
      const resX = lowW * 4;
      const resY = lowH * 4;
      const off = bayerOffsets[s.frame % 16];
      const dx = ((off.x - 0.5) / resX) * 4;
      const dy = ((off.y - 0.5) / resY) * 4;
      s.temporalJitter.x = dx;
      s.temporalJitter.y = dy;
      s.mipLevelScale = 0.25;
      s.targetUvScale.x = resX / targetWidth;
      s.targetUvScale.y = resY / targetHeight;
      s.resolution.x = resX;
      s.resolution.y = resY;

      // 抖动投影矩阵（[8]/[9] 列主序对应 three elements[8]/[9]）后求逆
      Cesium.Matrix4.clone(projection, s.inverseProjectionMatrix);
      s.inverseProjectionMatrix[8] += dx * 2;
      s.inverseProjectionMatrix[9] += dy * 2;
      Cesium.Matrix4.inverse(
        s.inverseProjectionMatrix,
        s.inverseProjectionMatrix,
      );
      // reproject = jittered(prevProj) * prevView
      Cesium.Matrix4.clone(prevProj, s.reprojectionMatrix);
      s.reprojectionMatrix[8] += dx * 2;
      s.reprojectionMatrix[9] += dy * 2;
      Cesium.Matrix4.multiply(
        s.reprojectionMatrix,
        prevView,
        s.reprojectionMatrix,
      );
    } else {
      s.temporalJitter.x = 0;
      s.temporalJitter.y = 0;
      s.mipLevelScale = 1;
      s.targetUvScale.x = 1;
      s.targetUvScale.y = 1;
      s.resolution.x = targetWidth;
      s.resolution.y = targetHeight;
      Cesium.Matrix4.inverse(projection, s.inverseProjectionMatrix);
      Cesium.Matrix4.multiply(prevProj, prevView, s.reprojectionMatrix);
    }
    Cesium.Matrix4.multiply(
      s.reprojectionMatrix,
      s.inverseViewMatrix,
      s.viewReprojectionMatrix,
    );

    s.cameraNear = camera.frustum.near;
    s.cameraFar = camera.frustum.far;

    const camPos = Cesium.Cartesian3.clone(
      camera.positionWC,
      s.cameraPositionECEF,
    );
    const carto = Cesium.Cartographic.fromCartesian(camPos);
    s.cameraHeight = carto ? carto.height : 0;

    Cesium.Cartesian3.clone(camera.directionWC, s.cameraDirection);

    computeAltitudeCorrection(camPos, s.altitudeCorrection);

    Cesium.Cartesian3.clone(
      scene.context.uniformState.sunDirectionWC,
      s.sunDirection,
    );

    // 运动信号拆分（用于 TAA 稳定策略）：
    //  - dolly 分量（平移在视线方向的投影/高度）：缩放焦点处像素速度≈0 但体采样
    //    内容真实变化，需要放宽 variance clipping + 冻结 march 抖动，否则云"重新加载"。
    //  - 旋转/切向运动：重投影是精确的，clip 必须保持严格（gamma=1），否则云边缘
    //    的过期历史在快速扫过的画面里存活 → 拖尾残影（云底仰视尤其明显）。
    //    注意 Cesium 左键拖动旋转是绕拾取点的轨道运动（大切向平移），故不能用
    //    总平移量驱动 relax——只用 dolly 分量。
    //  - 太阳运动（拖时间轴改变 sunDirection）：光照逐帧真实变化，但不产生像素
    //    速度，相机运动信号全为 0 → TAA 停在最慢档追不上，云底闪烁。用帧间太阳
    //    夹角驱动 march 抖动冻结（连同 ShadowPass 复用的 STBN 一起冻结），使拖动
    //    期间当前帧确定性、不再逐帧抖。带 0.8 衰减保持：拖动事件间隔大于帧间隔，
    //    无衰减会在冻结/解冻间逐帧振荡。
    //  - march 抖动冻结对三种运动都需要（保证运动中当前帧确定性、快速收敛）。
    if (this._prevCamPos && this._prevViewDir && this._prevSunDir) {
      const dx = camPos.x - this._prevCamPos.x;
      const dy = camPos.y - this._prevCamPos.y;
      const dz = camPos.z - this._prevCamPos.z;
      const dir = camera.directionWC;
      const dollyDist = Math.abs(dx * dir.x + dy * dir.y + dz * dir.z);
      const translation = Math.sqrt(dx * dx + dy * dy + dz * dz);
      const dollyRatio = dollyDist / Math.max(s.cameraHeight, 100);
      const transRatio = translation / Math.max(s.cameraHeight, 100);
      // 帧间视线夹角（rad）≈ 旋转速度
      const rotAngle = Math.acos(
        Math.min(
          1,
          Math.max(
            -1,
            dir.x * this._prevViewDir.x +
              dir.y * this._prevViewDir.y +
              dir.z * this._prevViewDir.z,
          ),
        ),
      );
      // 帧间太阳夹角（rad）：>0.057°/帧 触发；真实时间流速 (1x) 约 1e-6 rad/帧 不触发
      const sunAngle = Math.acos(
        Math.min(
          1,
          Math.max(
            -1,
            s.sunDirection.x * this._prevSunDir.x +
              s.sunDirection.y * this._prevSunDir.y +
              s.sunDirection.z * this._prevSunDir.z,
          ),
        ),
      );
      const sunRaw = Math.min(sunAngle / 0.001, 1);
      s.sunMotion = Math.max(sunRaw, s.sunMotion * 0.8);
      s.historyClipRelax = Math.min(dollyRatio * 80, 4);
      s.marchJitterFreeze = Math.min(
        transRatio * 40 + rotAngle / 0.01 + s.sunMotion,
        1,
      );
    } else {
      s.historyClipRelax = 0;
      s.marchJitterFreeze = 0;
      s.sunMotion = 0;
    }
    this._prevCamPos = Cesium.Cartesian3.clone(
      camPos,
      this._prevCamPos ?? new Cesium.Cartesian3(),
    );
    this._prevViewDir = Cesium.Cartesian3.clone(
      camera.directionWC,
      this._prevViewDir ?? new Cesium.Cartesian3(),
    );
    this._prevSunDir = Cesium.Cartesian3.clone(
      s.sunDirection,
      this._prevSunDir ?? new Cesium.Cartesian3(),
    );

    // 相机完全朝上（视锥内无地球瓦片）时 Cesium 不执行 executeCopyDepth，
    // czm_globeDepthTexture 残留上一帧地面深度（stale）→ 天空被误判为地面遮挡。
    // 检测本帧是否真的渲染了瓦片，没有则让 shader 跳过深度。
    const surface = scene.globe && scene.globe.show && scene.globe._surface;
    s.depthIsValid =
      surface && surface._tilesToRender && surface._tilesToRender.length > 0
        ? 1
        : 0;
  }

  /** resolve/swap 后调用：快照本帧矩阵供下一帧 reproject */
  copyReprojection(scene) {
    const camera = scene.camera;
    this._prevProjection = Cesium.Matrix4.clone(
      camera.frustum.projectionMatrix,
      this._prevProjection ?? new Cesium.Matrix4(),
    );
    this._prevView = Cesium.Matrix4.clone(
      camera.viewMatrix,
      this._prevView ?? new Cesium.Matrix4(),
    );
  }

  resetReprojection() {
    this._prevProjection = null;
    this._prevView = null;
  }

  /** 构建 march shader 的 uniformMap */
  buildUniformMap() {
    const s = this._state;
    const p = this.params;
    const V2 = (x, y) => new Cesium.Cartesian2(x, y);
    const V3 = (x, y, z) => new Cesium.Cartesian3(x, y, z);

    const map = {
      // 纹理
      shapeTexture: () => this._noise.shape,
      shapeDetailTexture: () => this._noise.detail,
      localWeatherTexture: () => this._weather.localWeather,
      turbulenceTexture: () => this._weather.turbulence,
      stbnTexture: () => this._stbn.texture,
      shadowBuffer: () => this.shadow?.texture ?? this._fakeShadow,
      depthBuffer: () =>
        this._context.uniformState.globeDepthTexture ?? this._dummyDepth,

      // 参数
      scatteringCoefficient: () => p.scatteringCoefficient,
      absorptionCoefficient: () => p.absorptionCoefficient,
      coverage: () => p.coverage,
      localWeatherRepeat: () => V2(p.localWeatherRepeat, p.localWeatherRepeat),
      localWeatherOffset: () => this._localWeatherOffset,
      shapeRepeat: () => V3(p.shapeRepeat, p.shapeRepeat, p.shapeRepeat),
      shapeOffset: () => this._shapeOffset,
      shapeDetailRepeat: () =>
        V3(p.shapeDetailRepeat, p.shapeDetailRepeat, p.shapeDetailRepeat),
      shapeDetailOffset: () => this._shapeDetailOffset,
      turbulenceRepeat: () => V2(p.turbulenceRepeat, p.turbulenceRepeat),
      turbulenceDisplacement: () => p.turbulenceDisplacement,

      // 大气（云侧）
      bottomRadius: () => BOTTOM_RADIUS,
      topRadius: () => TOP_RADIUS,
      worldToECEFMatrix: () => Cesium.Matrix4.IDENTITY,
      ecefToWorldMatrix: () => Cesium.Matrix4.IDENTITY,
      altitudeCorrection: () => s.altitudeCorrection,
      sunDirection: () => s.sunDirection,

      // 相机/矩阵
      cameraPosition: () => s.cameraPositionECEF,
      viewMatrix: () => s.viewMatrix,
      inverseViewMatrix: () => s.inverseViewMatrix,
      inverseProjectionMatrix: () => s.inverseProjectionMatrix,
      reprojectionMatrix: () => s.reprojectionMatrix,
      viewReprojectionMatrix: () => s.viewReprojectionMatrix,
      resolution: () => s.resolution,
      cameraNear: () => s.cameraNear,
      cameraFar: () => s.cameraFar,
      cameraHeight: () => s.cameraHeight,
      frame: () => s.frame,
      temporalJitter: () => s.temporalJitter,
      targetUvScale: () => s.targetUvScale,
      mipLevelScale: () => s.mipLevelScale,
      depthIsValid: () => (this.disableSceneClamp ? 0 : s.depthIsValid),
      marchJitterFreeze: () => s.marchJitterFreeze,

      // 散射
      skyLightScale: () => this.scattering.skyLightScale,
      groundBounceScale: () => this.scattering.groundBounceScale,
      powderScale: () => this.scattering.powderScale,
      powderExponent: () => this.scattering.powderExponent,

      // Beer shadow map（Phase 5 由 ShadowPass 注入；未就绪时回退假值）
      shadowTexelSize: () => this.shadow?.texelSize ?? V2(1 / 512, 1 / 512),
      shadowIntervals: () => this.shadow?.intervals ?? [V2(0, 1), V2(0, 1), V2(0, 1)],
      shadowMatrices: () => this.shadow?.matrices ?? [Cesium.Matrix4.IDENTITY, Cesium.Matrix4.IDENTITY, Cesium.Matrix4.IDENTITY],
      shadowFar: () => this.shadow?.far ?? 1e5,
      maxShadowFilterRadius: () => 6,
    };

    // 一级 march 参数
    for (const key of Object.keys(this.march)) {
      map[key] = () => this.march[key];
    }
    // haze
    for (const key of Object.keys(this.haze)) {
      map[key] = () => this.haze[key];
    }

    // 云层（每帧取最新打包值）
    const layerKeys = [
      "minLayerHeights",
      "maxLayerHeights",
      "minIntervalHeights",
      "maxIntervalHeights",
      "densityScales",
      "shapeAmounts",
      "shapeDetailAmounts",
      "weatherExponents",
      "shapeAlteringBiases",
      "coverageFilterWidths",
      "minHeight",
      "maxHeight",
      "shadowTopHeight",
      "shadowBottomHeight",
      "shadowLayerMask",
    ];
    for (const key of layerKeys) {
      map[key] = () => this._updateLayers()[key];
    }
    map.densityProfileExpTerms = () =>
      this._updateLayers().densityProfile.expTerms;
    map.densityProfileExponents = () =>
      this._updateLayers().densityProfile.exponents;
    map.densityProfileLinearTerms = () =>
      this._updateLayers().densityProfile.linearTerms;
    map.densityProfileConstantTerms = () =>
      this._updateLayers().densityProfile.constantTerms;

    // 大气 LUT 采样器
    Object.assign(map, atmosphereUniforms(this._atmo));

    return map;
  }

  destroy() {
    if (this._fakeShadow && !this._fakeShadow.isDestroyed())
      this._fakeShadow.destroy();
    if (this._dummyDepth && !this._dummyDepth.isDestroyed())
      this._dummyDepth.destroy();
  }
}
