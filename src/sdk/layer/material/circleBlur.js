import * as Cesium from 'cesium'

export const CIRCLE_BLUR_MATERIAL_TYPE = 'BMapViewerCircleBlur'
export const CIRCLE_BLUR_SOURCE = /* glsl */ `
  czm_material czm_getMaterial(czm_materialInput materialInput) {
    czm_material material = czm_getDefaultMaterial(materialInput);
    float r = 0.5;
    if (breathing) {
      float phase = time * speed * 0.06 * czm_twoPi;
      r += (0.5 - 0.5 * cos(phase)) / 3.0;
    }
    float dis = distance(materialInput.st, vec2(0.5));
    float a = 1.0 - smoothstep(0.0, r, dis);
    material.alpha = pow(a, blur) * color.a;
    material.diffuse = color.rgb * a * brightness;
    return material;
  }
`

let registered = false
export function registerCircleBlurMaterial() {
  if (registered) return
  Cesium.Material._materialCache.addMaterial(CIRCLE_BLUR_MATERIAL_TYPE, {
    fabric: {
      type: CIRCLE_BLUR_MATERIAL_TYPE,
      uniforms: {
        color: Cesium.Color.fromCssColorString('#ff4d4f'),
        time: 0, speed: 3, breathing: false, blur: 10, brightness: 3,
      },
      source: CIRCLE_BLUR_SOURCE,
    },
    translucent: () => true,
  })
  registered = true
}

export class CircleBlurMaterialProperty {
  constructor(readOptions, readTime, isAnimating) {
    this._readOptions = readOptions
    this._readTime = readTime
    this._isAnimating = isAnimating
    this.definitionChanged = new Cesium.Event()
  }
  get isConstant() { return !this._isAnimating() }
  getType() { return CIRCLE_BLUR_MATERIAL_TYPE }
  getValue(_time, result = {}) {
    const options = this._readOptions()
    result.color = Cesium.Color.clone(options.color, result.color)
    result.time = options.breathing ? this._readTime() : 0
    for (const key of ['speed', 'breathing', 'blur', 'brightness']) result[key] = options[key]
    return result
  }
  equals(other) { return this === other }
}
