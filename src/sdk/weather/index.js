import BaseWeatherEffect from './BaseWeatherEffect.js'
import WeatherSystem from './WeatherSystem.js'
import RainEffect from './RainEffect.js'
import SnowEffect from './SnowEffect.js'
import FogEffect from './FogEffect.js'
import HeightFogEffect from './HeightFogEffect.js'
import SandstormEffect from './SandstormEffect.js'
import CloudEffect from './CloudEffect.js'
import CloudUltraEffect from './CloudUltraEffect.js'
import LightningEffect from './LightningEffect.js'
import { createWeatherEffect, weatherEffectTypes } from './createWeatherEffect.js'

const WeatherEffects = {
  WeatherSystem,
  createWeatherEffect,
  weatherEffectTypes,
  BaseWeatherEffect,
  RainEffect,
  SnowEffect,
  FogEffect,
  HeightFogEffect,
  SandstormEffect,
  CloudEffect,
  CloudUltraEffect,
  LightningEffect,
}

export {
  WeatherSystem,
  createWeatherEffect,
  weatherEffectTypes,
  BaseWeatherEffect,
  RainEffect,
  SnowEffect,
  FogEffect,
  HeightFogEffect,
  SandstormEffect,
  CloudEffect,
  CloudUltraEffect,
  LightningEffect,
}

export default WeatherEffects
