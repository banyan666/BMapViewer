import * as Cesium from "cesium";

// 忠实移植 three-geospatial 的 CascadedShadowMaps + FrustumCorners + splitFrustum。
// Cesium.Matrix4 与 three 同为列主序、索引 0..15 一致，故 lookAt/makeOrthographic/
// setPosition/applyMatrix4 按 three 的元素写法直接移植。
// 工作空间：ECEF（Cesium 世界系）。

const UP = new Cesium.Cartesian3(0, 1, 0); // three Object3D.DEFAULT_UP

const C3 = () => new Cesium.Cartesian3();

// v' = M * v（含透视除法），M 为 Cesium.Matrix4（列主序索引）
function applyMat4(v, m, out) {
  const x = v.x,
    y = v.y,
    z = v.z;
  const w = 1 / (m[3] * x + m[7] * y + m[11] * z + m[15]);
  out.x = (m[0] * x + m[4] * y + m[8] * z + m[12]) * w;
  out.y = (m[1] * x + m[5] * y + m[9] * z + m[13]) * w;
  out.z = (m[2] * x + m[6] * y + m[10] * z + m[14]) * w;
  return out;
}

// three Matrix4.lookAt：仅写旋转部分（列 = right/up/-forward），基于给定 eye/target/up
const _z = C3(),
  _x = C3(),
  _y = C3();
function matLookAtRotation(m, eye, target, up) {
  Cesium.Cartesian3.subtract(eye, target, _z);
  if (Cesium.Cartesian3.magnitudeSquared(_z) === 0) _z.z = 1;
  Cesium.Cartesian3.normalize(_z, _z);
  Cesium.Cartesian3.cross(up, _z, _x);
  if (Cesium.Cartesian3.magnitudeSquared(_x) === 0) {
    _z.z += 0.0001;
    Cesium.Cartesian3.normalize(_z, _z);
    Cesium.Cartesian3.cross(up, _z, _x);
  }
  Cesium.Cartesian3.normalize(_x, _x);
  Cesium.Cartesian3.cross(_z, _x, _y);
  m[0] = _x.x;
  m[4] = _y.x;
  m[8] = _z.x;
  m[1] = _x.y;
  m[5] = _y.y;
  m[9] = _z.y;
  m[2] = _x.z;
  m[6] = _y.z;
  m[10] = _z.z;
  m[3] = 0;
  m[7] = 0;
  m[11] = 0;
  m[15] = 1;
  // 平移列保持（默认 0）
  return m;
}

function matSetPosition(m, v) {
  m[12] = v.x;
  m[13] = v.y;
  m[14] = v.z;
  return m;
}

// three Matrix4.makeOrthographic（WebGL NDC z∈[-1,1]）
function matOrthographic(m, left, right, top, bottom, near, far) {
  const w = 1 / (right - left);
  const h = 1 / (top - bottom);
  const p = 1 / (far - near);
  const x = (right + left) * w;
  const y = (top + bottom) * h;
  const z = (far + near) * p;
  const zInv = -2 * p;
  m[0] = 2 * w;
  m[4] = 0;
  m[8] = 0;
  m[12] = -x;
  m[1] = 0;
  m[5] = 2 * h;
  m[9] = 0;
  m[13] = -y;
  m[2] = 0;
  m[6] = 0;
  m[10] = zInv;
  m[14] = -z;
  m[3] = 0;
  m[7] = 0;
  m[11] = 0;
  m[15] = 1;
  return m;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function splitFrustum(count, near, far, lambda, result) {
  for (let i = 0; i < count; ++i) {
    const uniform = (near + ((far - near) * (i + 1)) / count) / far;
    const log = (near * (far / near) ** ((i + 1) / count)) / far;
    result[i] = lerp(uniform, log, lambda);
  }
  result.length = count;
  return result;
}

// 视锥 8 角点（near/far 各 4），near/far 为 Cartesian3[4]
class FrustumCorners {
  constructor() {
    this.near = [C3(), C3(), C3(), C3()];
    this.far = [C3(), C3(), C3(), C3()];
  }
  copy(o) {
    for (let i = 0; i < 4; ++i) {
      Cesium.Cartesian3.clone(o.near[i], this.near[i]);
      Cesium.Cartesian3.clone(o.far[i], this.far[i]);
    }
    return this;
  }
  setFromCamera(invProj, far) {
    const nc = [
      [1, 1, -1],
      [1, -1, -1],
      [-1, -1, -1],
      [-1, 1, -1],
    ];
    const fc = [
      [1, 1, 1],
      [1, -1, 1],
      [-1, -1, 1],
      [-1, 1, 1],
    ];
    for (let i = 0; i < 4; ++i) {
      this.near[i].x = nc[i][0];
      this.near[i].y = nc[i][1];
      this.near[i].z = nc[i][2];
      applyMat4(this.near[i], invProj, this.near[i]);
    }
    for (let i = 0; i < 4; ++i) {
      const c = this.far[i];
      c.x = fc[i][0];
      c.y = fc[i][1];
      c.z = fc[i][2];
      applyMat4(c, invProj, c);
      const absZ = Math.abs(c.z);
      const s = Math.min(far / absZ, 1);
      c.x *= s;
      c.y *= s;
      c.z *= s;
    }
    return this;
  }
  split(clipDepths, result) {
    for (let index = 0; index < clipDepths.length; ++index) {
      const f = (result[index] ??= new FrustumCorners());
      if (index === 0) {
        for (let i = 0; i < 4; ++i)
          Cesium.Cartesian3.clone(this.near[i], f.near[i]);
      } else {
        for (let i = 0; i < 4; ++i)
          Cesium.Cartesian3.lerp(
            this.near[i],
            this.far[i],
            clipDepths[index - 1],
            f.near[i],
          );
      }
      if (index === clipDepths.length - 1) {
        for (let i = 0; i < 4; ++i)
          Cesium.Cartesian3.clone(this.far[i], f.far[i]);
      } else {
        for (let i = 0; i < 4; ++i)
          Cesium.Cartesian3.lerp(
            this.near[i],
            this.far[i],
            clipDepths[index],
            f.far[i],
          );
      }
    }
    result.length = clipDepths.length;
    return result;
  }
  applyMatrix4(m) {
    for (let i = 0; i < 4; ++i) {
      applyMat4(this.near[i], m, this.near[i]);
      applyMat4(this.far[i], m, this.far[i]);
    }
    return this;
  }
}

export class CascadedShadowMaps {
  constructor({
    cascadeCount = 3,
    mapSize = 512,
    maxFar = 1e5,
    splitLambda = 0.6,
    margin = 0,
    fade = true,
  } = {}) {
    this.cascadeCount = cascadeCount;
    this.mapSize = mapSize;
    this.maxFar = maxFar;
    this.farScale = 1;
    this.splitLambda = splitLambda;
    this.margin = margin;
    this.fade = fade;
    this._far = 0;

    this.cascades = [];
    for (let i = 0; i < cascadeCount; ++i) {
      this.cascades.push({
        interval: new Cesium.Cartesian2(),
        matrix: new Cesium.Matrix4(),
        inverseMatrix: new Cesium.Matrix4(),
        projectionMatrix: new Cesium.Matrix4(),
        inverseProjectionMatrix: new Cesium.Matrix4(),
        viewMatrix: new Cesium.Matrix4(),
        inverseViewMatrix: new Cesium.Matrix4(),
      });
    }
    this._cameraFrustum = new FrustumCorners();
    this._frusta = [];
    this._splits = [];
    this._frustumScratch = new FrustumCorners();
    this._invProj = new Cesium.Matrix4();
    this._lightOrient = new Cesium.Matrix4();
    this._cameraToLight = new Cesium.Matrix4();
    this._v1 = C3();
    this._v2 = C3();
  }

  get far() {
    return this._far;
  }

  _getFrustumRadius(cameraNear, frustum) {
    const fc = frustum.far;
    const nc = frustum.near;
    let diag = Math.max(
      Cesium.Cartesian3.distance(fc[0], fc[2]),
      Cesium.Cartesian3.distance(fc[0], nc[2]),
    );
    if (this.fade) {
      const near = cameraNear;
      const far = this._far;
      const distance = fc[0].z / (far - near);
      diag += 0.25 * distance * distance * (far - near);
    }
    return diag * 0.5;
  }

  /**
   * @param {Cesium.Camera} camera
   * @param {Cesium.Cartesian3} sunDirection ECEF 单位向量（指向太阳）
   * @param {number} distance
   */
  update(camera, sunDirection, distance = 1) {
    const cameraNear = camera.frustum.near;
    this._far =
      this.maxFar != null
        ? Math.min(this.maxFar, camera.frustum.far * this.farScale)
        : camera.frustum.far * this.farScale;

    // intervals
    splitFrustum(
      this.cascadeCount,
      cameraNear,
      this._far,
      this.splitLambda,
      this._splits,
    );
    Cesium.Matrix4.inverse(camera.frustum.projectionMatrix, this._invProj);
    this._cameraFrustum.setFromCamera(this._invProj, this._far);
    this._cameraFrustum.split(this._splits, this._frusta);
    for (let i = 0; i < this.cascadeCount; ++i) {
      this.cascades[i].interval.x = this._splits[i - 1] ?? 0;
      this.cascades[i].interval.y = this._splits[i] ?? 0;
    }

    // 光朝向矩阵（仅旋转）：eye=0，target=-sunDir
    Cesium.Cartesian3.multiplyByScalar(sunDirection, -1, this._v2);
    Cesium.Matrix4.clone(Cesium.Matrix4.IDENTITY, this._lightOrient);
    matLookAtRotation(this._lightOrient, Cesium.Cartesian3.ZERO, this._v2, UP);
    // cameraToLight = inverse(lightOrient) * camera.matrixWorld(=inverseViewMatrix)
    const invLight = Cesium.Matrix4.inverse(
      this._lightOrient,
      new Cesium.Matrix4(),
    );
    Cesium.Matrix4.multiply(
      invLight,
      camera.inverseViewMatrix,
      this._cameraToLight,
    );

    const margin = this.margin;
    const mapSize = this.mapSize;

    for (let i = 0; i < this.cascadeCount; ++i) {
      const frustum = this._frusta[i];
      const cascade = this.cascades[i];

      const radius = this._getFrustumRadius(cameraNear, frustum);
      const left = -radius,
        right = radius,
        top = radius,
        bottom = -radius;
      matOrthographic(
        cascade.projectionMatrix,
        left,
        right,
        top,
        bottom,
        -margin,
        radius * 2 + margin,
      );

      // frustum → light space，求包围盒
      this._frustumScratch.copy(frustum).applyMatrix4(this._cameraToLight);
      let minX = Infinity,
        minY = Infinity,
        minZ = Infinity;
      let maxX = -Infinity,
        maxY = -Infinity,
        maxZ = -Infinity;
      const acc = (p) => {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.z < minZ) minZ = p.z;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
        if (p.z > maxZ) maxZ = p.z;
      };
      for (let j = 0; j < 4; ++j) {
        acc(this._frustumScratch.near[j]);
        acc(this._frustumScratch.far[j]);
      }
      const center = this._v1;
      center.x = (minX + maxX) * 0.5;
      center.y = (minY + maxY) * 0.5;
      center.z = maxZ + margin;

      // 平移量圆整到纹素（消抖）
      const texelW = (right - left) / mapSize;
      const texelH = (top - bottom) / mapSize;
      center.x = Math.round(center.x / texelW) * texelW;
      center.y = Math.round(center.y / texelH) * texelH;

      // center 回世界空间
      applyMat4Rotation(center, this._lightOrient, center);
      const position = this._v2;
      Cesium.Cartesian3.multiplyByScalar(sunDirection, distance, position);
      Cesium.Cartesian3.add(position, center, position);

      Cesium.Matrix4.clone(Cesium.Matrix4.IDENTITY, cascade.inverseViewMatrix);
      matLookAtRotation(cascade.inverseViewMatrix, center, position, UP);
      matSetPosition(cascade.inverseViewMatrix, position);
    }

    for (let i = 0; i < this.cascadeCount; ++i) {
      const c = this.cascades[i];
      Cesium.Matrix4.inverse(c.projectionMatrix, c.inverseProjectionMatrix);
      Cesium.Matrix4.inverse(c.inverseViewMatrix, c.viewMatrix);
      Cesium.Matrix4.multiply(c.projectionMatrix, c.viewMatrix, c.matrix);
      Cesium.Matrix4.multiply(
        c.inverseViewMatrix,
        c.inverseProjectionMatrix,
        c.inverseMatrix,
      );
    }
  }
}

// 仅旋转变换（无平移、无透视除法），用于 center 从光空间回世界
function applyMat4Rotation(v, m, out) {
  const x = v.x,
    y = v.y,
    z = v.z;
  out.x = m[0] * x + m[4] * y + m[8] * z;
  out.y = m[1] * x + m[5] * y + m[9] * z;
  out.z = m[2] * x + m[6] * y + m[10] * z;
  return out;
}
