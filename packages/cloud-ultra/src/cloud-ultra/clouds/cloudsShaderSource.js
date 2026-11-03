/**
 * 主 march shader 装配：把 three-geospatial 的 clouds.vert / clouds.frag 与其
 * #include 依赖解析成两段完整 GLSL3 源码，供 Cesium ShaderProgram 使用。
 *
 * - #include 解析走 glslUtils.resolveIncludes（含 three 的 <common>/<packing> → threeCompat）
 * - 大气整块用已装配好的 ATMOSPHERE_GLSL 替换 `#include "atmosphere/glsl"`
 * - #pragma unroll_loop 用 unrollLoops 展开
 * - defines 拼成头部，含 METER_TO_LENGTH_UNIT 及各功能开关
 *
 * Cesium 会自动加 `#version 300 es`、注入 czm_ 内建/自动 uniform，并保留我们自带的
 * `layout(location=N) out ...`（MRT 输出）。
 */
import { resolveIncludes, unrollLoops, definesToGlsl } from "../glslUtils.js";
import { ATMOSPHERE_GLSL } from "../atmosphere/atmosphereGlsl.js";

import fragRaw from "../shaders/clouds/clouds.frag?raw";
import vertRaw from "../shaders/clouds/clouds.vert?raw";
import cloudsGlsl from "../shaders/clouds/clouds.glsl?raw";
import parametersGlsl from "../shaders/clouds/parameters.glsl?raw";
import typesGlsl from "../shaders/clouds/types.glsl?raw";

import threeCompat from "../shaders/core/threeCompat.glsl?raw";
import depthGlsl from "../shaders/core/depth.glsl?raw";
import mathGlsl from "../shaders/core/math.glsl?raw";
import turboGlsl from "../shaders/core/turbo.glsl?raw";
import generatorsGlsl from "../shaders/core/generators.glsl?raw";
import raySphereGlsl from "../shaders/core/raySphereIntersection.glsl?raw";
import cascadedShadowMapsGlsl from "../shaders/core/cascadedShadowMaps.glsl?raw";
import ignGlsl from "../shaders/core/interleavedGradientNoise.glsl?raw";
import vogelDiskGlsl from "../shaders/core/vogelDisk.glsl?raw";

const INCLUDES = {
  core: {
    // three <common>/<packing> 兼容层（PI 常量 + 深度换算）
    threeCompat,
    common: threeCompat,
    packing: threeCompat,
    depth: depthGlsl,
    math: mathGlsl,
    turbo: turboGlsl,
    generators: generatorsGlsl,
    raySphereIntersection: raySphereGlsl,
    cascadedShadowMaps: cascadedShadowMapsGlsl,
    interleavedGradientNoise: ignGlsl,
    vogelDisk: vogelDiskGlsl,
  },
  atmosphere: {
    glsl: ATMOSPHERE_GLSL,
  },
  types: typesGlsl,
  parameters: parametersGlsl,
  clouds: cloudsGlsl,
};

/**
 * @param {object} [overrides] 覆盖/追加的 defines
 * @returns {{ vertexShaderSource: string, fragmentShaderSource: string, defines: object }}
 */
export function buildCloudsShaders(overrides = {}) {
  const defines = {
    METER_TO_LENGTH_UNIT: "0.0010000",
    PERSPECTIVE_CAMERA: true,

    LOCAL_WEATHER_CHANNELS: "rgba",
    SHAPE_DETAIL: true,
    TURBULENCE: true,
    HAZE: true,
    POWDER: true,
    GROUND_BOUNCE: true,
    ACCURATE_SUN_SKY_LIGHT: true,
    // ACCURATE_PHASE_FUNCTION 关（默认 high 预设即关）
    MULTI_SCATTERING_OCTAVES: 8,

    SCATTER_ANISOTROPY_1: "0.7",
    SCATTER_ANISOTROPY_2: "-0.2",
    SCATTER_ANISOTROPY_MIX: "0.5",

    // Phase 3：无级联阴影，用 1 级联 + 全零假 shadowBuffer；无 shadow length
    SHADOW_CASCADE_COUNT: 1,
    SHADOW_SAMPLE_COUNT: 8,
    // SHADOW_LENGTH 关
    // TEMPORAL_UPSCALE 关（Phase 6）
    // LOG_DEPTH 运行时按 scene.logarithmicDepthBuffer 追加

    ...overrides,
  };

  const header = definesToGlsl(defines);

  const fragmentShaderSource =
    header + unrollLoops(resolveIncludes(fragRaw, INCLUDES));
  const vertexShaderSource = header + resolveIncludes(vertRaw, INCLUDES);

  return { vertexShaderSource, fragmentShaderSource, defines };
}
