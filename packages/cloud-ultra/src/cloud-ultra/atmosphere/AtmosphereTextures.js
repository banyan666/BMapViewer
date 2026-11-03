import * as Cesium from "cesium";
import { VolumeTexture } from "../gl/VolumeTexture.js";

/**
 * Bruneton 预计算大气 LUT —— 加载 three-geospatial 随包的 half-float 二进制
 * 地址由 CloudUltraEffect 内部资源管理器提供，上传成 Cesium 纹理供云光照采样。
 *
 *   transmittance        : 256×64    2D RGBA16F —— 到大气层顶的透过率
 *   scattering           : 256×128×32 3D RGBA16F —— 单次+多次散射（combined）
 *   irradiance           : 64×16     2D RGBA16F —— 地面辐照度
 *   higher_order_scattering: 256×128×32 3D RGBA16F —— 高阶散射
 *
 * 数据为 raw Float16(Uint16) RGBA，行主序；3D 按 depth 切片堆叠。
 */



// 与参考 constants.ts 对齐
export const ATMO_DIM = {
  transmittance: { width: 256, height: 64 },
  scattering: { width: 256, height: 128, depth: 32 },
  irradiance: { width: 64, height: 16 },
  higherOrderScattering: { width: 256, height: 128, depth: 32 },
};

async function fetchU16(url, path, expectTexels, signal) {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`加载 ${path} 失败: ${res.status}`);
  const buf = await res.arrayBuffer();
  const u16 = new Uint16Array(buf);
  if (u16.length !== expectTexels * 4) {
    throw new Error(`${path} 尺寸不符: ${u16.length} != ${expectTexels * 4}`);
  }
  return u16;
}

function linearSampler() {
  return new Cesium.Sampler({
    minificationFilter: Cesium.TextureMinificationFilter.LINEAR,
    magnificationFilter: Cesium.TextureMagnificationFilter.LINEAR,
    wrapS: Cesium.TextureWrap.CLAMP_TO_EDGE,
    wrapT: Cesium.TextureWrap.CLAMP_TO_EDGE,
    wrapR: Cesium.TextureWrap.CLAMP_TO_EDGE,
  });
}

function make2D(context, data, { width, height }) {
  return new Cesium.Texture({
    context,
    source: { arrayBufferView: data, width, height },
    pixelFormat: Cesium.PixelFormat.RGBA,
    pixelDatatype: Cesium.PixelDatatype.HALF_FLOAT,
    flipY: false,
    sampler: linearSampler(),
  });
}

function make3D(context, data, { width, height, depth }) {
  return new VolumeTexture({
    context,
    source: { arrayBufferView: data, width, height, depth },
    pixelFormat: Cesium.PixelFormat.RGBA,
    pixelDatatype: Cesium.PixelDatatype.HALF_FLOAT,
    flipY: false,
    sampler: linearSampler(),
  });
}

export class AtmosphereTextures {
  constructor(resourceUrls) {
    this.resourceUrls = resourceUrls;
    this.transmittance = null;
    this.scattering = null;
    this.irradiance = null;
    this.higherOrderScattering = null;
  }

  async load(context, signal) {
    const names = { 'transmittance.bin': 'transmittance', 'scattering.bin': 'scattering', 'irradiance.bin': 'irradiance', 'higher_order_scattering.bin': 'higherOrderScattering' };
    const read = (path, size) => fetchU16(this.resourceUrls[names[path]], path, size, signal);
    const d = ATMO_DIM;
    const [t, s, ir, ho] = await Promise.all([
      read(
        "transmittance.bin",
        d.transmittance.width * d.transmittance.height,
      ),
      read(
        "scattering.bin",
        d.scattering.width * d.scattering.height * d.scattering.depth,
      ),
      read("irradiance.bin", d.irradiance.width * d.irradiance.height),
      read(
        "higher_order_scattering.bin",
        d.higherOrderScattering.width *
          d.higherOrderScattering.height *
          d.higherOrderScattering.depth,
      ),
    ]);
    signal?.throwIfAborted();
    this.transmittance = make2D(context, t, d.transmittance);
    this.scattering = make3D(context, s, d.scattering);
    this.irradiance = make2D(context, ir, d.irradiance);
    this.higherOrderScattering = make3D(context, ho, d.higherOrderScattering);
  }

  destroy() {
    for (const k of [
      "transmittance",
      "scattering",
      "irradiance",
      "higherOrderScattering",
    ]) {
      if (this[k] && !this[k].isDestroyed()) this[k].destroy();
      this[k] = null;
    }
  }
}
