/**
 * 级联 Beer Shadow Map shader 装配（shadow.frag + structuredSampling + clouds.glsl）。
 * Phase 5：非 temporal（无 velocity/resolve）。所有级联一次 draw 写到 Texture3D 各层。
 */
import { resolveIncludes, unrollLoops, definesToGlsl } from "../glslUtils.js";

import fragRaw from "../shaders/shadow/shadow.frag?raw";
import typesGlsl from "../shaders/clouds/types.glsl?raw";
import parametersGlsl from "../shaders/clouds/parameters.glsl?raw";
import cloudsGlsl from "../shaders/clouds/clouds.glsl?raw";
import structuredSamplingGlsl from "../shaders/shadow/structuredSampling.glsl?raw";

import threeCompat from "../shaders/core/threeCompat.glsl?raw";
import mathGlsl from "../shaders/core/math.glsl?raw";
import raySphereGlsl from "../shaders/core/raySphereIntersection.glsl?raw";

export const SHADOW_VS = /* glsl */ `
in vec4 position;
in vec2 textureCoordinates;
out vec2 v_textureCoordinates;
void main() {
  gl_Position = position;
  v_textureCoordinates = textureCoordinates;
}
`;

const INCLUDES = {
  core: {
    threeCompat,
    common: threeCompat,
    math: mathGlsl,
    raySphereIntersection: raySphereGlsl,
  },
  types: typesGlsl,
  parameters: parametersGlsl,
  clouds: cloudsGlsl,
  structuredSampling: structuredSamplingGlsl,
};

export function buildShadowShader(cascadeCount, overrides = {}) {
  const defines = {
    METER_TO_LENGTH_UNIT: "0.0010000",
    CASCADE_COUNT: cascadeCount,
    SHADOW: true, // clouds.glsl 按 shadowLayerMask 过滤投影层
    LOCAL_WEATHER_CHANNELS: "rgba",
    SHAPE_DETAIL: true,
    TURBULENCE: true,
    ...overrides,
  };
  const header = definesToGlsl(defines);
  const fragmentShaderSource =
    header + unrollLoops(resolveIncludes(fragRaw, INCLUDES));
  return { vertexShaderSource: SHADOW_VS, fragmentShaderSource };
}
