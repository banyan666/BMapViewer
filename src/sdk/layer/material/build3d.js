import * as Cesium from 'cesium'

export const BUILD_SHADER_DEFAULTS = Object.freeze({
  enabled: false,
  gradientEnabled: true,
  sweepEnabled: false,
  active: true,
  minColor: '#09090e',
  maxColor: '#0080ff',
  sweepColor: '#00aeeb',
  modelHeight: 100,
  heightOffset: 0,
  sweepWidth: 0.02,
  speed: 2,
})

export function buildColor(value) {
  const color = typeof value === 'string' ? Cesium.Color.fromCssColorString(value)
    : value instanceof Cesium.Color ? Cesium.Color.clone(value) : undefined
  if (!color || ![color.red, color.green, color.blue, color.alpha].every((v) => Number.isFinite(v) && v >= 0 && v <= 1)) {
    throw new TypeError('color must be a CSS color string or Cesium.Color with components in [0, 1].')
  }
  return color
}

export function normalizeBuildShader(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('shader must be an object or boolean.')
  const config = { ...BUILD_SHADER_DEFAULTS, ...input }
  for (const key of ['enabled', 'gradientEnabled', 'sweepEnabled', 'active']) {
    if (typeof config[key] !== 'boolean') throw new TypeError(`${key} must be a boolean.`)
  }
  for (const key of ['modelHeight', 'heightOffset', 'sweepWidth', 'speed']) {
    if (!Number.isFinite(config[key])) throw new TypeError(`${key} must be a finite number.`)
  }
  if (config.modelHeight <= 0 || config.sweepWidth <= 0 || config.speed < 0) throw new RangeError('modelHeight and sweepWidth must be positive; speed must be nonnegative.')
  for (const key of ['minColor', 'maxColor', 'sweepColor']) {
    const color = buildColor(config[key])
    if (config[key] instanceof Cesium.Color) config[key] = color
  }
  return config
}

export const BUILD_VERTEX_SHADER = `
void vertexMain(VertexInput vsInput, inout czm_modelVertexOutput vsOutput) {
    float adjustedZ = vsInput.attributes.positionMC.z + u_height_offset;
    float normalizedHeight = clamp(adjustedZ / u_model_height, 0.0, 1.0);
    float enhancedHeight = sqrt(normalizedHeight);
    v_uv = vec2(enhancedHeight, enhancedHeight);
}`

export const BUILD_FRAGMENT_SHADER = `
float buildRandom(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}
void fragmentMain(FragmentInput fsInput, inout czm_modelMaterial material) {
    vec3 maxColor = u_mix_color2;
    // Read the same per-feature color for legacy batch tables and EXT_mesh_features.
    #ifdef HAS_SELECTED_FEATURE_ID
    SelectedFeature buildFeature;
    selectedFeatureIdStage(buildFeature, fsInput.featureIds);
    if (any(lessThan(buildFeature.color.rgb, vec3(1.0)))) {
        vec3 featureColor = buildFeature.color.rgb;
        // White is reserved by Cesium for "no styling"; decode our near-white marker.
        if (all(lessThan(abs(featureColor - vec3(1.0, 1.0, 254.0 / 255.0)), vec3(0.001)))) {
            featureColor = vec3(1.0);
        }
        // Per-building colors replace only the gradient's upper endpoint.
        // With no gradient, use the feature color as the base and still apply the sweep.
        maxColor = featureColor;
        if (!u_gradient_enabled) material.diffuse = czm_srgbToLinear(featureColor);
    }
    #endif
    float gradientFactor = smoothstep(0.0, 1.0, v_uv.y);
    vec3 originColor = u_gradient_enabled ? mix(u_mix_color1, maxColor, gradientFactor) : material.diffuse;
    material.diffuse = originColor;
    if (!u_sweep_enabled) return;
    float t = fract(u_time * u_speed) * 2.0;
    vec2 absUv = abs(v_uv - t);
    vec2 st = v_uv * 15.0;
    vec2 ipos = floor(st + u_time * 5.0);
    float r = buildRandom(ipos) + 0.2;
    float d = clamp(absUv.y / u_sweep_width, 0.0, 1.0);
    float diffuse = clamp(-dot(czm_sunDirectionEC, fsInput.attributes.normalEC), 0.0, 0.45);
    material.diffuse = mix(u_sweep_color * r + u_sweep_color * 0.8, originColor, d);
    material.emissive = vec3(diffuse) * (1.0 - d);
}`

export function buildShaderUniforms(config, time = 0) {
  const scalar = (value, type = Cesium.UniformType.FLOAT) => ({ value, type })
  const rgb = (value) => {
    const color = buildColor(value)
    return scalar(new Cesium.Cartesian3(color.red, color.green, color.blue), Cesium.UniformType.VEC3)
  }
  return {
    u_time: scalar(time),
    u_mix_color1: rgb(config.minColor),
    u_mix_color2: rgb(config.maxColor),
    u_sweep_color: rgb(config.sweepColor),
    u_model_height: scalar(config.modelHeight),
    u_height_offset: scalar(config.heightOffset),
    u_sweep_width: scalar(config.sweepWidth),
    u_speed: scalar(config.speed),
    u_gradient_enabled: scalar(config.gradientEnabled, Cesium.UniformType.BOOL),
    u_sweep_enabled: scalar(config.sweepEnabled, Cesium.UniformType.BOOL),
  }
}

export function createBuildShader(config, time) {
  return new Cesium.CustomShader({
    uniforms: buildShaderUniforms(config, time),
    varyings: { v_uv: Cesium.VaryingType.VEC2 },
    vertexShaderText: BUILD_VERTEX_SHADER,
    fragmentShaderText: BUILD_FRAGMENT_SHADER,
  })
}
