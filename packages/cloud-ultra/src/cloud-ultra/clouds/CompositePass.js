import * as Cesium from "cesium";
import { ScreenSpacePass } from "../gl/ScreenSpacePass.js";
import {
  ATMOSPHERE_GLSL,
  atmosphereUniforms,
} from "../atmosphere/atmosphereGlsl.js";

// 与 CloudsPipeline/ShadowPass 一致的级联数（Composite 侧固定展开，不走 unrollLoops）。
const SHADOW_CASCADE_COUNT = 3;
// 与 uniforms.js 的 BOTTOM_RADIUS 一致（米）：getDistanceToShadowTop 用的球面半径。
const BOTTOM_RADIUS_M = 6360000;

// 合成：天空（Bruneton）+ 地表空气透视 + 云 over + 曝光/色调映射 → 画布重写。
// 地面像素读取 postRender 开头捕获的"云合成前"画布颜色（Cesium 地表终色），
// 逆 tonemap 抬回 HDR 后叠加空气透视，再与云 over，最终统一走一次 tonemap。
const COMPOSITE_VS = /* glsl */ `
in vec4 position;
in vec2 textureCoordinates;
out vec2 v_textureCoordinates;
void main() {
  gl_Position = position;
  v_textureCoordinates = textureCoordinates;
}
`;

function buildCompositeFS(logDepth) {
  return /* glsl */ `
precision highp float;
precision highp sampler3D;

#define METER_TO_LENGTH_UNIT 0.0010000
#define SHADOW_CASCADE_COUNT ${SHADOW_CASCADE_COUNT}
#define BOTTOM_RADIUS_M ${BOTTOM_RADIUS_M}.0
${logDepth ? "#define LOG_DEPTH" : ""}

${ATMOSPHERE_GLSL}

uniform sampler2D cloudColorBuffer;
uniform sampler2D depthBuffer;
uniform sampler2D sceneColorBuffer;
uniform highp sampler3D shadowBuffer;
uniform mat4 inverseViewMatrix;
uniform mat4 inverseProjectionMatrix;
uniform mat4 viewMatrix;
uniform mat4 shadowMatrices[SHADOW_CASCADE_COUNT];
uniform vec2 shadowIntervals[SHADOW_CASCADE_COUNT];
uniform vec3 cameraPositionECEF;
uniform vec3 cameraDirection;
uniform vec3 altitudeCorrection;
uniform vec3 sunDirection;
uniform float exposure;
uniform float depthIsValid;
uniform float cameraNear;
uniform float shadowFar;
uniform float shadowTopHeight;
uniform float enableAerialPerspective;
uniform float aerialPerspectiveScale;
uniform float enableCloudShadow;
uniform float cloudShadowStrength;

in vec2 v_textureCoordinates;

vec3 tonemap(vec3 x) {
  vec3 c = vec3(1.0) - exp(-x);
  return pow(clamp(c, 0.0, 1.0), vec3(1.0 / 2.2));
}

// tonemap 的解析逆：把 Cesium 地表已渲染好的 LDR 终色抬回我们的 HDR 域，
// 以便与云、空气透视用同一套曝光/色调映射合成（近白像素 clamp 0.99 防止 log 爆值）。
vec3 inverseTonemap(vec3 c) {
  vec3 lin = pow(clamp(c, 0.0, 1.0), vec3(2.2));
  return -log(vec3(1.0) - min(lin, vec3(0.99))) / max(exposure, 1e-4);
}

// 沿射线重建场景（地表/3D Tiles）到相机的距离（米）；无有效深度返回 -1。
// 与 clouds.frag 的 getRayDistanceToScene 同一套 LOG_DEPTH 反解，帧间稳定。
float getRayDistanceToScene(const vec3 rayDir, const vec2 uv) {
  if (depthIsValid < 0.5) return -1.0;
  float packed = czm_unpackDepth(texture(depthBuffer, uv));
  if (packed <= 1e-7 || packed >= 1.0 - 1e-7) return -1.0;
#ifdef LOG_DEPTH
  float depthFromNear = exp2(packed * czm_log2FarDepthFromNearPlusOne) - 1.0;
  float viewZ = -(czm_currentFrustum.x + depthFromNear);
  return -viewZ / dot(rayDir, cameraDirection);
#else
  float d = czm_reverseLogDepth(packed);
  vec2 ndc = uv * 2.0 - 1.0;
  vec4 eye = czm_inverseProjection * vec4(ndc, d * 2.0 - 1.0, 1.0);
  eye /= eye.w;
  return length(eye.xyz);
#endif
}

// 深度失效（远处/瓦片空档）时，射线与底球面交点距离兜底（原点在大气坐标系，km）。
float raySphereNearDistance(const vec3 origin, const vec3 dir, float radius) {
  float b = dot(origin, dir);
  float c = dot(origin, origin) - radius * radius;
  float disc = b * b - c;
  if (disc < 0.0) return -1.0;
  return -b - sqrt(disc);
}

// 地面像素处的云投影阴影（BSM 光学深度 τ）。groundAtmoM/groundWorldM 分别是
// "大气坐标系"（ECEF+altitudeCorrection，供 raySphereSecondIntersection 与
// clouds.frag 的 getDistanceToShadowTop 同一约定）与"真实 ECEF"（供 shadowMatrices
// 投影，与 CascadedShadowMaps 的构建帧一致），单位均为米。首版单 tap，不做 PCF。
float raySphereSecondIntersection(const vec3 origin, const vec3 direction, const vec3 center, float radius) {
  vec3 a = origin - center;
  float b = 2.0 * dot(direction, a);
  float c = dot(a, a) - radius * radius;
  float discriminant = b * b - 4.0 * c;
  return discriminant < 0.0 ? -1.0 : (-b + sqrt(discriminant)) * 0.5;
}

float getGroundShadowOpticalDepth(const vec3 groundAtmoM, const vec3 groundWorldM) {
  float distanceToTop = raySphereSecondIntersection(
    groundAtmoM, sunDirection, vec3(0.0), BOTTOM_RADIUS_M + shadowTopHeight
  );
  if (distanceToTop <= 0.0) return 0.0;

  vec4 viewPosition = viewMatrix * vec4(groundWorldM, 1.0);
  float depth = (viewPosition.z + cameraNear) / (cameraNear - shadowFar); // viewZToOrthographicDepth

  int cascadeIndex = SHADOW_CASCADE_COUNT - 1;
  for (int i = 0; i < SHADOW_CASCADE_COUNT; ++i) {
    vec2 interval = shadowIntervals[i];
    if (depth >= interval.x && depth < interval.y) {
      cascadeIndex = i;
      break;
    }
  }

  vec4 clip = shadowMatrices[cascadeIndex] * vec4(groundWorldM, 1.0);
  clip /= clip.w;
  vec2 uv = clip.xy * 0.5 + 0.5;
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) return 0.0;

  // r: frontDepth, g: meanExtinction, b: maxOpticalDepth, a: maxOpticalDepthTail
  vec4 shadow = texture(
    shadowBuffer,
    vec3(uv, (float(cascadeIndex) + 0.5) / float(SHADOW_CASCADE_COUNT))
  );
  float distanceToFront = max(0.0, distanceToTop - shadow.r);
  return min(shadow.b + shadow.a, shadow.g * distanceToFront);
}

void main() {
  vec2 uv = v_textureCoordinates;
  vec2 ndc = uv * 2.0 - 1.0;

  vec3 viewPos = (inverseProjectionMatrix * vec4(ndc, 0.0, 1.0)).xyz;
  vec3 rayDir = normalize((inverseViewMatrix * vec4(viewPos, 0.0)).xyz);

  vec3 camPosKm = (cameraPositionECEF + altitudeCorrection) * METER_TO_LENGTH_UNIT;

  vec4 cloud = texture(cloudColorBuffer, uv); // 预乘 HDR，a = 1 - 透射率
  float sceneDepth = czm_unpackDepth(texture(depthBuffer, uv));
  // 天空/地面分支判定：
  //  1) 深度命中（depthIsValid 且 (eps,1-eps)）→ 地面（含高出地平线的山体）；
  //  2) 否则按几何：射线打到椭球（地平线以下）→ 地面，反之 → 天空。
  // 不单靠深度：缩放中瓦片加载空档会让地平线附近像素深度 0↔有效 逐帧跳变，
  // 单靠深度会在 天空(亮)/地面(暗) 分支间闪烁。几何判定是逐帧稳定的。
  bool groundByDepth =
    depthIsValid >= 0.5 && sceneDepth > 1e-6 && sceneDepth < 1.0 - 1e-6;
  float rr = dot(camPosKm, camPosKm);
  float mu = dot(camPosKm, rayDir) / sqrt(rr);
  bool hitsEllipsoid =
    mu < 0.0 &&
    rr * (mu * mu - 1.0) + ATMOSPHERE.bottom_radius * ATMOSPHERE.bottom_radius >= 0.0;
  bool isSky = !groundByDepth && !hitsEllipsoid;

  if (isSky) {
    vec3 trans;
    vec3 sky = GetSkyRadiance(camPosKm, rayDir, 0.0, sunDirection, trans);
    if (dot(rayDir, sunDirection) > cos(ATMOSPHERE.sun_angular_radius)) {
      sky += trans * GetSolarRadiance();
    }
    vec3 hdr = cloud.rgb + sky * (1.0 - cloud.a);
    out_FragColor = vec4(tonemap(hdr * exposure), 1.0);
    return;
  }

  vec3 sceneColor = texture(sceneColorBuffer, uv).rgb;
  vec3 hdrGround = inverseTonemap(sceneColor);

  if (enableAerialPerspective > 0.5 || enableCloudShadow > 0.5) {
    float distM = getRayDistanceToScene(rayDir, uv);
    float distKm = distM > 0.0 ? distM * METER_TO_LENGTH_UNIT : -1.0;
    if (distKm < 0.0) {
      distKm = raySphereNearDistance(camPosKm, rayDir, ATMOSPHERE.bottom_radius);
    }
    // 太近的地面（如相机贴地）跳过，避免 GetSkyRadianceToPoint/云影重建数值退化
    if (distKm > 0.05) {
      vec3 groundKm = camPosKm + rayDir * distKm;

      if (enableCloudShadow > 0.5) {
        vec3 groundAtmoM = groundKm / METER_TO_LENGTH_UNIT;
        vec3 groundWorldM = groundAtmoM - altitudeCorrection;
        float tau = getGroundShadowOpticalDepth(groundAtmoM, groundWorldM);
        float T = exp(-tau);
        vec3 geodeticNormal = normalize(groundKm);
        vec3 skyIrr;
        vec3 sunIrr = GetSunAndSkyIrradiance(groundKm, geodeticNormal, sunDirection, skyIrr);
        float lumSky = dot(skyIrr, vec3(0.2126, 0.7152, 0.0722));
        float lumSun = dot(sunIrr, vec3(0.2126, 0.7152, 0.0722));
        float f = (lumSky + lumSun * T) / max(lumSky + lumSun, 1e-6);
        hdrGround *= mix(1.0, f, cloudShadowStrength);
      }

      if (enableAerialPerspective > 0.5) {
        vec3 trans;
        vec3 inscatter = GetSkyRadianceToPoint(camPosKm, groundKm, 0.0, sunDirection, trans);
        hdrGround = hdrGround * trans + inscatter * aerialPerspectiveScale;
      }
    }
  }

  vec3 hdr = cloud.rgb + hdrGround * (1.0 - cloud.a);
  out_FragColor = vec4(tonemap(hdr * exposure), 1.0);
}
`;
}

export class CompositePass {
  constructor(
    context,
    cloudUniforms,
    atmo,
    { exposure = 10, logDepth = false } = {},
  ) {
    this._context = context;
    this._uniforms = cloudUniforms;
    this.exposure = exposure;
    this.enableAerialPerspective = true;
    this.aerialPerspectiveScale = 1;
    this.enableCloudShadow = true;
    this.cloudShadowStrength = 1;
    this._cloudColorTexture = null;
    this._sceneColorTexture = null;

    const identityMatrices = [
      Cesium.Matrix4.IDENTITY,
      Cesium.Matrix4.IDENTITY,
      Cesium.Matrix4.IDENTITY,
    ];
    const identityIntervals = [
      new Cesium.Cartesian2(0, 1),
      new Cesium.Cartesian2(0, 1),
      new Cesium.Cartesian2(0, 1),
    ];

    const s = cloudUniforms.state;
    this._pass = new ScreenSpacePass(context, {
      vertexShaderSource: COMPOSITE_VS,
      fragmentShaderSource: buildCompositeFS(logDepth),
      uniformMap: {
        cloudColorBuffer: () => this._cloudColorTexture,
        depthBuffer: () =>
          context.uniformState.globeDepthTexture ?? this._cloudColorTexture,
        sceneColorBuffer: () =>
          this._sceneColorTexture ?? this._cloudColorTexture,
        // BSM：与主 march 共享同一份（ShadowPass 每帧注入），未就绪时回退全零假纹理。
        shadowBuffer: () =>
          cloudUniforms.shadow?.texture ?? cloudUniforms._fakeShadow,
        // 数组 uniform 长度必须恒为 SHADOW_CASCADE_COUNT=3，否则编译期/运行期报错
        // （主 march 的单元素 fallback 只是因为它未用到，这里必须显式补齐 3 长度）。
        shadowMatrices: () =>
          cloudUniforms.shadow?.matrices ?? identityMatrices,
        shadowIntervals: () =>
          cloudUniforms.shadow?.intervals ?? identityIntervals,
        shadowFar: () => cloudUniforms.shadow?.far ?? 1e5,
        shadowTopHeight: () => cloudUniforms._updateLayers().shadowTopHeight,
        inverseViewMatrix: () => s.inverseViewMatrix,
        inverseProjectionMatrix: () => s.inverseProjectionMatrix,
        viewMatrix: () => s.viewMatrix,
        cameraPositionECEF: () => s.cameraPositionECEF,
        cameraDirection: () => s.cameraDirection,
        cameraNear: () => s.cameraNear,
        altitudeCorrection: () => s.altitudeCorrection,
        sunDirection: () => s.sunDirection,
        exposure: () => this.exposure,
        depthIsValid: () => s.depthIsValid,
        enableAerialPerspective: () =>
          this._sceneColorTexture && this.enableAerialPerspective ? 1 : 0,
        aerialPerspectiveScale: () => this.aerialPerspectiveScale,
        enableCloudShadow: () =>
          this._sceneColorTexture &&
          cloudUniforms.shadow &&
          this.enableCloudShadow
            ? 1
            : 0,
        cloudShadowStrength: () => this.cloudShadowStrength,
        ...atmosphereUniforms(atmo),
      },
    });
  }

  setCloudColorTexture(texture) {
    this._cloudColorTexture = texture;
  }

  /** 每帧 postRender 开头捕获的"云合成前"画布颜色；未捕获成功时地表空气透视自动关闭 */
  setSceneColorTexture(texture) {
    this._sceneColorTexture = texture;
  }

  execute() {
    const width = this._context.drawingBufferWidth;
    const height = this._context.drawingBufferHeight;
    // framebuffer=undefined → 默认帧缓冲（画布）；地面分支自行读取捕获的场景色重写，
    // 不再依赖 GPU alpha 混合，clear=false 但整屏重写。
    this._pass.execute(undefined, {
      width,
      height,
      clear: false,
      blending: false,
    });
  }

  destroy() {
    this._pass.destroy();
  }
}
