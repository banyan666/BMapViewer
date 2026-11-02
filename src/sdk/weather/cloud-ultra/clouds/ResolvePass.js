import * as Cesium from "cesium";
import { ScreenSpacePass } from "../gl/ScreenSpacePass.js";
import { MRTTarget } from "../gl/RenderTargets.js";
import { buildResolveShader } from "./resolveShaderSource.js";

/**
 * TAA resolve pass（Phase 4，非升采样）：
 *   读 当前 march color/depthVelocity + 上一帧 resolve 历史 → 运动矢量重投影 +
 *   variance clipping + mix(temporalAlpha) → 写入 resolve 目标，ping-pong 轮转。
 * 输出全分辨率、时间累积后干净的 color，供 composite 使用。
 */
export class ResolvePass {
  constructor(
    context,
    cloudUniforms,
    { temporalAlpha = 0.05, varianceGamma = 2, temporalUpscale = false } = {},
  ) {
    this._context = context;
    this._uniforms = cloudUniforms;
    this.temporalAlpha = temporalAlpha;
    this.varianceGamma = varianceGamma;
    this._temporalUpscale = temporalUpscale;

    this._colorBuffer = null;
    this._depthVelocityBuffer = null;
    this._texelSize = new Cesium.Cartesian2(1, 1);
    // 升采样时 march buffer 为 1/4 线性分辨率，其 texel 尺寸供邻域精确取样
    this._lowResTexelSize = new Cesium.Cartesian2(1, 1);

    // ping-pong：两张全分辨率 HALF_FLOAT 目标
    this._targetA = new MRTTarget(context, [
      { name: "color", pixelDatatype: Cesium.PixelDatatype.HALF_FLOAT },
    ]);
    this._targetB = new MRTTarget(context, [
      { name: "color", pixelDatatype: Cesium.PixelDatatype.HALF_FLOAT },
    ]);
    this._current = this._targetA;
    this._history = this._targetB;

    const { vertexShaderSource, fragmentShaderSource } = buildResolveShader(
      temporalUpscale ? { TEMPORAL_UPSCALE: true } : {},
    );
    this._pass = new ScreenSpacePass(context, {
      vertexShaderSource,
      fragmentShaderSource,
      uniformMap: {
        colorBuffer: () => this._colorBuffer,
        depthVelocityBuffer: () => this._depthVelocityBuffer,
        colorHistoryBuffer: () => this._history.texture("color"),
        texelSize: () => this._texelSize,
        lowResTexelSize: () => this._lowResTexelSize,
        frame: () => this._uniforms.state.frame,
        varianceGamma: () => this.varianceGamma,
        temporalAlpha: () => this.temporalAlpha,
        historyClipRelax: () => this._uniforms.state.historyClipRelax,
      },
    });
  }

  /** 当前帧 resolve 输出（供 composite） */
  get outputTexture() {
    return this._current.texture("color");
  }

  execute(cloudsPass, width, height) {
    this._colorBuffer = cloudsPass.colorTexture;
    this._depthVelocityBuffer = cloudsPass.depthVelocityTexture;
    this._current.resize(width, height);
    this._history.resize(width, height);
    this._texelSize.x = 1 / width;
    this._texelSize.y = 1 / height;
    // march buffer 实际尺寸（升采样时为 ceil(full/4)，否则等于全分辨率）
    this._lowResTexelSize.x = 1 / this._colorBuffer.width;
    this._lowResTexelSize.y = 1 / this._colorBuffer.height;

    this._pass.execute(this._current.framebuffer, {
      width,
      height,
      clear: true,
    });

    const out = this._current.texture("color");
    // swap：本帧输出成为下一帧历史
    const tmp = this._current;
    this._current = this._history;
    this._history = tmp;
    return out;
  }

  destroy() {
    this._pass.destroy();
    this._targetA.destroy();
    this._targetB.destroy();
  }
}
