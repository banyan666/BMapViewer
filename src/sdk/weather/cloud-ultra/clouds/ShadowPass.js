import * as Cesium from "cesium";
import { VolumeTexture } from "../gl/VolumeTexture.js";
import { ScreenSpacePass } from "../gl/ScreenSpacePass.js";
import { LayeredFramebuffer } from "../gl/LayeredFramebuffer.js";
import { CascadedShadowMaps } from "../CascadedShadowMaps.js";
import { buildShadowShader } from "./shadowShaderSource.js";

/**
 * 级联 Beer Shadow Map pass（Phase 5，非 temporal）：
 *   每帧 CSM.update → 一次 draw 把所有级联渲到 Texture3D 各层（LayeredFramebuffer）。
 *   输出每层 vec4(frontDepth, meanExtinction, maxOpticalDepth, tail)，供主 march 采样。
 */
export class ShadowPass {
  constructor(
    context,
    cloudUniforms,
    { cascadeCount = 3, mapSize = 512 } = {},
  ) {
    this._context = context;
    try {
      this._uniforms = cloudUniforms;
      this.cascadeCount = cascadeCount;
      this.mapSize = mapSize;

      this._csm = new CascadedShadowMaps({
        cascadeCount,
        mapSize,
        maxFar: 1e5,
        splitLambda: 0.6,
      });

      // 阴影贴图 Texture3D：mapSize² × cascadeCount，RGBA16F，LINEAR+CLAMP（供 PCF）
      const zero = new Uint16Array(mapSize * mapSize * cascadeCount * 4);
      this._texture = new VolumeTexture({
        context,
        source: {
          arrayBufferView: zero,
          width: mapSize,
          height: mapSize,
          depth: cascadeCount,
        },
        pixelFormat: Cesium.PixelFormat.RGBA,
        pixelDatatype: Cesium.PixelDatatype.HALF_FLOAT,
        flipY: false,
        sampler: new Cesium.Sampler({
          minificationFilter: Cesium.TextureMinificationFilter.LINEAR,
          magnificationFilter: Cesium.TextureMagnificationFilter.LINEAR,
          wrapS: Cesium.TextureWrap.CLAMP_TO_EDGE,
          wrapT: Cesium.TextureWrap.CLAMP_TO_EDGE,
          wrapR: Cesium.TextureWrap.CLAMP_TO_EDGE,
        }),
      });
      this._framebuffer = new LayeredFramebuffer(
        context,
        this._texture,
        cascadeCount,
      );

      // 阴影 march 参数（high 预设 shadow）
      this._shadowMarch = {
        maxIterationCount: 50,
        minStepSize: 100,
        maxStepSize: 1000,
        minDensity: 1e-5,
        minExtinction: 1e-5,
        minTransmittance: 1e-4,
        opticalDepthTailScale: 2,
      };

      const identity3 = [
        Cesium.Matrix4.IDENTITY,
        Cesium.Matrix4.IDENTITY,
        Cesium.Matrix4.IDENTITY,
        Cesium.Matrix4.IDENTITY,
      ].slice(0, cascadeCount);

      // 复用主 march 的共享 uniform（纹理/云层/参数/太阳/altitude），叠加阴影专属项
      const shared = cloudUniforms.buildUniformMap();
      const uniformMap = {
        ...shared,
        // 阴影 march 参数覆盖
        maxIterationCount: () => this._shadowMarch.maxIterationCount,
        minStepSize: () => this._shadowMarch.minStepSize,
        maxStepSize: () => this._shadowMarch.maxStepSize,
        minDensity: () => this._shadowMarch.minDensity,
        minExtinction: () => this._shadowMarch.minExtinction,
        minTransmittance: () => this._shadowMarch.minTransmittance,
        opticalDepthTailScale: () => this._shadowMarch.opticalDepthTailScale,
        resolution: () => new Cesium.Cartesian2(mapSize, mapSize),
        inverseShadowMatrices: () =>
          this._csm.cascades.map((c) => c.inverseMatrix),
        reprojectionMatrices: () => identity3,
      };

      const { vertexShaderSource, fragmentShaderSource } =
        buildShadowShader(cascadeCount);
      this._pass = new ScreenSpacePass(context, {
        vertexShaderSource,
        fragmentShaderSource,
        uniformMap,
      });

      this._scratchNormal = new Cesium.Cartesian3();
    } catch (error) {
      this.destroy();
      throw error;
    }
  }

  get shadowTexture() {
    return this._texture;
  }

  get cascades() {
    return this._csm.cascades;
  }

  get far() {
    return this._csm.far;
  }

  get texelSize() {
    return new Cesium.Cartesian2(1 / this.mapSize, 1 / this.mapSize);
  }

  execute(scene) {
    const camera = scene.camera;
    const sun = this._uniforms.state.sunDirection;

    // distance = lerp(1e6, 1e3, zenithAngle)
    const normal = Cesium.Cartesian3.normalize(
      this._uniforms.state.cameraPositionECEF,
      this._scratchNormal,
    );
    const zenith = Cesium.Cartesian3.dot(sun, normal);
    const distance = 1e6 + (1e3 - 1e6) * Math.max(0, Math.min(1, zenith));

    this._csm.update(camera, sun, distance);

    this._pass.execute(this._framebuffer, {
      width: this.mapSize,
      height: this.mapSize,
      clear: true,
    });
  }

  destroy() {
    this._pass?.destroy();
    this._framebuffer?.destroy();
    if (this._texture && !this._texture.isDestroyed()) this._texture.destroy();
  }
}
