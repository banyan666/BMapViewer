/* eslint-disable no-restricted-globals */
/**
 * 噪声烘焙 Worker —— 忠实移植 three-geospatial 的 Perlin-Worley 算法（CPU 版）。
 * 对齐参考：
 *   tileableNoise.glsl  (getWorleyNoise / getPerlinNoise)
 *   perlin.glsl         (梯度 Perlin，周期可平铺)
 *   cloudShape.frag     (getPerlinWorley / getWorleyFbm → shape R)
 *   cloudShapeDetail.frag(worley FBM → detail R)
 *
 * 与参考差异：参考用 `sin` 哈希（GPU），CPU 上换成快速整数哈希以控生成耗时；
 * 数学结构（频率、cell 数、FBM 权重、remap）完全一致。
 * 只烘焙被采样的 R 通道（参考 shader 也只采样 .r）。
 */

// ── 通用 ──────────────────────────────────────────────────────────────────────
function fract(v) {
  return v - Math.floor(v);
}
function lerp(a, b, t) {
  return a + (b - a) * t;
}
function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
function remap(x, a, b, c, d) {
  return c + ((x - a) / Math.max(1e-5, b - a)) * (d - c);
}

// ── 梯度 Perlin（周期 rep，整数频率保证 [0,1] 域无缝平铺）─────────────────────
const PERM = (() => {
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  let seed = 1973;
  const rnd = () => {
    seed = (Math.imul(seed, 1103515245) + 12345) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 255; i > 0; i--) {
    const j = (rnd() * (i + 1)) | 0;
    const t = p[i];
    p[i] = p[j];
    p[j] = t;
  }
  const perm = new Uint8Array(512);
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  return perm;
})();
function fade(t) {
  return t * t * t * (t * (t * 6 - 15) + 10);
}
function grad3(h, x, y, z) {
  h = h & 15;
  const u = h < 8 ? x : y;
  const v = h < 4 ? y : h === 12 || h === 14 ? x : z;
  return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
}
function perlin3(x, y, z, rep) {
  const xi = Math.floor(x),
    yi = Math.floor(y),
    zi = Math.floor(z);
  const xf = x - xi,
    yf = y - yi,
    zf = z - zi;
  const u = fade(xf),
    v = fade(yf),
    w = fade(zf);
  const wr = (n) => {
    n = n % rep;
    return n < 0 ? n + rep : n;
  };
  const X = wr(xi),
    Xp = wr(xi + 1),
    Y = wr(yi),
    Yp = wr(yi + 1),
    Z = wr(zi),
    Zp = wr(zi + 1);
  const g = (ix, iy, iz) => PERM[(PERM[(PERM[ix] + iy) & 511] + iz) & 511];
  const n000 = grad3(g(X, Y, Z), xf, yf, zf),
    n100 = grad3(g(Xp, Y, Z), xf - 1, yf, zf);
  const n010 = grad3(g(X, Yp, Z), xf, yf - 1, zf),
    n110 = grad3(g(Xp, Yp, Z), xf - 1, yf - 1, zf);
  const n001 = grad3(g(X, Y, Zp), xf, yf, zf - 1),
    n101 = grad3(g(Xp, Y, Zp), xf - 1, yf, zf - 1);
  const n011 = grad3(g(X, Yp, Zp), xf, yf - 1, zf - 1),
    n111 = grad3(g(Xp, Yp, Zp), xf - 1, yf - 1, zf - 1);
  const x00 = lerp(n000, n100, u),
    x10 = lerp(n010, n110, u);
  const x01 = lerp(n001, n101, u),
    x11 = lerp(n011, n111, u);
  return lerp(lerp(x00, x10, v), lerp(x01, x11, v), w);
}
function perlinFbm3(x, y, z, baseFreq, octaves) {
  let sum = 0,
    weight = 1,
    wsum = 0,
    freq = baseFreq;
  for (let i = 0; i < octaves; i++) {
    sum += perlin3(x * freq, y * freq, z * freq, freq) * weight;
    wsum += weight;
    weight *= 0.5;
    freq *= 2;
  }
  return sum / wsum;
}

// ── 值噪声（worley 特征点偏移用，对齐参考 noise()）────────────────────────────
function vhash(n) {
  let h = (n | 0) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 3266489917) >>> 0;
  h = (h ^ (h >>> 16)) >>> 0;
  return h / 4294967296;
}
function vnoise3(x, y, z) {
  const px = Math.floor(x),
    py = Math.floor(y),
    pz = Math.floor(z);
  let fx = x - px,
    fy = y - py,
    fz = z - pz;
  fx = fx * fx * (3 - 2 * fx);
  fy = fy * fy * (3 - 2 * fy);
  fz = fz * fz * (3 - 2 * fz);
  const n = px + py * 57 + 113 * pz;
  return lerp(
    lerp(
      lerp(vhash(n), vhash(n + 1), fx),
      lerp(vhash(n + 57), vhash(n + 58), fx),
      fy,
    ),
    lerp(
      lerp(vhash(n + 113), vhash(n + 114), fx),
      lerp(vhash(n + 170), vhash(n + 171), fx),
      fy,
    ),
    fz,
  );
}

// ── 距离平方 Worley（特征点用 vnoise 偏移，mod(cellCount) 平铺；对齐参考）──────
function worley3(x, y, z, cellCount) {
  const cx = x * cellCount,
    cy = y * cellCount,
    cz = z * cellCount;
  const fx = Math.floor(cx),
    fy = Math.floor(cy),
    fz = Math.floor(cz);
  let d = 1e10;
  for (let ix = -1; ix <= 1; ix++)
    for (let iy = -1; iy <= 1; iy++)
      for (let iz = -1; iz <= 1; iz++) {
        const tx = fx + ix,
          ty = fy + iy,
          tz = fz + iz;
        const mx = ((tx % cellCount) + cellCount) % cellCount;
        const my = ((ty % cellCount) + cellCount) % cellCount;
        const mz = ((tz % cellCount) + cellCount) % cellCount;
        const off = vnoise3(mx, my, mz);
        const dx = cx - tx - off,
          dy = cy - ty - off,
          dz = cz - tz - off;
        const dd = dx * dx + dy * dy + dz * dz;
        if (dd < d) d = dd;
      }
  return clamp01(d);
}

// ── Shape R（remap(perlin-worley, worleyFbm-1, 1)，对齐 cloudShape.frag）──────
function shapeR(x, y, z) {
  const perlin = clamp01(perlinFbm3(x, y, z, 8, 3));
  const w8 = 1 - worley3(x, y, z, 8),
    w16 = 1 - worley3(x, y, z, 16),
    w32 = 1 - worley3(x, y, z, 32);
  const w56 = 1 - worley3(x, y, z, 56),
    w64 = 1 - worley3(x, y, z, 64);
  const pwfbm = w8 * 0.625 + w32 * 0.25 + w56 * 0.125;
  const perlinWorley = remap(perlin, 0, 1, pwfbm, 1);
  const f0 = w8 * 0.625 + w16 * 0.25 + w32 * 0.125;
  const f1 = w16 * 0.625 + w32 * 0.25 + w64 * 0.125;
  const f2 = w32 * 0.75 + w64 * 0.25;
  const wfbm = f0 * 0.625 + f1 * 0.25 + f2 * 0.125;
  return clamp01(remap(perlinWorley, wfbm - 1, 1, 0, 1));
}

// ── Detail R（worley FBM cells 2,4,8,16，对齐 cloudShapeDetail.frag）─────────
function detailR(x, y, z) {
  const n0 = 1 - worley3(x, y, z, 2),
    n1 = 1 - worley3(x, y, z, 4),
    n2 = 1 - worley3(x, y, z, 8),
    n3 = 1 - worley3(x, y, z, 16);
  const f0 = n0 * 0.625 + n1 * 0.25 + n2 * 0.125;
  const f1 = n1 * 0.625 + n2 * 0.25 + n3 * 0.125;
  const f2 = n2 * 0.75 + n3 * 0.25;
  return clamp01(f0 * 0.625 + f1 * 0.25 + f2 * 0.125);
}

self.onmessage = () => {
  // Shape 128³（R8，单通道；存 RGBA8 以兼容格式，仅 R 有效）
  const S = 128;
  const shape = new Uint8Array(S * S * S * 4);
  for (let z = 0; z < S; z++) {
    for (let y = 0; y < S; y++)
      for (let x = 0; x < S; x++) {
        const r = shapeR((x + 0.5) / S, (y + 0.5) / S, (z + 0.5) / S);
        const i = ((z * S + y) * S + x) * 4;
        shape[i] = (r * 255) | 0;
        shape[i + 3] = 255;
      }
    if (z % 8 === 0)
      self.postMessage({ type: "progress", value: (z / S) * 70 });
  }

  // Detail 32³（R8）
  const D = 32;
  const detail = new Uint8Array(D * D * D * 4);
  for (let z = 0; z < D; z++) {
    for (let y = 0; y < D; y++)
      for (let x = 0; x < D; x++) {
        const r = detailR((x + 0.5) / D, (y + 0.5) / D, (z + 0.5) / D);
        const i = ((z * D + y) * D + x) * 4;
        detail[i] = (r * 255) | 0;
        detail[i + 3] = 255;
      }
    if (z % 4 === 0)
      self.postMessage({ type: "progress", value: 70 + (z / D) * 30 });
  }

  self.postMessage({ type: "progress", value: 100 });
  self.postMessage(
    {
      type: "done",
      shape: shape.buffer,
      detail: detail.buffer,
      shapeSize: S,
      detailSize: D,
    },
    [shape.buffer, detail.buffer],
  );
};
