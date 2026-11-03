/**
 * 分层 MRT framebuffer：把一张 Cesium.Texture3D 的各层用 framebufferTextureLayer
 * 绑成多个颜色附件，一次 draw 写完所有层（级联阴影用）。
 *
 * duck-type 出 Cesium DrawCommand/Context 需要的接口：
 *   _bind() / _getActiveColorAttachments() / hasDepthAttachment / isDestroyed()
 * 使其可直接作为 command.framebuffer。
 *
 * spike 已验证 framebufferTextureLayer(TEXTURE_3D) 对 RGBA8/RGBA16F 均 FRAMEBUFFER_COMPLETE。
 */
export class LayeredFramebuffer {
  constructor(context, texture3D, layerCount) {
    this._gl = context._gl;
    this._texture = texture3D;
    this._layerCount = layerCount;
    this.hasDepthAttachment = false;
    this._fbo = this._gl.createFramebuffer();
    this._attach();
  }

  _attach() {
    const gl = this._gl;
    const glTex = this._texture._texture; // 内部 WebGLTexture
    gl.bindFramebuffer(gl.FRAMEBUFFER, this._fbo);
    for (let i = 0; i < this._layerCount; ++i) {
      gl.framebufferTextureLayer(
        gl.FRAMEBUFFER,
        gl.COLOR_ATTACHMENT0 + i,
        glTex,
        0,
        i,
      );
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  _bind() {
    this._gl.bindFramebuffer(this._gl.FRAMEBUFFER, this._fbo);
  }

  _getActiveColorAttachments() {
    const gl = this._gl;
    const out = [];
    for (let i = 0; i < this._layerCount; ++i) {
      out.push(gl.COLOR_ATTACHMENT0 + i);
    }
    return out;
  }

  isDestroyed() {
    return this._fbo == null;
  }

  destroy() {
    if (this._fbo) {
      this._gl.deleteFramebuffer(this._fbo);
      this._fbo = null;
    }
  }
}
