import * as Cesium from 'cesium'

export const DIFFUSE_WALL_MATERIAL_TYPE = 'BMapViewerDiffuseWall'
export const DIFFUSE_WALL_SOURCE = /* glsl */ `
  czm_material czm_getMaterial(czm_materialInput materialInput) {
    czm_material material = czm_getDefaultMaterial(materialInput);
    material.diffuse = color.rgb * 2.0;
    material.alpha = color.a * (1.0 - clamp(materialInput.st.t, 0.0, 1.0)) * 0.8;
    return material;
  }
`

let registered = false
export function createDiffuseWallMaterial(color) {
  if (!registered) {
    Cesium.Material._materialCache.addMaterial(DIFFUSE_WALL_MATERIAL_TYPE, {
      fabric: {
        type: DIFFUSE_WALL_MATERIAL_TYPE,
        uniforms: { color: Cesium.Color.fromCssColorString('#ff4455') },
        source: DIFFUSE_WALL_SOURCE,
      },
      translucent: () => true,
    })
    registered = true
  }
  return Cesium.Material.fromType(DIFFUSE_WALL_MATERIAL_TYPE, { color: Cesium.Color.clone(color) })
}

/** 开口圆筒侧面；半径与高度分别通过模型矩阵缩放。 */
export function createDiffuseWallGeometry(slices) {
  const positions = new Float64Array((slices + 1) * 6)
  const normals = new Float32Array(positions.length)
  const st = new Float32Array((slices + 1) * 4)
  const indices = new Uint16Array(slices * 6)
  for (let index = 0; index <= slices; index++) {
    const angle = index / slices * Cesium.Math.TWO_PI
    const x = Math.cos(angle), y = Math.sin(angle)
    positions.set([x, y, 0, x, y, 1], index * 6)
    normals.set([x, y, 0, x, y, 0], index * 6)
    st.set([index / slices, 0, index / slices, 1], index * 4)
    if (index < slices) {
      const bottom = index * 2
      indices.set([bottom, bottom + 2, bottom + 1, bottom + 1, bottom + 2, bottom + 3], index * 6)
    }
  }
  return new Cesium.Geometry({
    attributes: {
      position: new Cesium.GeometryAttribute({ componentDatatype: Cesium.ComponentDatatype.DOUBLE, componentsPerAttribute: 3, values: positions }),
      normal: new Cesium.GeometryAttribute({ componentDatatype: Cesium.ComponentDatatype.FLOAT, componentsPerAttribute: 3, values: normals }),
      st: new Cesium.GeometryAttribute({ componentDatatype: Cesium.ComponentDatatype.FLOAT, componentsPerAttribute: 2, values: st }),
    },
    indices,
    primitiveType: Cesium.PrimitiveType.TRIANGLES,
    boundingSphere: Cesium.BoundingSphere.fromVertices(positions),
  })
}
