import * as Cesium from 'cesium'

export const LINE_LIGHTING_TRAIL_TYPE = 'BMapViewerLineLightingTrail'
export const LINE_LIGHTING_TRAIL_IMAGE = new URL('../../assets/lighting.png', import.meta.url).href
export const LINE_LIGHTING_TRAIL_SOURCE = /* glsl */ `
  czm_material czm_getMaterial(czm_materialInput materialInput) {
    czm_material material = czm_getDefaultMaterial(materialInput);
    vec2 st = materialInput.st;
    float phase = fract(time * speed * 0.06);
    vec4 colorImage = texture(image, st);
    vec3 fragColor = color.rgb;
    if (st.t > 0.45 && st.t < 0.55) {
      fragColor = vec3(1.0);
    }
    material.alpha = colorImage.a * color.a * 1.5
      * smoothstep(0.0, 1.0, fract(st.s - direction * phase));
    material.diffuse = max(fragColor * material.alpha, fragColor);
    return material;
  }
`

let registered = false
export function registerLineLightingTrailMaterial() {
  if (registered) return
  Cesium.Material._materialCache.addMaterial(LINE_LIGHTING_TRAIL_TYPE, {
    fabric: {
      type: LINE_LIGHTING_TRAIL_TYPE,
      uniforms: {
        color: Cesium.Color.fromCssColorString('#ffcc33'),
        image: LINE_LIGHTING_TRAIL_IMAGE, time: 0, speed: 5, direction: 1,
      },
      source: LINE_LIGHTING_TRAIL_SOURCE,
    },
    translucent: () => true,
  })
  registered = true
}

export class LineLightingTrailMaterialProperty {
  constructor(readOptions, readTime, isAnimating) {
    this._readOptions = readOptions
    this._readTime = readTime
    this._isAnimating = isAnimating
    this.definitionChanged = new Cesium.Event()
  }
  get isConstant() { return !this._isAnimating() }
  getType() { return LINE_LIGHTING_TRAIL_TYPE }
  getValue(_time, result = {}) {
    const options = this._readOptions()
    result.color = Cesium.Color.clone(options.color, result.color)
    result.time = this._readTime()
    result.image = options.image
    result.speed = options.speed
    result.direction = options.direction === 'forward' ? 1 : -1
    return result
  }
  equals(other) { return this === other }
}
