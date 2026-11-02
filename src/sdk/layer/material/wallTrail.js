import * as Cesium from 'cesium'

export const WALL_TRAIL_MATERIAL_TYPE = 'BMapViewerWallTrail'
export const WALL_TRAIL_IMAGE = new URL('../../assets/wall-fence.png', import.meta.url).href
export const WALL_TRAIL_SOURCE = /* glsl */ `
  czm_material czm_getMaterial(czm_materialInput materialInput) {
    czm_material material = czm_getDefaultMaterial(materialInput);
    float phase = fract(time * speed * 0.06);
    vec2 st = materialInput.st;
    vec4 colorImage = texture(image, vec2(fract(st.t * repeat - direction * phase), st.t));
    material.alpha = colorImage.a * color.a;
    material.diffuse = max(color.rgb * material.alpha * brightness, color.rgb);
    return material;
  }
`

let registered = false
export function registerWallTrailMaterial() {
  if (registered) return
  Cesium.Material._materialCache.addMaterial(WALL_TRAIL_MATERIAL_TYPE, {
    fabric: {
      type: WALL_TRAIL_MATERIAL_TYPE,
      uniforms: {
        color: Cesium.Color.fromCssColorString('#33cc66'), time: 0, speed: 3,
        direction: 1, repeat: 1, brightness: 3, image: WALL_TRAIL_IMAGE,
      },
      source: WALL_TRAIL_SOURCE,
    },
    translucent: () => true,
  })
  registered = true
}

/** 沿墙体高度循环采样栅栏纹理，使用图层时间以支持暂停和恢复。 */
export class WallTrailMaterialProperty {
  constructor(readOptions, readTime) {
    this._readOptions = readOptions
    this._readTime = readTime
    this.definitionChanged = new Cesium.Event()
  }
  get isConstant() { return false }
  getType() { return WALL_TRAIL_MATERIAL_TYPE }
  getValue(_time, result = {}) {
    const options = this._readOptions()
    result.color = Cesium.Color.clone(options.color, result.color)
    result.time = this._readTime()
    for (const key of ['speed', 'repeat', 'brightness', 'image']) result[key] = options[key]
    result.direction = options.direction === 'up' ? 1 : -1
    return result
  }
  equals(other) { return this === other }
}
