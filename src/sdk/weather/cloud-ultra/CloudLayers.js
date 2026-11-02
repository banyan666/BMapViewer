import * as Cesium from "cesium";

// 忠实移植 three-geospatial 的 CloudLayers / DensityProfile / uniforms 打包。
// 固定 4 层，shader 用 vec4 打包。单位：米（altitude/height 相对 bottomRadius 球面）。

const DEFAULT_DENSITY_PROFILE = {
  expTerm: 0,
  exponent: 0,
  linearTerm: 0.75,
  constantTerm: 0.25,
};

function layer(overrides) {
  return {
    channel: "r",
    altitude: 0,
    height: 0,
    densityScale: 0.2,
    shapeAmount: 1,
    shapeDetailAmount: 1,
    weatherExponent: 1,
    shapeAlteringBias: 0.35,
    coverageFilterWidth: 0.6,
    shadow: false,
    densityProfile: { ...DEFAULT_DENSITY_PROFILE },
    ...overrides,
  };
}

// storybook clouds--basic 默认：3 活跃层 + 1 空层
export function defaultCloudLayers() {
  return [
    layer({ channel: "r", altitude: 750, height: 650, shadow: true }),
    layer({ channel: "g", altitude: 1000, height: 1200, shadow: true }),
    layer({
      channel: "b",
      altitude: 7500,
      height: 500,
      densityScale: 0.003,
      shapeAmount: 0.4,
      shapeDetailAmount: 0,
      coverageFilterWidth: 0.5,
    }),
    layer({ channel: "a" }),
  ];
}

const V4 = (a, b, c, d) => new Cesium.Cartesian4(a, b, c, d);
const V3 = (a, b, c) => new Cesium.Cartesian3(a, b, c);

const packValues = (layers, key) =>
  V4(layers[0][key], layers[1][key], layers[2][key], layers[3][key]);
const packSums = (layers, a, b) =>
  V4(
    layers[0][a] + layers[0][b],
    layers[1][a] + layers[1][b],
    layers[2][a] + layers[2][b],
    layers[3][a] + layers[3][b],
  );
const packProfile = (layers, key) =>
  V4(
    layers[0].densityProfile[key],
    layers[1].densityProfile[key],
    layers[2].densityProfile[key],
    layers[3].densityProfile[key],
  );

// 区间合并：算出层之间的空隙（供 march 跳步），最多 3 段
function packIntervalHeights(layers) {
  const entries = [];
  for (let i = 0; i < 4; ++i) {
    entries.push({ value: layers[i].altitude, flag: 0 });
    entries.push({ value: layers[i].altitude + layers[i].height, flag: 1 });
  }
  entries.sort((a, b) =>
    a.value !== b.value ? a.value - b.value : a.flag - b.flag,
  );
  const intervals = [];
  let balance = 0;
  for (let i = 0; i < entries.length; ++i) {
    if (balance === 0 && i > 0) {
      intervals.push({ min: entries[i - 1].value, max: entries[i].value });
    }
    balance += entries[i].flag === 0 ? 1 : -1;
  }
  while (intervals.length < 3) intervals.push({ min: 0, max: 0 });
  return {
    minIntervalHeights: V3(
      intervals[0].min,
      intervals[1].min,
      intervals[2].min,
    ),
    maxIntervalHeights: V3(
      intervals[0].max,
      intervals[1].max,
      intervals[2].max,
    ),
  };
}

/** 由云层数组算出全部层相关 uniform 值 */
export function computeLayerUniforms(layers) {
  const { minIntervalHeights, maxIntervalHeights } =
    packIntervalHeights(layers);

  let totalMinHeight = Infinity;
  let totalMaxHeight = 0;
  let shadowBottomHeight = Infinity;
  let shadowTopHeight = 0;
  const shadowMask = [0, 0, 0, 0];
  for (let i = 0; i < 4; ++i) {
    const { altitude, height, shadow } = layers[i];
    const maxHeight = altitude + height;
    if (height > 0) {
      if (altitude < totalMinHeight) totalMinHeight = altitude;
      if (maxHeight > totalMaxHeight) totalMaxHeight = maxHeight;
      if (shadow && altitude < shadowBottomHeight)
        shadowBottomHeight = altitude;
      if (shadow && maxHeight > shadowTopHeight) shadowTopHeight = maxHeight;
    }
    shadowMask[i] = shadow ? 1 : 0;
  }
  if (totalMinHeight === Infinity) totalMinHeight = 0;
  if (shadowBottomHeight === Infinity) shadowBottomHeight = 0;

  return {
    minLayerHeights: packValues(layers, "altitude"),
    maxLayerHeights: packSums(layers, "altitude", "height"),
    minIntervalHeights,
    maxIntervalHeights,
    densityScales: packValues(layers, "densityScale"),
    shapeAmounts: packValues(layers, "shapeAmount"),
    shapeDetailAmounts: packValues(layers, "shapeDetailAmount"),
    weatherExponents: packValues(layers, "weatherExponent"),
    shapeAlteringBiases: packValues(layers, "shapeAlteringBias"),
    coverageFilterWidths: packValues(layers, "coverageFilterWidth"),
    minHeight: totalMinHeight,
    maxHeight: totalMaxHeight,
    shadowTopHeight,
    shadowBottomHeight,
    shadowLayerMask: V4(
      shadowMask[0],
      shadowMask[1],
      shadowMask[2],
      shadowMask[3],
    ),
    densityProfile: {
      expTerms: packProfile(layers, "expTerm"),
      exponents: packProfile(layers, "exponent"),
      linearTerms: packProfile(layers, "linearTerm"),
      constantTerms: packProfile(layers, "constantTerm"),
    },
  };
}

export function localWeatherChannels(layers) {
  return layers.map((l) => l.channel).join("");
}
