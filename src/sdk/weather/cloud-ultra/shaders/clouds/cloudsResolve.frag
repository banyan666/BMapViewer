precision highp float;
precision highp sampler2DArray;

#include "core/turbo"
#include "catmullRomSampling"
#include "varianceClipping"

uniform sampler2D colorBuffer;
uniform sampler2D depthVelocityBuffer;
uniform sampler2D colorHistoryBuffer;

#ifdef SHADOW_LENGTH
uniform sampler2D shadowLengthBuffer;
uniform sampler2D shadowLengthHistoryBuffer;
#endif // SHADOW_LENGTH

uniform vec2 texelSize;
// 升采样时 colorBuffer/depthVelocityBuffer 是 1/4 线性分辨率，采样偏移须按其 texel 尺寸
uniform vec2 lowResTexelSize;
uniform int frame;
uniform float varianceGamma;
uniform float temporalAlpha;
// 相机平移时放宽 variance clipping（dolly 会真实改变体采样内容，
// gamma=1 时历史被大量裁剪 → 云退化成单帧噪声）。静止时为 0。
uniform float historyClipRelax;

in vec2 v_textureCoordinates;
#define vUv v_textureCoordinates

layout(location = 0) out vec4 outputColor;
#ifdef SHADOW_LENGTH
layout(location = 1) out float outputShadowLength;
#endif // SHADOW_LENGTH

const ivec2 neighborOffsets[9] = ivec2[9](
  ivec2(-1, -1),
  ivec2(-1, 0),
  ivec2(-1, 1),
  ivec2(0, -1),
  ivec2(0, 0),
  ivec2(0, 1),
  ivec2(1, -1),
  ivec2(1, 0),
  ivec2(1, 1)
);

const ivec4[4] bayerIndices = ivec4[4](
  ivec4(0, 12, 3, 15),
  ivec4(8, 4, 11, 7),
  ivec4(2, 14, 1, 13),
  ivec4(10, 6, 9, 5)
);

// 注：Cesium 下 texelFetch(gl_FragCoord) 取值异常，统一改用 texture(uv+texelSize*offset)。
// ts = depthVelocityBuffer 的 texel 尺寸（升采样时为 lowResTexelSize）。
vec4 getClosestFragment(const vec2 uv, const vec2 ts) {
  vec4 result = vec4(1e7, 0.0, 0.0, 0.0);
  vec4 neighbor;
  #pragma unroll_loop_start
  for (int i = 0; i < 9; ++i) {
    neighbor = texture(depthVelocityBuffer, uv + vec2(neighborOffsets[i]) * ts);
    if (neighbor.r < result.r) {
      result = neighbor;
    }
  }
  #pragma unroll_loop_end
  return result;
}

void temporalUpscale(
  const ivec2 coord,
  const ivec2 lowResCoord,
  const bool currentFrame,
  out vec4 outputColor,
  out float outputShadowLength
) {
  // 低分辨率 buffer 的 texel 中心 UV（等价原版 texelFetch(colorBuffer, lowResCoord)）：
  // 纹理中心 + LINEAR 采样即精确取到该 texel 值，规避 Cesium 下 texelFetch 取值异常。
  vec2 uvLow = (vec2(lowResCoord) + 0.5) * lowResTexelSize;
  vec4 currentColor = texture(colorBuffer, uvLow);
  #ifdef SHADOW_LENGTH
  vec4 currentShadowLength = vec4(texture(shadowLengthBuffer, uvLow).rgb, 1.0);
  #endif // SHADOW_LENGTH

  if (currentFrame) {
    // Use the texel just rendered without any accumulation.
    outputColor = currentColor;
    #ifdef SHADOW_LENGTH
    outputShadowLength = currentShadowLength.r;
    #endif // SHADOW_LENGTH
    return;
  }

  vec4 depthVelocity = getClosestFragment(uvLow, lowResTexelSize);
  vec2 velocity = depthVelocity.gb;
  vec2 prevUv = vUv - velocity;
  // NaN 安全的越界判定（同 temporalAntialiasing）
  bool prevUvValid =
    prevUv.x >= 0.0 && prevUv.x <= 1.0 && prevUv.y >= 0.0 && prevUv.y <= 1.0;
  if (!prevUvValid) {
    outputColor = currentColor;
    #ifdef SHADOW_LENGTH
    outputShadowLength = currentShadowLength.r;
    #endif // SHADOW_LENGTH
    return; // Rejection
  }

  // Variance clipping with a large variance gamma seems to work fine for
  // upsampling. This increases ghosting, of course, but it's hard to notice on
  // clouds.
  // vec4 historyColor = textureCatmullRom(colorHistoryBuffer, prevUv);
  vec4 historyColor = texture(colorHistoryBuffer, prevUv);
  vec4 clippedColor = varianceClipping(
    colorBuffer,
    vUv,
    currentColor,
    historyColor,
    varianceGamma + historyClipRelax
  );
  outputColor = clippedColor;

  #ifdef SHADOW_LENGTH
  // Sampling the shadow length history using scene depth doesn't make much
  // sense, but it's too hard to derive it properly. At least this approach
  // resolves the edges of scene objects.
  // vec4 historyShadowLength = vec4(textureCatmullRom(shadowLengthHistoryBuffer, prevUv).rgb, 1.0);
  vec4 historyShadowLength = vec4(texture(shadowLengthHistoryBuffer, prevUv).rgb, 1.0);
  vec4 clippedShadowLength = varianceClipping(
    shadowLengthBuffer,
    vUv,
    currentShadowLength,
    historyShadowLength,
    varianceGamma
  );
  outputShadowLength = clippedShadowLength.r;
  #endif // SHADOW_LENGTH
}

void temporalAntialiasing(const ivec2 coord, out vec4 outputColor, out float outputShadowLength) {
  vec4 currentColor = texture(colorBuffer, vUv);
  #ifdef SHADOW_LENGTH
  vec4 currentShadowLength = vec4(texture(shadowLengthBuffer, vUv).rgb, 1.0);
  #endif // SHADOW_LENGTH

  vec4 depthVelocity = getClosestFragment(vUv, texelSize);
  vec2 velocity = depthVelocity.gb;

  vec2 prevUv = vUv - velocity;
  // NaN 安全的越界判定：NaN 的任何比较都是 false，原写法 (x<0||x>1) 对 NaN 不拒绝，
  // 会用 NaN UV 采历史并污染历史缓冲（逐帧扩散成黑斑）。改为肯定式判定。
  bool prevUvValid =
    prevUv.x >= 0.0 && prevUv.x <= 1.0 && prevUv.y >= 0.0 && prevUv.y <= 1.0;
  if (!prevUvValid) {
    outputColor = currentColor;
    #ifdef SHADOW_LENGTH
    outputShadowLength = currentShadowLength.r;
    #endif // SHADOW_LENGTH
    return; // Rejection
  }

  vec4 historyColor = texture(colorHistoryBuffer, prevUv);
  vec4 clippedColor = varianceClipping(
    colorBuffer,
    vUv,
    currentColor,
    historyColor,
    1.0 + historyClipRelax
  );
  // 像素速度自适应混合权重：快速扫过的像素多信当前帧（2-4 帧收敛），
  // 消除快速旋转时云边缘的拖尾残影（noisy march 让边缘邻域 AABB 很宽，
  // 仅靠 variance clipping 拦不住过期历史）。静止/慢速像素保持 0.1。
  float speedPx = length(velocity / texelSize);
  float alpha = mix(temporalAlpha, 0.35, clamp(speedPx / 12.0, 0.0, 1.0));
  outputColor = mix(clippedColor, currentColor, alpha);

  #ifdef SHADOW_LENGTH
  vec4 historyShadowLength = vec4(texture(shadowLengthHistoryBuffer, prevUv).rgb, 1.0);
  vec4 clippedShadowLength = varianceClipping(
    shadowLengthBuffer,
    coord,
    currentShadowLength,
    historyShadowLength
  );
  outputShadowLength = mix(clippedShadowLength.r, currentShadowLength.r, temporalAlpha);
  #endif // SHADOW_LENGTH
}

void main() {
  ivec2 coord = ivec2(gl_FragCoord.xy);

  #if !defined(SHADOW_LENGTH)
  float outputShadowLength;
  #endif // !defined(SHADOW_LENGTH)

  #ifdef TEMPORAL_UPSCALE
  ivec2 lowResCoord = coord / 4;
  int bayerValue = bayerIndices[coord.x % 4][coord.y % 4];
  bool currentFrame = bayerValue == frame % 16;
  temporalUpscale(coord, lowResCoord, currentFrame, outputColor, outputShadowLength);
  #else // TEMPORAL_UPSCALE
  temporalAntialiasing(coord, outputColor, outputShadowLength);
  #endif // TEMPORAL_UPSCALE

  // NaN/Inf 消毒：本 pass 输出即下一帧历史，任何非有限值一旦写入都会经
  // variance clipping 的邻域运算逐帧扩散成黑斑且永不消退。此处强制归零。
  bvec4 nan = isnan(outputColor);
  bvec4 inf = isinf(outputColor);
  if (any(nan) || any(inf)) {
    outputColor = vec4(0.0);
  }

  #if defined(SHADOW_LENGTH) && defined(DEBUG_SHOW_SHADOW_LENGTH)
  outputColor = vec4(turbo(outputShadowLength * 0.05), 1.0);
  #endif // defined(SHADOW_LENGTH) && defined(DEBUG_SHOW_SHADOW_LENGTH)

  #ifdef DEBUG_SHOW_VELOCITY
  outputColor.rgb = outputColor.rgb + vec3(abs(texture(depthVelocityBuffer, vUv).gb) * 10.0, 0.0);
  #endif // DEBUG_SHOW_VELOCITY
}
