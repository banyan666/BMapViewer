import * as Cesium from "cesium";
import { VolumeShaderProgram } from './VolumeShaderProgram.js'

/**
 * 每帧全屏 pass：自定义 vert/frag + 视口 quad + DrawCommand，渲到指定 framebuffer
 * （或默认帧缓冲 = 画布）。用于主 march / resolve / composite。
 *
 * 参照 Cesium ComputeEngine 的全屏 quad 画法，但支持：
 *   - MRT（framebuffer 带多色附件）
 *   - 每次 execute 指定 framebuffer（ping-pong）
 *   - blending（composite 用 over 混合）
 *
 * Cesium 会自动加 #version 300 es、注入 czm_ 内建；我们的 layout(location=N) out 保留。
 * 在 scene.postRender 阶段调用 execute(context)。
 */
export class ScreenSpacePass {
  /**
   * @param {Cesium.Context} context
   * @param {object} options
   * @param {string} options.vertexShaderSource
   * @param {string} options.fragmentShaderSource
   * @param {object} options.uniformMap
   * @param {object} [options.attributeLocations]  默认 { position:0, textureCoordinates:1 }
   */
  constructor(
    context,
    {
      vertexShaderSource,
      fragmentShaderSource,
      uniformMap,
      attributeLocations,
    },
  ) {
    this._context = context;
    this._uniformMap = uniformMap;
    this._shaderProgram = new VolumeShaderProgram({
      context,
      vertexShaderSource,
      fragmentShaderSource,
      attributeLocations: attributeLocations ?? {
        position: 0,
        textureCoordinates: 1,
      },
    });
    this._vertexArray = context.getViewportQuadVertexArray();
    this._drawCommand = new Cesium.DrawCommand({
      primitiveType: Cesium.PrimitiveType.TRIANGLES,
      vertexArray: this._vertexArray,
      shaderProgram: this._shaderProgram,
      uniformMap,
      owner: this,
    });
    this._clearCommand = new Cesium.ClearCommand({
      color: new Cesium.Color(0.0, 0.0, 0.0, 0.0),
    });
    this._renderStateCache = new Map();
  }

  _renderState(width, height, blending) {
    const key = `${width}x${height}:${blending ? 1 : 0}`;
    let rs = this._renderStateCache.get(key);
    if (!rs) {
      rs = Cesium.RenderState.fromCache({
        viewport: new Cesium.BoundingRectangle(0, 0, width, height),
        depthTest: { enabled: false },
        depthMask: false,
        blending: blending
          ? Cesium.BlendingState.PRE_MULTIPLIED_ALPHA_BLEND
          : Cesium.BlendingState.DISABLED,
      });
      this._renderStateCache.set(key, rs);
    }
    return rs;
  }

  /**
   * @param {Cesium.Framebuffer|undefined} framebuffer  undefined = 默认帧缓冲（画布）
   * @param {object} opts
   * @param {number} opts.width
   * @param {number} opts.height
   * @param {boolean} [opts.clear=true]
   * @param {boolean} [opts.blending=false]
   */
  execute(framebuffer, { width, height, clear = true, blending = false }) {
    const context = this._context;
    const renderState = this._renderState(width, height, blending);

    if (clear) {
      this._clearCommand.framebuffer = framebuffer;
      this._clearCommand.renderState = renderState;
      this._clearCommand.execute(context);
    }

    this._drawCommand.framebuffer = framebuffer;
    this._drawCommand.renderState = renderState;
    this._drawCommand.uniformMap = this._uniformMap;
    this._drawCommand.execute(context);
  }

  destroy() {
    if (this._shaderProgram && !this._shaderProgram.isDestroyed()) {
      this._shaderProgram.destroy();
    }
    this._shaderProgram = null;
    this._renderStateCache.clear();
    // vertexArray 是 context 级缓存，不销毁
  }
}
