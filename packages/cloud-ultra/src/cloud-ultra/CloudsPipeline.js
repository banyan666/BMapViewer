import * as Cesium from "cesium";
import { NoiseTextures } from "./noise/NoiseTextures.js";
import { AtmosphereTextures } from "./atmosphere/AtmosphereTextures.js";
import { WeatherTextures } from "./textures/WeatherTextures.js";
import { StbnTexture } from "./textures/StbnTexture.js";
import { CloudUniforms } from "./uniforms.js";
import { CloudsPass } from "./clouds/CloudsPass.js";
import { ResolvePass } from "./clouds/ResolvePass.js";
import { CompositePass } from "./clouds/CompositePass.js";
import { ShadowPass } from "./clouds/ShadowPass.js";
import { defaultCloudLayers } from "./CloudLayers.js";

/**
 * 体积云管线编排器（Phase 3）：
 *   一次性：噪声烘焙（Worker）+ 大气 LUT 加载 + STBN 加载 + 天气纹理烘焙（首帧）
 *   每帧（postRender）：march → composite → 快照重投影矩阵
 *
 * 所有 pass 在 scene.postRender 里手动 execute（拿本帧 globe 深度、合成同帧生效）。
 */
export class CloudsPipeline {
  constructor(scene, options = {}) {
    this._options = options;
    this._controller = new AbortController();
    this._enabled = options.enabled !== false;
    this._settleReady = null;
    this._scene = scene;
    this._context = scene.context;
    this._noise = null;
    this._atmo = null;
    this._weather = null;
    this._stbn = null;
    this._uniforms = null;
    this._shadowPass = null;
    this._cloudsPass = null;
    this._resolvePass = null;
    this._compositePass = null;
    this._cascadeCount = 3;
    this._layers = defaultCloudLayers();
    this._postRenderRemove = null;
    this._skyState = null;
    this._ready = false;
    this._debugDefine = null; // 当前 debug 视图 define（null=正常）
    this.exposure = 10;
    this.enableGlobeLighting = true; // 地表随太阳明暗（globe.enableLighting）
    this.enableAerialPerspective = true; // 地表空气透视（需画布捕获成功）
    this.aerialPerspectiveScale = 1;
    this.enableCloudShadow = true; // 云投影落地（需画布捕获成功 + 云间阴影已开）
    this.cloudShadowStrength = 1;
    this._sceneColorTexture = null;
    this._sceneColorCaptureFailed = false;
    // 性能优化开关：开启时云阴影贴图降分辨率（512→256），渲染量降 4 倍。
    // BSM 经 PCF 后为柔和低频阴影，降分辨率在最终画面上肉眼几乎不可辨。
    this.perfOptimize = false;
    this._shadowMapSize = 512;
  }

  get uniforms() {
    return this._uniforms;
  }

  get layers() {
    return this._layers;
  }

  get resolvePass() {
    return this._resolvePass;
  }

  async start(onProgress) {
    const context = this._context;

    const signal = this._controller.signal;
    this._noise = new NoiseTextures(this._options.resources.worker);
    this._atmo = new AtmosphereTextures(this._options.resources);
    this._stbn = new StbnTexture(this._options.resources.stbn);
    this._weather = new WeatherTextures();

    await this._noise.bake(context, (value) => onProgress?.(value * 0.7), signal);
    signal.throwIfAborted();
    await this._atmo.load(context, signal);
    signal.throwIfAborted();
    onProgress?.(85);
    await this._stbn.load(context, signal);
    signal.throwIfAborted();
    onProgress?.(90);

    this._uniforms = new CloudUniforms(context, {
      noise: this._noise,
      weather: this._weather,
      stbn: this._stbn,
      atmo: this._atmo,
    });
    this._uniforms.layers = this._layers;

    const logDepth = this._scene.logarithmicDepthBuffer;
    this._cascadeCount = 3;
    this._shadowPass = new ShadowPass(context, this._uniforms, {
      cascadeCount: this._cascadeCount,
      mapSize: this._shadowMapSize,
    });
    this._cloudsPass = new CloudsPass(context, this._uniforms, {
      logDepth,
      cascadeCount: this._cascadeCount,
    });
    this._resolvePass = new ResolvePass(context, this._uniforms);
    this._compositePass = new CompositePass(
      context,
      this._uniforms,
      this._atmo,
      { exposure: this.exposure, logDepth },
    );

    if (this._enabled) this._disableCesiumSky();

    this._postRenderRemove = this._scene.postRender.addEventListener(() =>
      this._onPostRender(),
    );
    this._ready = true;
    this._options.configure?.(this);
    onProgress?.(95);
    this._scene.requestRender?.();
    if (!this._enabled) { onProgress?.(100); return this; }
    return new Promise((resolve, reject) => {
      this._settleReady = (error) => {
        this._settleReady = null;
        if (error) reject(error);
        else { onProgress?.(100); resolve(this); }
      };
    });
  }

  setEnabled(enabled) {
    if (this._enabled === enabled) return;
    this._enabled = enabled;
    if (this._ready) {
      if (enabled) { this._disableCesiumSky(); this._uniforms.resetReprojection(); this._uniforms._lastWindNowMs = undefined; }
      else this._restoreCesiumSky();
    }
    this._scene.requestRender?.();
  }

  get enabled() { return this._enabled; }
  set enabled(value) { this.setEnabled(Boolean(value)); }

  /**
   * 捕获本帧 Cesium 已渲染好的画布颜色（云合成前的地表终色），供 CompositePass
   * 地面分支做地表空气透视。postRender 触发时默认帧缓冲即当前绑定（Context.endFrame
   * 已 bind null），此刻拷贝拿到的正是"云合成前"的画面。捕获失败（如设备不支持）
   * 时静默禁用地表空气透视，不影响其余渲染。
   */
  _captureSceneColor() {
    if (this._sceneColorCaptureFailed) return;
    const context = this._context;
    const width = context.drawingBufferWidth;
    const height = context.drawingBufferHeight;
    if (
      !this._sceneColorTexture ||
      this._sceneColorTexture.width !== width ||
      this._sceneColorTexture.height !== height
    ) {
      this._sceneColorTexture?.destroy();
      this._sceneColorTexture = new Cesium.Texture({
        context,
        width,
        height,
        // 画布以 alpha:false 创建（RGB，无 alpha 通道），copyFromFramebuffer 要求
        // 目标纹理格式与源帧缓冲一致，否则 glCopyTexSubImage2D 报
        // GL_INVALID_OPERATION 且纹理内容保持未初始化的显存垃圾数据。
        pixelFormat: context._gl.getContextAttributes().alpha ? Cesium.PixelFormat.RGBA : Cesium.PixelFormat.RGB,
        pixelDatatype: Cesium.PixelDatatype.UNSIGNED_BYTE,
      });
    }
    try {
      this._sceneColorTexture.copyFromFramebuffer(0, 0, 0, 0, width, height);
    } catch (e) {
      console.warn(
        "[CloudUltraEffect] 画布颜色捕获失败，地表空气透视已禁用:",
        e && e.message,
      );
      this._sceneColorCaptureFailed = true;
      this._sceneColorTexture?.destroy();
      this._sceneColorTexture = null;
    }
  }

  _onPostRender() {
    if (!this._ready || !this._enabled) return;
    try {
      this._captureSceneColor();

      // 天气纹理首帧烘焙（幂等）
      this._weather.bake(this._context);

      // 更新相机/太阳等状态（供 CSM 用），再渲染级联阴影
      this._uniforms.update(
        this._scene,
        this._context.drawingBufferWidth,
        this._context.drawingBufferHeight,
      );
      if (this.enableShadow !== false) {
        this._shadowPass.execute(this._scene);
        this._uniforms.shadow = {
          texture: this._shadowPass.shadowTexture,
          matrices: this._shadowPass.cascades.map((c) => c.matrix),
          intervals: this._shadowPass.cascades.map((c) => c.interval),
          far: this._shadowPass.far,
          texelSize: this._shadowPass.texelSize,
        };
      } else {
        this._uniforms.shadow = null;
      }

      const { width, height } = this._cloudsPass.execute(this._scene);

      // debug 视图绕过 resolve（避免时间累积把调试图案糊掉）
      let cloudColor;
      if (this._debugDefine) {
        cloudColor = this._cloudsPass.colorTexture;
      } else {
        cloudColor = this._resolvePass.execute(this._cloudsPass, width, height);
      }

      this._compositePass.exposure = this.exposure;
      this._compositePass.enableAerialPerspective =
        this.enableAerialPerspective;
      this._compositePass.aerialPerspectiveScale = this.aerialPerspectiveScale;
      this._compositePass.enableCloudShadow = this.enableCloudShadow;
      this._compositePass.cloudShadowStrength = this.cloudShadowStrength;
      this._compositePass.setCloudColorTexture(cloudColor);
      this._compositePass.setSceneColorTexture(this._sceneColorTexture);
      this._compositePass.execute();

      this._uniforms.copyReprojection(this._scene);
      this._settleReady?.();
      this._scene.requestRender?.();
    } catch (e) {
      this._settleReady?.(e);
      this.stop();
      this._options.onError?.(e);
    }
  }

  /** 切换时间升采样（1/16 面积 march + Bayer）：重建 march/resolve pass */
  setTemporalUpscale(enabled) {
    if (this._uniforms.temporalUpscale === enabled) return;
    this._uniforms.temporalUpscale = enabled;
    this._uniforms.resetReprojection();
    const logDepth = this._scene.logarithmicDepthBuffer;
    const defines = {};
    if (this._debugDefine) defines[this._debugDefine] = true;
    const oldC = this._cloudsPass;
    const oldR = this._resolvePass;
    this._cloudsPass = new CloudsPass(this._context, this._uniforms, {
      logDepth,
      cascadeCount: this._cascadeCount,
      temporalUpscale: enabled,
      defines,
    });
    this._resolvePass = new ResolvePass(this._context, this._uniforms, {
      temporalUpscale: enabled,
    });
    oldC.destroy();
    oldR.destroy();
  }

  /**
   * 切换性能优化：降低云阴影贴图分辨率（512→256），重建 ShadowPass。
   * BSM 经 PCF 后为柔和低频阴影，降分辨率对最终画面几乎无可感知影响，
   * 但每帧阴影 march 的 texel 数减少到 1/4，是当前最大的性能瓶颈来源。
   */
  setPerfOptimize(enabled) {
    if (this.perfOptimize === enabled) return;
    this.perfOptimize = enabled;
    this._shadowMapSize = enabled ? 256 : 512;
    const old = this._shadowPass;
    this._shadowPass = new ShadowPass(this._context, this._uniforms, {
      cascadeCount: this._cascadeCount,
      mapSize: this._shadowMapSize,
    });
    // uniforms.shadow 会在下一帧 postRender 的 shadowPass.execute 后重设为新贴图
    old.destroy();
    this._scene.requestRender?.();
  }

  /** 切换 debug 视图（null=正常）：重建 march pass 加对应 define */
  setDebugView(define) {
    if (this._debugDefine === define) return;
    this._debugDefine = define;
    const logDepth = this._scene.logarithmicDepthBuffer;
    const defines = {};
    if (define) defines[define] = true;
    const old = this._cloudsPass;
    this._cloudsPass = new CloudsPass(this._context, this._uniforms, {
      logDepth,
      cascadeCount: this._cascadeCount,
      temporalUpscale: this._uniforms.temporalUpscale,
      defines,
    });
    old.destroy();
  }

  /** 运行期切换地表太阳光照（globe.enableLighting），不需要重建任何 pass */
  setGlobeLighting(enabled) {
    this.enableGlobeLighting = enabled;
    const globe = this._scene.globe;
    if (globe) globe.enableLighting = enabled;
    this._scene.requestRender?.();
  }

  _disableCesiumSky() {
    const scene = this._scene;
    const globe = scene.globe;
    this._skyState = {
      skyAtmosphere: scene.skyAtmosphere ? scene.skyAtmosphere.show : null,
      sun: scene.sun ? scene.sun.show : null,
      skyBox: scene.skyBox ? scene.skyBox.show : null,
      globeEnableLighting: globe ? globe.enableLighting : null,
      globeDynamicAtmosphereLighting: globe
        ? globe.dynamicAtmosphereLighting
        : null,
      globeShowGroundAtmosphere: globe ? globe.showGroundAtmosphere : null,
    };
    if (scene.skyAtmosphere) scene.skyAtmosphere.show = false;
    if (scene.sun) scene.sun.show = false;
    if (scene.skyBox) scene.skyBox.show = false;
    if (globe) {
      globe.enableLighting = this.enableGlobeLighting;
      globe.dynamicAtmosphereLighting = false;
      // Cesium 自带地面大气与 Phase 3 的空气透视会重复叠加，关闭防止双重大气。
      globe.showGroundAtmosphere = false;
    }
  }

  _restoreCesiumSky() {
    const scene = this._scene;
    if (!this._skyState) return;
    const globe = scene.globe;
    if (scene.skyAtmosphere && this._skyState.skyAtmosphere != null)
      scene.skyAtmosphere.show = this._skyState.skyAtmosphere;
    if (scene.sun && this._skyState.sun != null)
      scene.sun.show = this._skyState.sun;
    if (scene.skyBox && this._skyState.skyBox != null)
      scene.skyBox.show = this._skyState.skyBox;
    if (globe) {
      if (this._skyState.globeEnableLighting != null)
        globe.enableLighting = this._skyState.globeEnableLighting;
      if (this._skyState.globeDynamicAtmosphereLighting != null)
        globe.dynamicAtmosphereLighting =
          this._skyState.globeDynamicAtmosphereLighting;
      if (this._skyState.globeShowGroundAtmosphere != null)
        globe.showGroundAtmosphere = this._skyState.globeShowGroundAtmosphere;
    }
    this._skyState = null;
  }

  stop() {
    this._ready = false;
    this._settleReady?.(Object.assign(new Error("CloudUltraEffect cancelled"), { name: "AbortError" }));
    this._controller.abort();
    if (this._postRenderRemove) {
      this._postRenderRemove();
      this._postRenderRemove = null;
    }
    this._restoreCesiumSky();
    this._shadowPass?.destroy();
    this._cloudsPass?.destroy();
    this._resolvePass?.destroy();
    this._compositePass?.destroy();
    this._uniforms?.destroy();
    this._weather?.destroy();
    this._stbn?.destroy();
    this._atmo?.destroy();
    this._noise?.destroy();
    this._sceneColorTexture?.destroy();
    this._sceneColorTexture = null;
    this._sceneColorCaptureFailed = false;
    this._shadowPass = null;
    this._cloudsPass = null;
    this._resolvePass = null;
    this._compositePass = null;
    this._uniforms = null;
    this._weather = null;
    this._stbn = null;
    this._atmo = null;
    this._noise = null;
    if (!this._scene.isDestroyed?.()) this._scene.requestRender?.();
  }
}
