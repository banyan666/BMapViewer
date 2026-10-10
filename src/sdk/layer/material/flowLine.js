import * as Cesium from 'cesium'

export const FLOW_LINE_MATERIAL_TYPE = 'BMapViewerFlowLine'
let registered = false

/** 流动线材质：沿线纹理坐标推进渐变光段，并提供增强脉冲效果。 */
export function registerFlowLineMaterial() {
  if (registered) return

  Cesium.Material._materialCache.addMaterial(FLOW_LINE_MATERIAL_TYPE, {
    fabric: {
      type: FLOW_LINE_MATERIAL_TYPE,
      uniforms: {
        color: new Cesium.Color(0.7, 1, 0.2, 0.8),
        time: 0,
        speed: 5,
        percent: 0.15,
        gradient: 0.4,
        pulse: 0.5,
        enhanced: 0,
        backgroundAlpha: 0.8,
        brightness: 1,
        glowStrength: 1.5,
        glowColor: Cesium.Color.fromCssColorString('#00e7ff'),
      },
      source: /* glsl */ `
        czm_material czm_getMaterial(czm_materialInput materialInput) {
          czm_material material = czm_getDefaultMaterial(materialInput);
          // Match the reference speed at 60 FPS, using elapsed seconds instead of frame count.
          float phase = time * speed * 0.06;
          float travelSign = speed < 0.0 ? -1.0 : 1.0;
          float currentPos = fract(travelSign * (phase - materialInput.st.s));
          float pulseEffect = 1.0 + enhanced * 0.2 * sin(phase * 3.14159265 * pulse);
          float trailLength = clamp(percent * pulseEffect, 0.001, 1.0);
          float feather = max(trailLength * gradient, 0.0001);
          // Keep smoothstep edges increasing; reversed edges in GLSL are undefined.
          float trail = 1.0 - smoothstep(trailLength - feather, trailLength, currentPos);
          float glow = trail * (1.0 - smoothstep(0.0, trailLength, currentPos));
          float edge = smoothstep(0.4, 0.5, abs(materialInput.st.t - 0.5));
          float edgeGlow = enhanced * edge * trail * 0.5;

          // Add emissive energy to the moving section above the visible base line.
          // Keep the glow color independent of brightness instead of clipping the emissive gain.
          material.diffuse = vec3(0.0);
          material.alpha = mix(backgroundAlpha, 1.0, trail) * color.a;
          material.emission = brightness * (
            color.rgb + glowColor.rgb * glowColor.a * glowStrength * (glow + edgeGlow)
          );
          return material;
        }
      `,
    },
    translucent: () => true,
  })
  registered = true
}
