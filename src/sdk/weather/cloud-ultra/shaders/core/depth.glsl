// Cesium 原生深度读取（替换 three 版本）。
//
// 场景深度来自 czm_globeDepthTexture：RGBA 打包（czm_packDepth），若开启对数深度则
// 存的是对数编码的窗口深度。用 czm_unpackDepth 解包，czm_reverseLogDepth 还原成
// 标准 [0,1] 窗口深度（需 LOG_DEPTH 宏；否则原样返回）。
//
// czm_unpackDepth / czm_reverseLogDepth 为 Cesium 内建，ShaderProgram 会自动注入；
// czm_reverseLogDepth 依赖 czm_currentFrustum 等自动 uniform，在 postRender 阶段有效。

float readDepthValue(const sampler2D depthBuffer, const vec2 uv) {
  return czm_unpackDepth(texture(depthBuffer, uv));
}

float reverseLogDepth(const float depth, const float near, const float far) {
  #ifdef LOG_DEPTH
  return czm_reverseLogDepth(depth);
  #else
  return depth;
  #endif
}

float linearizeDepth(const float depth, const float near, const float far) {
  float ndc = depth * 2.0 - 1.0;
  return 2.0 * near * far / (far + near - ndc * (far - near));
}
