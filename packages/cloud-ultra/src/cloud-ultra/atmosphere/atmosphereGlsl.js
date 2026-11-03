import definitionsGlsl from "./bruneton/definitions.glsl?raw";
import commonGlsl from "./bruneton/common.glsl?raw";
import runtimeGlsl from "./bruneton/runtime.glsl?raw";
import { TEX, atmosphereToGlsl } from "./atmosphereConstants.js";

/**
 * 组装 Bruneton 大气 runtime GLSL（可拼进 fragment shader）。
 *
 * 结构：尺寸 #define + 配置开关 → definitions（结构/类型）→ common（参数化辅助）
 *   → 全局（LUT 采样器 + ATMOSPHERE 常量 + 亮度转换向量）→ runtime（公开函数 + 便捷层）。
 *
 * runtime 底部便捷层用全局 ATMOSPHERE/采样器/*_SPECTRAL_RADIANCE_TO_LUMINANCE，
 * 并 #define 把云调用名映射到 *Luminance/*Illuminance 变体，故全局须在 runtime 前声明。
 *
 * 采样器 uniform 名（须与绑定一致）：
 *   transmittance_texture(2D) scattering_texture(3D) single_mie_scattering_texture(3D)
 *   irradiance_texture(2D) higher_order_scattering_texture(3D)
 *
 * 暴露给上层的便捷函数（来自 runtime 便捷层 + #define 映射）：
 *   vec3 GetSkyRadiance(camera, viewRay, shadowLength, sunDir, out transmittance)
 *   vec3 GetSolarRadiance()
 *   vec3 GetSkyRadianceToPoint(camera, point, shadowLength, sunDir, out transmittance)
 *   vec3 GetSunAndSkyIrradiance(p, normal, sunDir, out skyIrradiance)
 *   vec3 GetSunAndSkyScalarIrradiance(p, sunDir, out skyIrradiance)
 *   位置/相机均为 km、相对行星中心（bottom_radius=6360km）。
 */

// 半精度缓冲存不下绝对亮度 → 用"相对太阳亮度"（除以 LUMINANCE_COEFFS·sunRadianceToLuminance≈75727）
const SUN_REL = "vec3(1.297320, 0.923781, 0.877838)";
const SKY_REL = "vec3(1.518267, 0.941625, 0.862527)";

const HEADER = `
#define COMBINED_SCATTERING_TEXTURES
#define HAS_HIGHER_ORDER_SCATTERING_TEXTURE
#define TRANSMITTANCE_TEXTURE_WIDTH ${TEX.TRANSMITTANCE_WIDTH}
#define TRANSMITTANCE_TEXTURE_HEIGHT ${TEX.TRANSMITTANCE_HEIGHT}
#define SCATTERING_TEXTURE_R_SIZE ${TEX.SCATTERING_R_SIZE}
#define SCATTERING_TEXTURE_MU_SIZE ${TEX.SCATTERING_MU_SIZE}
#define SCATTERING_TEXTURE_MU_S_SIZE ${TEX.SCATTERING_MU_S_SIZE}
#define SCATTERING_TEXTURE_NU_SIZE ${TEX.SCATTERING_NU_SIZE}
#define IRRADIANCE_TEXTURE_WIDTH ${TEX.IRRADIANCE_WIDTH}
#define IRRADIANCE_TEXTURE_HEIGHT ${TEX.IRRADIANCE_HEIGHT}
`;

const GLOBALS = `
uniform sampler2D transmittance_texture;
uniform highp sampler3D scattering_texture;
uniform highp sampler3D single_mie_scattering_texture;
uniform sampler2D irradiance_texture;
uniform highp sampler3D higher_order_scattering_texture;
const vec3 SUN_SPECTRAL_RADIANCE_TO_LUMINANCE = ${SUN_REL};
const vec3 SKY_SPECTRAL_RADIANCE_TO_LUMINANCE = ${SKY_REL};
const AtmosphereParameters ATMOSPHERE = ${atmosphereToGlsl()};
`;

/** 完整大气 runtime GLSL 串 */
export const ATMOSPHERE_GLSL = [
  HEADER,
  definitionsGlsl,
  commonGlsl,
  GLOBALS,
  runtimeGlsl,
].join("\n");

/** 5 个 LUT 采样器的 uniformMap 片段（合并进 PostProcessStage/Pass 的 uniforms） */
export function atmosphereUniforms(atmoTextures) {
  return {
    transmittance_texture: () => atmoTextures.transmittance,
    scattering_texture: () => atmoTextures.scattering,
    // combined 模式下 single_mie 不单独使用，绑到 scattering 占位即可
    single_mie_scattering_texture: () => atmoTextures.scattering,
    irradiance_texture: () => atmoTextures.irradiance,
    higher_order_scattering_texture: () => atmoTextures.higherOrderScattering,
  };
}
