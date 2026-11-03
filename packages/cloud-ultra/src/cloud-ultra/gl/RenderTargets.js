import * as Cesium from "cesium";

/**
 * 创建一张浮点颜色渲染目标纹理（默认 RGBA16F、LINEAR、CLAMP）。
 */
export function createColorTexture(context, width, height, options = {}) {
  const {
    pixelFormat = Cesium.PixelFormat.RGBA,
    pixelDatatype = Cesium.PixelDatatype.HALF_FLOAT,
    minificationFilter = Cesium.TextureMinificationFilter.LINEAR,
    magnificationFilter = Cesium.TextureMagnificationFilter.LINEAR,
    wrap = Cesium.TextureWrap.CLAMP_TO_EDGE,
  } = options;
  return new Cesium.Texture({
    context,
    width: Math.max(1, width),
    height: Math.max(1, height),
    pixelFormat,
    pixelDatatype,
    sampler: new Cesium.Sampler({
      minificationFilter,
      magnificationFilter,
      wrapS: wrap,
      wrapT: wrap,
    }),
  });
}

/**
 * 多色附件（MRT）渲染目标：一组颜色纹理 + 一个 Framebuffer。
 * resize 时重建纹理与 framebuffer。无深度附件（云 pass 关深度测试）。
 *
 * attachments: [{ name, pixelDatatype? }]  —— 顺序即 layout(location=i)
 */
export class MRTTarget {
  constructor(context, attachments) {
    this._context = context;
    this._attachments = attachments;
    this._width = 0;
    this._height = 0;
    this._textures = [];
    this._framebuffer = null;
  }

  get framebuffer() {
    return this._framebuffer;
  }

  get width() {
    return this._width;
  }

  get height() {
    return this._height;
  }

  /** 按名取某个颜色附件纹理 */
  texture(name) {
    const i = this._attachments.findIndex((a) => a.name === name);
    return i >= 0 ? this._textures[i] : undefined;
  }

  textures() {
    return this._textures;
  }

  resize(width, height) {
    width = Math.max(1, Math.floor(width));
    height = Math.max(1, Math.floor(height));
    if (width === this._width && height === this._height && this._framebuffer) {
      return false;
    }
    this._destroyResources();
    this._width = width;
    this._height = height;
    try {
      for (const a of this._attachments) this._textures.push(
        createColorTexture(this._context, width, height, {
          pixelDatatype: a.pixelDatatype,
        }),
      );
      this._framebuffer = new Cesium.Framebuffer({
        context: this._context,
        colorTextures: this._textures,
        destroyAttachments: false,
      });
    } catch (error) {
      this._destroyResources();
      throw error;
    }
    return true;
  }

  _destroyResources() {
    if (this._framebuffer && !this._framebuffer.isDestroyed()) {
      this._framebuffer.destroy();
    }
    this._framebuffer = null;
    for (const t of this._textures) {
      if (t && !t.isDestroyed()) t.destroy();
    }
    this._textures = [];
  }

  destroy() {
    this._destroyResources();
  }
}
