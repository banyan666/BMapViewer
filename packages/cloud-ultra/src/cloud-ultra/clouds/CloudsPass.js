import * as Cesium from "cesium";
import { ScreenSpacePass } from "../gl/ScreenSpacePass.js";
import { MRTTarget } from "../gl/RenderTargets.js";
import { buildCloudsShaders } from "./cloudsShaderSource.js";

/**
 * 主 march pass：全分辨率 MRT（color + depthVelocity），朝太阳 secondary march 自阴影。
 * Phase 3 无 BSM、无 resolve、无 temporal upscale。
 */
export class CloudsPass {
  constructor(
    context,
    cloudUniforms,
    {
      logDepth = true,
      cascadeCount = 3,
      temporalUpscale = false,
      defines = {},
    } = {},
  ) {
    this._context = context;
    this._uniforms = cloudUniforms;
    this._temporalUpscale = temporalUpscale;

    const shaderDefines = { SHADOW_CASCADE_COUNT: cascadeCount, ...defines };
    if (logDepth) shaderDefines.LOG_DEPTH = true;
    if (temporalUpscale) shaderDefines.TEMPORAL_UPSCALE = true;
    const { vertexShaderSource, fragmentShaderSource } =
      buildCloudsShaders(shaderDefines);

    this._pass = new ScreenSpacePass(context, {
      vertexShaderSource,
      fragmentShaderSource,
      uniformMap: cloudUniforms.buildUniformMap(),
    });

    // MRT：location 0 = color(RGBA16F)，location 1 = depthVelocity(RGBA16F)
    this._target = new MRTTarget(context, [
      { name: "color", pixelDatatype: Cesium.PixelDatatype.HALF_FLOAT },
      { name: "depthVelocity", pixelDatatype: Cesium.PixelDatatype.HALF_FLOAT },
    ]);
  }

  get colorTexture() {
    return this._target.texture("color");
  }

  get depthVelocityTexture() {
    return this._target.texture("depthVelocity");
  }

  /**
   * march。返回全分辨率 { width, height }（供 resolve/composite）。
   * 升采样模式下 march 目标缩到 1/4 线性（1/16 面积）。相机状态由 pipeline 预先 update。
   */
  execute(scene) {
    const fullW = this._context.drawingBufferWidth;
    const fullH = this._context.drawingBufferHeight;
    const mw = this._temporalUpscale ? Math.ceil(fullW / 4) : fullW;
    const mh = this._temporalUpscale ? Math.ceil(fullH / 4) : fullH;
    this._target.resize(mw, mh);
    this._pass.execute(this._target.framebuffer, {
      width: mw,
      height: mh,
      clear: true,
    });
    return { width: fullW, height: fullH };
  }

  destroy() {
    this._pass.destroy();
    this._target.destroy();
  }
}
