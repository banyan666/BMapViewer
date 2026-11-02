export const DEFAULT_CONFIG = { unit: 'm', areaUnit: 'm2' }
export const AREA_FACTORS = { m2: 1, km2: 1000000, ha: 10000 }
export const UNIT_OPTIONS = {
  m: { unit: 'm', turfUnit: 'meters' }, meters: { unit: 'm', turfUnit: 'meters' },
  km: { unit: 'km', turfUnit: 'kilometers' }, kilometers: { unit: 'km', turfUnit: 'kilometers' },
}

export function normalizeOptions(options) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) {
    throw new TypeError('Analysis options must be an object.')
  }
  return options
}

export function normalizeConfig(config) {
  normalizeOptions(config)
  const requestedUnit = typeof config.unit === 'string' ? config.unit.trim().toLowerCase() : ''
  const resolved = Object.hasOwn(UNIT_OPTIONS, requestedUnit) ? UNIT_OPTIONS[requestedUnit] : null
  if (!resolved) throw new RangeError('Analysis unit must be m or km (meters or kilometers).')
  const areaUnit = typeof config.areaUnit === 'string' ? config.areaUnit.trim().toLowerCase().replace('²', '2') : ''
  if (!Object.hasOwn(AREA_FACTORS, areaUnit)) throw new RangeError('Analysis areaUnit must be m2, km2 or ha.')
  return { ...config, unit: resolved.unit, areaUnit }
}
