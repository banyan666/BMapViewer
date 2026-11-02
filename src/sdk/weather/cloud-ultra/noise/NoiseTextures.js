import * as Cesium from "cesium";
import { VolumeTexture } from "../gl/VolumeTexture.js";


/**
 * 噪声纹理集 —— 在 Web Worker 里 CPU 烘焙忠实 Perlin-Worley，再上传成 Cesium Texture3D。
 *
 *   shape : 128³ RGBA8（仅 R 有效）—— 云的大尺度形状/体积
 *   detail: 32³  RGBA8（仅 R 有效）—— 高频菜花细节
 *
 * 用法：
 *   const noise = new NoiseTextures();
 *   await noise.bake(context, (p) => {...});   // p: 0..100 进度
 *   noise.shape / noise.detail                 // Cesium.Texture3D
 *   noise.destroy();
 */
export class NoiseTextures {
  constructor(workerUrl) {
    this.workerUrl = workerUrl;
    this._cancel = null;
    this.shape = null;
    this.detail = null;
    this._worker = null;
  }

  /** REPEAT + LINEAR 的 3D sampler（可平铺采样） */
  static _sampler() {
    return new Cesium.Sampler({
      minificationFilter: Cesium.TextureMinificationFilter.LINEAR,
      magnificationFilter: Cesium.TextureMagnificationFilter.LINEAR,
      wrapS: Cesium.TextureWrap.REPEAT,
      wrapT: Cesium.TextureWrap.REPEAT,
      wrapR: Cesium.TextureWrap.REPEAT,
    });
  }

  static _make3D(context, data, size) {
    return new VolumeTexture({
      context,
      source: { arrayBufferView: data, width: size, height: size, depth: size },
      pixelFormat: Cesium.PixelFormat.RGBA,
      pixelDatatype: Cesium.PixelDatatype.UNSIGNED_BYTE,
      flipY: false,
      sampler: NoiseTextures._sampler(),
    });
  }

  /**
   * 烘焙并上传。
   * @param {Cesium.Context} context  scene.context
   * @param {(progress:number)=>void} [onProgress]
   * @returns {Promise<void>}
   */
  bake(context, onProgress, signal) {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) { reject(signal.reason); return; }
      const worker = new Worker(this.workerUrl, { type: "module" });
      const cleanup = () => { worker.terminate(); this._worker = null; this._cancel = null; signal?.removeEventListener("abort", cancel); };
      const cancel = () => { cleanup(); reject(Object.assign(new Error("CloudUltraEffect noise cancelled"), { name: "AbortError" })); };
      this._cancel = cancel;
      signal?.addEventListener("abort", cancel, { once: true });
      this._worker = worker;
      worker.onmessage = (e) => {
        const d = e.data;
        if (d.type === "progress") {
          onProgress && onProgress(d.value);
        } else if (d.type === "done") {
          cleanup();
          try {
            this.shape = NoiseTextures._make3D(
              context,
              new Uint8Array(d.shape),
              d.shapeSize,
            );
            this.detail = NoiseTextures._make3D(
              context,
              new Uint8Array(d.detail),
              d.detailSize,
            );
            resolve();
          } catch (err) {
            reject(err);
          }
        }
      };
      worker.onerror = (err) => {
        cleanup();
        reject(err);
      };
      worker.postMessage("bake");
    });
  }

  destroy() {
    this._cancel?.();
    if (this._worker) {
      this._worker.terminate();
      this._worker = null;
    }
    if (this.shape && !this.shape.isDestroyed()) this.shape.destroy();
    if (this.detail && !this.detail.isDestroyed()) this.detail.destroy();
    this.shape = this.detail = null;
  }
}
