import RainEffect from './RainEffect.js'
import SnowEffect from './SnowEffect.js'
import FogEffect from './FogEffect.js'
import HeightFogEffect from './HeightFogEffect.js'
import SandstormEffect from './SandstormEffect.js'
import CloudEffect from './CloudEffect.js'
import CloudUltraEffect from './CloudUltraEffect.js'
import LightningEffect from './LightningEffect.js'

const EFFECTS = Object.freeze({
  rain: RainEffect,
  snow: SnowEffect,
  fog: FogEffect,
  'height-fog': HeightFogEffect,
  sandstorm: SandstormEffect,
  sand: SandstormEffect,
  cloud: CloudEffect,
  'cloud-ultra': CloudUltraEffect,
  lightning: LightningEffect,
})

export function createWeatherEffect(viewer, type, options = {}) {
  let effectType = type
  let effectOptions = options

  if (type && typeof type === 'object') {
    effectType = type.type
    effectOptions = { ...type }
    delete effectOptions.type
  }

  const normalizedType = String(effectType || '').toLowerCase()
  const Effect = EFFECTS[normalizedType]
  if (!Effect) {
    throw new Error(`Unsupported weather effect type: ${effectType}`)
  }
  return new Effect(viewer, effectOptions)
}

export const weatherEffectTypes = Object.freeze([
  'rain',
  'snow',
  'fog',
  'height-fog',
  'sandstorm',
  'cloud',
  'cloud-ultra',
  'lightning',
])
