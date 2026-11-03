// Self-contained so the same calculation can run in a Blob Worker or as a fallback.
export function computeScreenGrid(store, camera, options) {
  const empty = () => ({ clusters: [], singles: new Int32Array(0), members: new Int32Array(0), visibleCount: 0 })
  if (!store || camera.width <= 0 || camera.height <= 0) return empty()
  const vp = new Float64Array(16)
  const a = camera.projection, b = camera.view
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 4; row++) {
      vp[col * 4 + row] = a[row] * b[col * 4] + a[4 + row] * b[col * 4 + 1]
        + a[8 + row] * b[col * 4 + 2] + a[12 + row] * b[col * 4 + 3]
    }
  }
  const radii = camera.ellipsoidRadii, eye = camera.cameraPosition
  const scaledEye = radii && eye ? [eye[0] / radii[0], eye[1] / radii[1], eye[2] / radii[2]] : null
  const horizonSquared = scaledEye ? scaledEye.reduce((sum, value) => sum + value * value, 0) - 1 : -1
  const horizon = camera.horizonCulling !== false && horizonSquared > 0
  const visible = (x, y, z) => {
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return false
    if (horizon) {
      // Ellipsoid-scaled horizon test also handles elevated points, unlike a surface-only dot test.
      const dx = x / radii[0] - scaledEye[0], dy = y / radii[1] - scaledEye[1], dz = z / radii[2] - scaledEye[2]
      const toward = -(dx * scaledEye[0] + dy * scaledEye[1] + dz * scaledEye[2])
      if (toward > horizonSquared && toward * toward > horizonSquared * (dx * dx + dy * dy + dz * dz)) return false
    }
    return true
  }
  const cellSize = Math.max(1, options.pixelRange)
  const columns = Math.max(1, Math.ceil(camera.width / cellSize))
  const aggregate = options.enabled !== false && options.pixelRange > 0
  const cells = new Map(), visibleIndices = []
  for (let i = 0; i < store.count; i++) {
    const off = i * 3, x = store.position[off], y = store.position[off + 1], z = store.position[off + 2]
    if (!visible(x, y, z)) continue
    const w = vp[3] * x + vp[7] * y + vp[11] * z + vp[15]
    if (w <= 0) continue
    const nx = (vp[0] * x + vp[4] * y + vp[8] * z + vp[12]) / w
    const ny = (vp[1] * x + vp[5] * y + vp[9] * z + vp[13]) / w
    const nz = (vp[2] * x + vp[6] * y + vp[10] * z + vp[14]) / w
    if (nx < -1 || nx > 1 || ny < -1 || ny > 1 || nz < -1 || nz > 1) continue
    visibleIndices.push(i)
    if (!aggregate) continue
    const col = Math.min(columns - 1, Math.floor((nx + 1) * camera.width * 0.5 / cellSize))
    const row = Math.max(0, Math.floor((1 - ny) * camera.height * 0.5 / cellSize))
    const key = row * columns + Math.max(0, col)
    let cell = cells.get(key)
    if (!cell) {
      cell = { count: 0, anchor: store.lons[i], lon: 0, lat: 0, height: 0, indices: [] }
      cells.set(key, cell)
    }
    // Avoid placing a cluster at Greenwich when its members cross the date line.
    const longitude = ((store.lons[i] - cell.anchor + 540) % 360) - 180
    cell.count++
    cell.lon += longitude
    cell.lat += store.lats[i]
    cell.height += store.heights?.[i] || 0
    cell.indices.push(i)
  }
  if (!aggregate) return { ...empty(), singles: Int32Array.from(visibleIndices), visibleCount: visibleIndices.length }
  const clusters = [], singles = [], members = []
  for (const cell of cells.values()) {
    if (cell.count < options.minimumClusterSize) {
      for (const index of cell.indices) singles.push(index)
      continue
    }
    clusters.push({
      longitude: ((cell.anchor + cell.lon / cell.count + 540) % 360) - 180,
      latitude: cell.lat / cell.count,
      height: cell.height / cell.count,
      pointCount: cell.count,
      offset: members.length,
    })
    for (const index of cell.indices) members.push(index)
  }
  return { clusters, singles: Int32Array.from(singles), members: Int32Array.from(members), visibleCount: visibleIndices.length }
}

export const SCREEN_GRID_WORKER_SOURCE = `
const compute = (${computeScreenGrid.toString()});
let store;
self.onmessage = ({ data: message }) => {
  if (message.type === 'setData') {
    store = message.data;
    self.postMessage({ type: 'dataReady', epoch: message.epoch });
  } else if (message.type === 'cluster') {
    const started = performance.now();
    const result = compute(store, message.camera, message.options);
    self.postMessage({ type: 'clusterResult', epoch: message.epoch, requestId: message.requestId,
      ...result, computeTime: performance.now() - started }, [result.singles.buffer, result.members.buffer]);
  }
};`
