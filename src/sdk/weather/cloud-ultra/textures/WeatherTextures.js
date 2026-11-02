import * as Cesium from "cesium";
import { resolveIncludes } from "../glslUtils.js";
import { ScreenSpacePass } from "../gl/ScreenSpacePass.js";

import mathGlsl from "../shaders/core/math.glsl?raw";
import perlinGlsl from "../shaders/weather/perlin.glsl?raw";
import tileableNoiseGlsl from "../shaders/weather/tileableNoise.glsl?raw";
import localWeatherFrag from "../shaders/weather/localWeather.frag?raw";
import turbulenceFrag from "../shaders/weather/turbulence.frag?raw";

// Cesium 视口 quad 顶点着色器（等价于内建 ViewportQuadVS）
const QUAD_VS = /* glsl */ `
in vec4 position;
in vec2 textureCoordinates;
out vec2 v_textureCoordinates;
void main() {
  gl_Position = position;
  v_textureCoordinates = textureCoordinates;
}
`;

const INCLUDES = {
  core: { math: mathGlsl },
  perlin: perlinGlsl,
  tileableNoise: tileableNoiseGlsl,
};

const LOCAL_WEATHER_SIZE = 512;
const TURBULENCE_SIZE = 128;

function makeTarget(context, size) {
  const texture = new Cesium.Texture({
    context,
    width: size,
    height: size,
    pixelFormat: Cesium.PixelFormat.RGBA,
    pixelDatatype: Cesium.PixelDatatype.UNSIGNED_BYTE,
    sampler: new Cesium.Sampler({
      minificationFilter: Cesium.TextureMinificationFilter.LINEAR,
      magnificationFilter: Cesium.TextureMagnificationFilter.LINEAR,
      wrapS: Cesium.TextureWrap.REPEAT,
      wrapT: Cesium.TextureWrap.REPEAT,
    }),
  });
  let framebuffer;
  try { framebuffer = new Cesium.Framebuffer({
    context,
    colorTextures: [texture],
    destroyAttachments: false,
  }); } catch (error) { texture.destroy(); throw error; }
  return { texture, framebuffer };
}

/**
 * 程序化天气/湍流纹理（GPU 一次性烘焙）。
 *   localWeather: 512² RGBA8 REPEAT —— 4 通道对应 4 层云覆盖
 *   turbulence:   128² RGBA8 REPEAT —— curl 噪声位移场
 *
 * bake(context) 需在能执行 DrawCommand 的上下文里调用（如 scene.postRender 首帧）。
 * Phase 3 暂不生成 mipmap（Phase 6 上采样时再补）。
 */
export class WeatherTextures {
  constructor() {
    this.localWeather = null;
    this.turbulence = null;
    this._resources = [];
    this._baked = false;
  }

  _buildPass(context, frag, size) {
    const target = makeTarget(context, size);
    let pass;
    try { pass = new ScreenSpacePass(context, {
      vertexShaderSource: QUAD_VS,
      fragmentShaderSource: resolveIncludes(frag, INCLUDES),
      uniformMap: {},
    }); } catch (error) { target.framebuffer.destroy(); target.texture.destroy(); throw error; }
    this._resources.push({ target, pass });
    return { target, pass };
  }

  prepare(context) {
    if (this._localWeatherPass) return;
    const lw = this._buildPass(context, localWeatherFrag, LOCAL_WEATHER_SIZE);
    const tb = this._buildPass(context, turbulenceFrag, TURBULENCE_SIZE);
    this._localWeatherPass = lw;
    this._turbulencePass = tb;
    this.localWeather = lw.target.texture;
    this.turbulence = tb.target.texture;
  }

  bake(context) {
    if (this._baked) return;
    this.prepare(context);
    this._localWeatherPass.pass.execute(
      this._localWeatherPass.target.framebuffer,
      {
        width: LOCAL_WEATHER_SIZE,
        height: LOCAL_WEATHER_SIZE,
        clear: true,
      },
    );
    this._turbulencePass.pass.execute(this._turbulencePass.target.framebuffer, {
      width: TURBULENCE_SIZE,
      height: TURBULENCE_SIZE,
      clear: true,
    });
    this._baked = true;
  }

  destroy() {
    for (const { target, pass } of this._resources) {
      if (target.framebuffer && !target.framebuffer.isDestroyed())
        target.framebuffer.destroy();
      if (target.texture && !target.texture.isDestroyed())
        target.texture.destroy();
      pass.destroy();
    }
    this._resources = [];
    this._localWeatherPass = null;
    this._turbulencePass = null;
    this.localWeather = null;
    this.turbulence = null;
    this._baked = false;
  }
}
