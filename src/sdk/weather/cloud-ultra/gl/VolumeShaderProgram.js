import { AutomaticUniforms, ShaderSource } from 'cesium'

function compile(gl, type, source) {
  const shader = gl.createShader(type)
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader)
    gl.deleteShader(shader)
    throw new Error('CloudUltraEffect shader: ' + message)
  }
  return shader
}

function components(value, count, result, offset = 0) {
  const keys = value?.red !== undefined ? ['red', 'green', 'blue', 'alpha'] : ['x', 'y', 'z', 'w']
  for (let i = 0; i < count; i++) result[offset + i] = value[i] ?? value[keys[i]]
}

// Cesium 1.118 的 ShaderProgram 尚不识别 sampler3D。此适配器仅服务云管线，
// 复用 Cesium 的 GLSL 内建展开和 DrawCommand，不打补丁或升级宿主 Cesium。
export class VolumeShaderProgram {
  constructor({ context, vertexShaderSource, fragmentShaderSource, attributeLocations }) {
    const gl = this._gl = context._gl
    const shaders = []
    this._program = gl.createProgram()
    try {
      shaders.push(compile(gl, gl.VERTEX_SHADER, new ShaderSource({ sources: [vertexShaderSource] }).createCombinedVertexShader(context)))
      shaders.push(compile(gl, gl.FRAGMENT_SHADER, new ShaderSource({ sources: [fragmentShaderSource] }).createCombinedFragmentShader(context)))
      shaders.forEach((shader) => gl.attachShader(this._program, shader))
      Object.entries(attributeLocations).forEach(([name, location]) => gl.bindAttribLocation(this._program, location, name))
      gl.linkProgram(this._program)
      if (!gl.getProgramParameter(this._program, gl.LINK_STATUS)) throw new Error('CloudUltraEffect link: ' + gl.getProgramInfoLog(this._program))
      this._uniforms = []
      let unit = 0
      for (let i = 0; i < gl.getProgramParameter(this._program, gl.ACTIVE_UNIFORMS); i++) {
        const info = gl.getActiveUniform(this._program, i)
        const name = info.name.replace(/\[0\]$/, '')
        const sampler = [gl.SAMPLER_2D, gl.SAMPLER_3D, gl.SAMPLER_CUBE, gl.SAMPLER_2D_ARRAY].includes(info.type)
        this._uniforms.push({ name, type: info.type, size: info.size, isArray: info.name.endsWith('[0]'), location: gl.getUniformLocation(this._program, info.name), unit, sampler, buffer: new Float32Array(info.size * 16) })
        if (sampler) unit += info.size
      }
      if (unit > gl.getParameter(gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS)) throw new Error('CloudUltraEffect 纹理单元不足')
      this.maximumTextureUnitIndex = unit
    } catch (error) {
      this.destroy()
      throw error
    } finally {
      shaders.forEach((shader) => gl.deleteShader(shader))
    }
  }

  _bind() { this._gl.useProgram(this._program) }

  _setUniforms(map, state) {
    const gl = this._gl
    for (const uniform of this._uniforms) {
      const { name, location, type, size, sampler, unit, buffer } = uniform
      const value = AutomaticUniforms[name] ? AutomaticUniforms[name].getValue(state) : map[name]?.()
      if (value == null) throw new Error('CloudUltraEffect 缺少 uniform: ' + name)
      if (sampler) {
        for (let i = 0; i < size; i++) {
          const texture = size > 1 ? value[i] : value
          gl.activeTexture(gl.TEXTURE0 + unit + i)
          gl.bindTexture(texture._target, texture._texture)
          gl.uniform1i(size > 1 ? gl.getUniformLocation(this._program, name + '[' + i + ']') : location, unit + i)
        }
      } else if (type === gl.FLOAT) {
        if (size === 1) gl.uniform1f(location, value)
        else gl.uniform1fv(location, value)
      } else if (type === gl.INT || type === gl.BOOL) {
        if (size === 1) gl.uniform1i(location, Number(value))
        else gl.uniform1iv(location, value)
      } else {
        const count = ({ [gl.FLOAT_VEC2]: 2, [gl.FLOAT_VEC3]: 3, [gl.FLOAT_VEC4]: 4, [gl.FLOAT_MAT2]: 4, [gl.FLOAT_MAT3]: 9, [gl.FLOAT_MAT4]: 16 })[type]
        if (!count) throw new Error('CloudUltraEffect 不支持 uniform 类型: ' + type)
        if (size === 1) components(uniform.isArray ? value[0] : value, count, buffer)
        else for (let i = 0; i < size; i++) components(value[i], count, buffer, i * count)
        const data = buffer.subarray(0, count * size)
        if (type === gl.FLOAT_MAT2) gl.uniformMatrix2fv(location, false, data)
        else if (type === gl.FLOAT_MAT3) gl.uniformMatrix3fv(location, false, data)
        else if (type === gl.FLOAT_MAT4) gl.uniformMatrix4fv(location, false, data)
        else gl['uniform' + count + 'fv'](location, data)
      }
    }
  }

  isDestroyed() { return this._program == null }
  destroy() {
    if (this._program) this._gl.deleteProgram(this._program)
    this._program = null
  }
}
