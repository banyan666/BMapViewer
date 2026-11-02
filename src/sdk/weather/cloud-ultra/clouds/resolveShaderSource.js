/**
 * TAA resolve shader 装配（cloudsResolve.frag + varianceClipping + catmullRom + turbo）。
 * Phase 4：非升采样分支（temporalAntialiasing）。
 */
import { resolveIncludes, unrollLoops, definesToGlsl } from "../glslUtils.js";

import fragRaw from "../shaders/clouds/cloudsResolve.frag?raw";
import turboGlsl from "../shaders/core/turbo.glsl?raw";
import catmullRomGlsl from "../shaders/clouds/catmullRomSampling.glsl?raw";
import varianceClippingGlsl from "../shaders/clouds/varianceClipping.glsl?raw";

// Cesium 视口 quad 顶点着色器
export const RESOLVE_VS = /* glsl */ `
in vec4 position;
in vec2 textureCoordinates;
out vec2 v_textureCoordinates;
void main() {
  gl_Position = position;
  v_textureCoordinates = textureCoordinates;
}
`;

const INCLUDES = {
  core: { turbo: turboGlsl },
  catmullRomSampling: catmullRomGlsl,
  varianceClipping: varianceClippingGlsl,
};

export function buildResolveShader(overrides = {}) {
  const defines = { ...overrides };
  const header = definesToGlsl(defines);
  const fragmentShaderSource =
    header + unrollLoops(resolveIncludes(fragRaw, INCLUDES));
  return { vertexShaderSource: RESOLVE_VS, fragmentShaderSource };
}
