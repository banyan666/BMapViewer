// 参考本地 CESIUM-TREASURE-BOX 的 FogDemo.vue / lib/weather.ts 中的 FOG_FRAGMENT。
// 保留视线投影、近场偏移、线性高度积分与亮度合成；仅适配 SDK 参数并保护零距离/水平/向上视线。
export const heightFogDensityFunctions = /* glsl */ `
float bmvHeightFogIntegral(float viewHeight, float cameraHeight, float pixelHeight,
  float fogMaxHeight, float distanceToCamera, float startDistance, float density) {
  float fogDistance = distanceToCamera - startDistance;
  if (fogDistance <= 0.0 || density <= 0.0) return 0.0;

  // 与参考案例一致：沿观察方向前移起雾距离后，再计算高度积分。
  cameraHeight -= startDistance * viewHeight;
  float upperHeight = min(cameraHeight, fogMaxHeight);
  float lowerHeight = min(pixelHeight, fogMaxHeight);
  float fog;
  if (abs(viewHeight) <= 0.01) {
    // 水平视线不用除以竖直分量；相机在雾层顶部以上时不产生雾。
    fog = cameraHeight < fogMaxHeight
      ? (density / 10.0) * (1.0 - cameraHeight / fogMaxHeight) * fogDistance
      : 0.0;
  } else {
    fog = (upperHeight - lowerHeight)
      - 0.5 * (upperHeight * upperHeight - lowerHeight * lowerHeight) / fogMaxHeight;
    // 保留投影符号：向上观察时分子、分母同时为负，不能直接 max(viewHeight, epsilon)。
    fog = (density / 10.0) * fog / viewHeight;
  }
  fog = max(fog, 0.0);
  return clamp(fog / (fog + 1.0), 0.0, 1.0);
}
`

export const heightFogShader = /* glsl */ `
uniform sampler2D colorTexture;
uniform sampler2D depthTexture;
uniform float u_earthRadiusOnCamera;
uniform float u_cameraHeight;
uniform float u_fogHeight;
uniform float u_baseHeight;
uniform float u_globalDensity;
uniform float u_startDistance;
uniform float u_maxDistance;
uniform float u_maxOpacity;
uniform float u_intensity;
uniform float brightness;
uniform vec4 u_fogColor;
in vec2 v_textureCoordinates;

${heightFogDensityFunctions}

void main() {
  vec4 color = texture(colorTexture, v_textureCoordinates);
  vec3 sceneColor = color.rgb * brightness;
  out_FragColor = vec4(sceneColor, color.a);
  float depth = czm_unpackDepth(texture(depthTexture, v_textureCoordinates));
  // 天空不雾化，但与参考案例一致参与整体亮度调节。
  if (depth <= 0.0 || depth >= 1.0 || u_globalDensity <= 0.0 || u_intensity <= 0.0) return;
  // 直接传入打包的原始深度，由 Cesium 内部处理对数深度，避免重复解码。
  vec4 positionEC = czm_windowToEyeCoordinates(gl_FragCoord.xy, depth);
  if (abs(positionEC.w) < 1e-10) return;
  vec3 positionWC = (czm_inverseView * vec4(positionEC.xyz / positionEC.w, 1.0)).xyz;
  vec3 positionToCamera = positionWC - czm_viewerPositionWC;
  float distanceToCamera = length(positionToCamera);
  if (distanceToCamera <= u_startDistance || distanceToCamera < 0.001) return;
  vec3 direction = positionToCamera / distanceToCamera;
  if (distanceToCamera > u_maxDistance) {
    distanceToCamera = u_maxDistance;
    positionWC = czm_viewerPositionWC + direction * distanceToCamera;
  }
  float pixelHeight = length(positionWC) - u_earthRadiusOnCamera - u_baseHeight;
  // 对单位视线在局部向下方向上的投影，等价于参考 projectVector 的有符号投影长度。
  float viewHeight = dot(direction, -normalize(czm_viewerPositionWC));
  float fog = bmvHeightFogIntegral(viewHeight, u_cameraHeight - u_baseHeight, pixelHeight,
    max(u_fogHeight - u_baseHeight, 0.0001), distanceToCamera, u_startDistance, u_globalDensity);
  fog = min(u_maxOpacity, fog * u_intensity * u_fogColor.a);
  out_FragColor = vec4(mix(sceneColor, u_fogColor.rgb * brightness, fog), color.a);
}
`
