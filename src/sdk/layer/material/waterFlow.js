export const WATER_FLOW_VERTEX_SHADER = /* glsl */ `
  in vec3 position3DHigh;
  in vec3 position3DLow;
  in vec3 normal;
  in vec2 st;
  in float batchId;
  out vec3 v_positionEC;
  out vec3 v_normalEC;
  out vec3 v_eastEC;
  out vec3 v_northEC;
  out vec2 v_st;
  void main() {
    vec4 p = czm_modelViewRelativeToEye * czm_translateRelativeToEye(position3DHigh, position3DLow);
    vec3 east = normalize(vec3(-normal.y, normal.x, 0.0));
    vec3 north = normalize(cross(normal, east));
    v_positionEC = p.xyz;
    v_normalEC = normalize(czm_normal * normal);
    v_eastEC = normalize(czm_normal * east);
    v_northEC = normalize(czm_normal * north);
    v_st = st;
    gl_Position = czm_projection * p;
  }
`

// 材质函数与纹理使用同一套地理 UV，水纹按米尺度生成。
export const WATER_FLOW_MATERIAL_SOURCE = /* glsl */ `
  float riverHash(float p) {
    vec2 p2 = fract(vec2(p) * vec2(4.438975, 3.972973));
    p2 += dot(p2.yx, p2.xy + 19.19);
    return fract(p2.x * p2.y);
  }
  vec2 riverHash2(float p) {
    vec3 p3 = fract(vec3(p) * vec3(0.1031, 0.1030, 0.0973));
    p3 += dot(p3, p3.yzx + 19.19);
    return fract((p3.xx + p3.yz) * p3.zy);
  }
  vec3 riverNoise(vec2 p) {
    vec2 cell = floor(p), f = fract(p);
    float n = cell.x + cell.y * 57.0;
    float a = riverHash(n), b = riverHash(n + 1.0), c = riverHash(n + 57.0), d = riverHash(n + 58.0);
    vec2 s = f * f * (3.0 - 2.0 * f), ds = 6.0 * f * (1.0 - f);
    float mixed = a - b + d - c;
    return vec3((b - a + mixed * s.y) * ds.x,
                (c - a + mixed * s.x) * ds.y,
                a + (b - a) * s.x + (c - a) * s.y + mixed * s.x * s.y);
  }
  vec3 riverFBM(vec2 p, vec2 flow, float persistence, float distortion) {
    vec3 result = vec3(0.0);
    float weight = 1.0, total = 0.0;
    for (int i = 0; i < 3; i++) {
      p += flow; flow *= -0.75;
      vec3 sampleValue = riverNoise(p);
      result += sampleValue * weight;
      p = (p + sampleValue.xy * distortion) * 2.0;
      total += weight; weight *= persistence;
    }
    return result / total;
  }
  vec3 riverFlow(vec2 uv, vec2 st, float shore) {
    vec3 encoded = texture(u_flowTexture, st).rgb;
    vec2 flow = encoded.xy * 2.0 - 1.0;
    if (length(flow) > 0.05) flow = normalize(flow) * u_flowMultiplier;
    else flow = vec2(0.0);
    float depthWeight = pow(max(1.0 - shore, 0.0), 1.0 / 7.0 + 2.0 / 3.0);
    flow *= depthWeight * encoded.z * 2.0;
    flow += riverNoise(uv * 0.2).xy * 0.3;
    float foam = length(flow) * 0.5;
    foam += clamp(foam - 0.4, 0.0, 1.0);
    return vec3(flow * 0.6, foam);
  }
  vec4 riverNormal(vec2 uv, vec2 offset, float magnitude, float foam) {
    vec2 derivative = max(abs(dFdx(uv)), abs(dFdy(uv)));
    float footprint = max(derivative.x, derivative.y);
    float detail = max(0.62, 1.0 / (1.0 + footprint * footprint * 600.0));
    vec3 noiseValue = riverFBM(uv * 20.0, offset * 20.0, 0.75 + foam * 0.25, 0.25 - foam * 1.5);
    detail *= max(0.45, 1.0 - foam * 5.0);
    vec3 n = mix(vec3(0.0, 1.0, 0.0), normalize(vec3(noiseValue.x, magnitude, noiseValue.y)), detail);
    return vec4(normalize(n), noiseValue.z * detail);
  }
  float riverFoam(vec2 uv, vec2 offset) {
    float f = riverFBM(uv * 30.0, offset * 50.0, 0.8, -0.5).z;
    return pow(0.5, max(0.0, (f - 0.2) / 0.2));
  }
  vec4 riverFlowingNormal(vec2 uv, vec2 flow, float foam, float time, out float foamTexture) {
    float magnitude = 2.5 / (1.0 + dot(flow, flow) * 5.0);
    float t0 = fract(time), t1 = fract(time + 0.5);
    vec2 uv0 = uv + riverHash2(floor(time)), uv1 = uv + riverHash2(floor(time + 0.5));
    vec2 offset0 = -flow * (t0 - 0.5), offset1 = -flow * (t1 - 0.5);
    float weight = abs(t0 - 0.5) * 2.0;
    vec4 result = mix(riverNormal(uv0, offset0, magnitude, foam), riverNormal(uv1, offset1, magnitude, foam), weight);
    result.xyz = normalize(result.xyz);
    foamTexture = mix(riverFoam(uv0, offset0 * 0.25), riverFoam(uv1, offset1 * 0.25), weight);
    return result;
  }
  float riverFilteredShininess(vec3 normal, float shininess, out float energy) {
    vec3 dx = dFdx(normal), dy = dFdy(normal);
    float variance = 0.25 * (dot(dx, dx) + dot(dy, dy));
    float roughness = 2.0 / (shininess + 2.0);
    float filtered = clamp(roughness + min(2.0 * variance * u_specularAA, 0.18), 0.0001, 1.0);
    float result = max(2.0 / filtered - 2.0, 1.0);
    energy = (result + 2.0) / (shininess + 2.0);
    return result;
  }
  vec4 riverSurface(vec2 st, vec3 positionEC, vec3 normalEC, vec3 eastEC, vec3 northEC) {
    vec2 uv = (st - 0.5) * u_uvScale;
    float shore = texture(u_shoreTexture, st).r;
    float shoreMask = pow(shore, 1.0 / max(u_shoreWidth, 0.01));
    shoreMask *= 0.5 + 0.5 * riverFBM(uv * 15.0, vec2(0.0), 0.6, 0.0).z;
    vec3 flowAndFoam = riverFlow(uv, st, shore);
    float foam = clamp((flowAndFoam.z - u_foamOffset) * u_foamScale, 0.0, 1.0);
    foam *= pow(shoreMask, 0.8); foam = foam * foam * 0.5;
    float foamTexture;
    vec3 localNormal = riverFlowingNormal(uv, flowAndFoam.xy, foam, u_time * u_speed, foamTexture).xyz;
    vec3 n = normalize(normalEC), viewDir = normalize(-positionEC), lightDir = normalize(czm_sunDirectionEC);
    float nDotV = max(dot(n, viewDir), 0.0);
    float distanceFade = clamp(1.0 - max(length(positionEC) - 15000.0, 0.0) / 25000.0, 0.88, 1.0);
    localNormal.xz *= distanceFade * mix(1.55, 1.0, smoothstep(0.08, 0.42, nDotV));
    localNormal = normalize(localNormal);
    vec3 finalNormal = normalize(localNormal.x * normalize(eastEC) + localNormal.z * normalize(northEC) + localNormal.y * n);
    vec3 baseColor = mix(u_deepColor.rgb, u_shallowColor.rgb, shoreMask);
    float fresnel = pow(1.0 - nDotV, u_fresnelPower) * u_fresnelIntensity;
    fresnel *= mix(0.35, 1.0, pow(clamp(nDotV, 0.0, 1.0), 0.55));
    vec3 reflectColor = mix(baseColor * 1.1, u_skyColor.rgb, 0.35);
    vec3 color = mix(baseColor, reflectColor, fresnel);
    color *= 0.86 + 0.14 * max(dot(finalNormal, lightDir), 0.0) + 0.06 * max(dot(finalNormal, viewDir), 0.0);
    float sunEnergy, ambientEnergy;
    float sunShininess = riverFilteredShininess(finalNormal, u_specularShininess, sunEnergy);
    float ambientShininess = riverFilteredShininess(finalNormal, u_specularShininess * 0.55, ambientEnergy);
    float spec = pow(max(dot(finalNormal, normalize(lightDir + viewDir)), 0.0), sunShininess) * sunEnergy;
    float ambientSpec = pow(max(dot(finalNormal, normalize(n + viewDir)), 0.0), ambientShininess) * ambientEnergy;
    color += spec * u_specularColor.rgb * u_specularIntensity * mix(1.5, 1.0, smoothstep(0.12, 0.5, nDotV));
    color += ambientSpec * u_specularColor.rgb * u_specularIntensity * 0.32;
    float foamBlend = clamp(1.0 - pow(foamTexture, foam * 5.0), 0.0, 1.0);
    vec3 foamColor = vec3(0.9, 0.95, 1.0) * max(dot(finalNormal, lightDir), 0.45);
    color = mix(color, foamColor, foamBlend);
    color = color * (0.010 * color + 0.132) / (color * (0.010 * color + 0.163) + 0.101);
    color *= u_exposure;
    float alpha = 1.0 - pow(shoreMask, 2.2);
    alpha = mix(alpha, max(alpha, 0.8), fresnel * 0.3);
    alpha += spec * u_specularIntensity * 0.75 + ambientSpec * u_specularIntensity * 0.28;
    alpha = mix(alpha, 1.0, foamBlend);
    return vec4(mix(color, color * 1.4, shoreMask * 0.4), clamp(alpha, 0.0, 1.0) * u_opacity);
  }
  czm_material czm_getMaterial(czm_materialInput materialInput) {
    return czm_getDefaultMaterial(materialInput);
  }
`

export const WATER_FLOW_FRAGMENT_SHADER = /* glsl */ `
  in vec3 v_positionEC;
  in vec3 v_normalEC;
  in vec3 v_eastEC;
  in vec3 v_northEC;
  in vec2 v_st;
  void main() {
    out_FragColor = riverSurface(v_st, v_positionEC, v_normalEC, v_eastEC, v_northEC);
  }
`
