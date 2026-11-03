// 移植 three-geospatial 的 4×4 Bayer 序（march 抖动与 resolve 归属判定共用）。
export const bayerIndices = [
  0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5,
];

// bayerOffsets[i] = 第 i 帧应采样的 4×4 子像素中心（[0,1]）
export const bayerOffsets = bayerIndices.reduce((result, _, index) => {
  const offset = { x: 0, y: 0 };
  for (let i = 0; i < 16; ++i) {
    if (bayerIndices[i] === index) {
      offset.x = ((i % 4) + 0.5) / 4;
      offset.y = (Math.floor(i / 4) + 0.5) / 4;
      break;
    }
  }
  return [...result, offset];
}, []);
