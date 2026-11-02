/**
 * Bruneton 大气参数与纹理常量 —— 从 three-geospatial 的 AtmosphereParameters.DEFAULT
 * 与 constants.ts 提取（用于组装 GLSL 大气常量 + 配置 LUT）。
 *
 * 单位：大气在 km 下工作。METER_TO_LENGTH_UNIT = 1/1000；
 * 长度类（半径、density width）已换算到 km，散射/吸收系数本就是 per-km。
 */

export const METER_TO_LENGTH_UNIT = 1 / 1000;

// LUT 纹理尺寸（与下载的 .bin 一致）
export const TEX = {
  TRANSMITTANCE_WIDTH: 256,
  TRANSMITTANCE_HEIGHT: 64,
  SCATTERING_R_SIZE: 32,
  SCATTERING_MU_SIZE: 128,
  SCATTERING_MU_S_SIZE: 32,
  SCATTERING_NU_SIZE: 8, // WIDTH = NU*MU_S = 256, HEIGHT = MU = 128, DEPTH = R = 32
  IRRADIANCE_WIDTH: 64,
  IRRADIANCE_HEIGHT: 16,
};

// 组装 runtime.glsl 需要的 #define（与 LUT 烘焙配置匹配）
export const ATMO_DEFINES = [
  "COMBINED_SCATTERING_TEXTURES", // scattering.bin 已合并单次 Mie
  "HAS_HIGHER_ORDER_SCATTERING_TEXTURE", // 下载了 higher_order_scattering
];

// AtmosphereParameters.DEFAULT（半径/width 已 × METER_TO_LENGTH_UNIT → km）
export const ATMOSPHERE = {
  solar_irradiance: [1.474, 1.8504, 1.91198],
  sun_angular_radius: 0.004675,
  bottom_radius: 6360.0, // 6360000 m
  top_radius: 6420.0, // 6420000 m
  // DensityProfile: [layer0, layer1]，每层 (width, exp_term, exp_scale, linear_term, constant_term)
  rayleigh_density: [
    [0, 0, 0, 0, 0],
    [0, 1, -0.125, 0, 0],
  ],
  rayleigh_scattering: [0.005802, 0.013558, 0.0331],
  mie_density: [
    [0, 0, 0, 0, 0],
    [0, 1, -0.833333, 0, 0],
  ],
  mie_scattering: [0.003996, 0.003996, 0.003996],
  mie_extinction: [0.00444, 0.00444, 0.00444],
  mie_phase_function_g: 0.8,
  absorption_density: [
    [25, 0, 0, 1 / 15, -2 / 3],
    [0, 0, 0, -1 / 15, 8 / 3],
  ],
  absorption_extinction: [0.00065, 0.001881, 0.000085],
  ground_albedo: [0.1, 0.1, 0.1],
  mu_s_min: Math.cos((120 * Math.PI) / 180), // = -0.5
};

// 半精度缓冲存不下绝对亮度，参考把亮度按"单位辐射太阳亮度"归一化后用。
export const RADIANCE_TO_LUMINANCE = {
  sun: [98242.786222, 69954.398112, 66475.012354],
  sky: [114974.916437, 71305.954816, 65310.548555],
};

/** 把 ATMOSPHERE 对象拼成 GLSL 的 AtmosphereParameters(...) 构造串（字段顺序须对齐 definitions.glsl） */
export function atmosphereToGlsl() {
  const A = ATMOSPHERE;
  // GLSL 严格类型：所有字面量须为 float（带小数点），整数会与 float 字段不匹配
  const f = (n) => (Number.isInteger(n) ? `${n}.0` : `${n}`);
  const v3 = (a) => `vec3(${f(a[0])}, ${f(a[1])}, ${f(a[2])})`;
  const layer = (l) =>
    `DensityProfileLayer(${f(l[0])}, ${f(l[1])}, ${f(l[2])}, ${f(l[3])}, ${f(l[4])})`;
  const prof = (p) =>
    `DensityProfile(DensityProfileLayer[2](${layer(p[0])}, ${layer(p[1])}))`;
  return `AtmosphereParameters(
    ${v3(A.solar_irradiance)},
    ${f(A.sun_angular_radius)},
    ${f(A.bottom_radius)}, ${f(A.top_radius)},
    ${prof(A.rayleigh_density)}, ${v3(A.rayleigh_scattering)},
    ${prof(A.mie_density)}, ${v3(A.mie_scattering)}, ${v3(A.mie_extinction)}, ${f(A.mie_phase_function_g)},
    ${prof(A.absorption_density)}, ${v3(A.absorption_extinction)},
    ${v3(A.ground_albedo)}, ${f(A.mu_s_min)}
  )`;
}
