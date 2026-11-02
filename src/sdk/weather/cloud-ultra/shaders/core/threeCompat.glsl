// three.js <common> / <packing> 兼容层：只提供本工程 shader 实际用到的符号。
// 常量用 #define（而非 const），以便 Bruneton definitions.glsl 的 `#if !defined(PI)`
// 守卫生效、避免与其 const 声明重复。

#ifndef PI
#define PI 3.141592653589793
#endif
#ifndef PI2
#define PI2 6.283185307179586
#endif
#ifndef RECIPROCAL_PI
#define RECIPROCAL_PI 0.3183098861837907
#endif
#ifndef RECIPROCAL_PI2
#define RECIPROCAL_PI2 0.15915494309189535
#endif

// three <packing> 深度换算（窗口深度[0,1] ↔ 视空间 Z）
float perspectiveDepthToViewZ(const in float invClipZ, const in float near, const in float far) {
  return (near * far) / ((far - near) * invClipZ - far);
}
float orthographicDepthToViewZ(const in float linearClipZ, const in float near, const in float far) {
  return linearClipZ * (near - far) - near;
}
float viewZToOrthographicDepth(const in float viewZ, const in float near, const in float far) {
  return (viewZ + near) / (near - far);
}
float unpackRGBAToDepth(const in vec4 v) {
  const vec4 UnpackFactors =
    (255.0 / 256.0) / vec4(256.0 * 256.0 * 256.0, 256.0 * 256.0, 256.0, 1.0);
  return dot(v, UnpackFactors);
}
