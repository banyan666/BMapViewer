import * as Cesium from "cesium";
import { VolumeTexture } from "../gl/VolumeTexture.js";

// 时空蓝噪声（Spatiotemporal Blue Noise）：128×128×64 单通道 R8。
// 来源：three-geospatial 随包资源，地址由内部资源管理器提供。
// 采样 NEAREST + REPEAT，shader 里按 frame%64 取层。
const WIDTH = 128;
const HEIGHT = 128;
const DEPTH = 64;


export class StbnTexture {
  constructor(textureUrl) {
    this.textureUrl = textureUrl;
    this.texture = null;
  }

  async load(context, signal) {
    const res = await fetch(this.textureUrl, { signal });
    if (!res.ok) {
      throw new Error(`[CloudUltraEffect] STBN 加载失败: ${res.status}`);
    }
    const buffer = await res.arrayBuffer();
    const data = new Uint8Array(buffer);
    const expected = WIDTH * HEIGHT * DEPTH;
    signal?.throwIfAborted();
    if (data.length !== expected) {
      throw new Error(
        `[V5] STBN 尺寸不符: ${data.length} < ${expected}（可能是 LFS 指针）`,
      );
    }
    this.texture = new VolumeTexture({
      context,
      source: {
        arrayBufferView: data.subarray(0, expected),
        width: WIDTH,
        height: HEIGHT,
        depth: DEPTH,
      },
      pixelFormat: Cesium.PixelFormat.RED,
      pixelDatatype: Cesium.PixelDatatype.UNSIGNED_BYTE,
      flipY: false,
      sampler: new Cesium.Sampler({
        minificationFilter: Cesium.TextureMinificationFilter.NEAREST,
        magnificationFilter: Cesium.TextureMagnificationFilter.NEAREST,
        wrapS: Cesium.TextureWrap.REPEAT,
        wrapT: Cesium.TextureWrap.REPEAT,
        wrapR: Cesium.TextureWrap.REPEAT,
      }),
    });
    return this;
  }

  destroy() {
    if (this.texture && !this.texture.isDestroyed()) this.texture.destroy();
    this.texture = null;
  }
}
