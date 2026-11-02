import { PixelDatatype, PixelFormat } from 'cesium'

// 局部 WebGL2 三维纹理适配，不修改 Cesium 命名空间，兼容 SDK 的 Cesium 1.118。
export class VolumeTexture {
  constructor({ context, source, pixelFormat, pixelDatatype, sampler = {} }) {
    const gl = this._gl = context._gl
    this._target = gl.TEXTURE_3D
    this.width = source.width; this.height = source.height; this.depth = source.depth
    this._texture = gl.createTexture()
    const binding = gl.getParameter(gl.TEXTURE_BINDING_3D)
    const alignment = gl.getParameter(gl.UNPACK_ALIGNMENT)
    const flipY = gl.getParameter(gl.UNPACK_FLIP_Y_WEBGL)
    const premultiply = gl.getParameter(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL)
    try {
      gl.bindTexture(gl.TEXTURE_3D, this._texture)
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1)
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false)
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
      gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, sampler.minificationFilter ?? gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, sampler.magnificationFilter ?? gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, sampler.wrapS ?? gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, sampler.wrapT ?? gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, sampler.wrapR ?? sampler.wrapT ?? gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAX_LEVEL, 0)
      const internalFormat = pixelDatatype === PixelDatatype.UNSIGNED_BYTE
        ? ({ [gl.RED]: gl.R8, [gl.RGB]: gl.RGB8, [gl.RGBA]: gl.RGBA8 })[pixelFormat]
        : PixelFormat.toInternalFormat(pixelFormat, pixelDatatype, context)
      gl.texImage3D(gl.TEXTURE_3D, 0, internalFormat, this.width, this.height, this.depth, 0, pixelFormat, pixelDatatype === PixelDatatype.HALF_FLOAT ? gl.HALF_FLOAT : pixelDatatype, source.arrayBufferView)
    } catch (error) {
      this.destroy()
      throw error
    } finally {
      gl.pixelStorei(gl.UNPACK_ALIGNMENT, alignment)
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, flipY)
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, premultiply)
      gl.bindTexture(gl.TEXTURE_3D, binding)
    }
  }

  isDestroyed() { return this._texture == null }
  destroy() {
    if (this._texture) this._gl.deleteTexture(this._texture)
    this._texture = null
  }
}
