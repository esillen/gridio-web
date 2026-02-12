import type { Actor, PowerUpdate } from '../../game/Actor'
import type { WindRegionWeather } from '../WeatherRegionsModel'

export interface WindRegionalInput {
  windRegions: WindRegionWeather[]
  curtailmentFrac01?: number
}

export interface WindRegionBreakdown {
  productionMW: number
  capacityMW: number
  powerFrac01: number
  windSmoothMps: number
  shutdownActive: boolean
}

export interface WindFleetRegionalBreakdown {
  productionMW: number
  totalCapacityMW: number
  regions: WindRegionBreakdown[]
  regionIds: string[]
}

const WIND_N = 8
const REGION_IDS = ['FarNorth_inland', 'FarNorth_coast', 'North_inland', 'North_coast', 'Central_inland', 'Central_coast_east', 'South_west', 'Offshore']

const CONSTANTS = {
  installedCapacityMWTotal: 16820.0,
  capacityShare01ByRegion: [0.08, 0.06, 0.18, 0.14, 0.10, 0.16, 0.14, 0.14],

  vCutInMps: 3.0,
  vRatedMps: 12.0,
  vCutOutMps: 25.0,
  belowRatedExponent: 2.0,

  tauWindSmoothS: 900.0,
  tauPowerSmoothS: 180.0,
  tauPowerSmooth2S: 120.0,

  gustTripMps: 50.0,
  gustRestartMps: 45.0,
  shutdownMinDurationS: 60.0,

  icingDerateMax01: 0.35,
  icingTempCenterC: -1.0,
  icingTempWidthC: 6.0,
}

function clamp(x: number, min: number, max: number): number {
  return Math.min(Math.max(x, min), max)
}

function clamp01(x: number): number {
  return clamp(x, 0, 1)
}

function fleetPowerCurveFrac(v: number): number {
  const C = CONSTANTS
  if (v < C.vCutInMps) return 0
  if (v < C.vRatedMps) {
    const x = (v - C.vCutInMps) / (C.vRatedMps - C.vCutInMps)
    return Math.pow(x, C.belowRatedExponent)
  }
  if (v < C.vCutOutMps) return 1
  return 0
}

export class WindFleetRegionalModel implements Actor {
  id: string
  name: string

  private windSmoothMpsByRegion: number[] = Array(WIND_N).fill(8.0)
  private powerFracSmooth01ByRegion: number[] = Array(WIND_N).fill(0.3)
  private powerFracSmooth201ByRegion: number[] = Array(WIND_N).fill(0.3)
  private shutdownActiveByRegion: boolean[] = Array(WIND_N).fill(false)
  private shutdownTimerSByRegion: number[] = Array(WIND_N).fill(0)
  private _productionMW = 0
  private lastBreakdown: WindFleetRegionalBreakdown | null = null

  constructor(id: string = 'wind-fleet', name: string = 'Swedish Wind Fleet') {
    this.id = id
    this.name = name
  }

  tick(input: WindRegionalInput): WindFleetRegionalBreakdown {
    const C = CONSTANTS
    const dt = 1.0

    // Process each region
    const regions: WindRegionBreakdown[] = []
    let totalProductionMW = 0

    for (let r = 0; r < WIND_N; r++) {
      const region = input.windRegions[r]!
      const capacityMW = C.installedCapacityMWTotal * (C.capacityShare01ByRegion[r] ?? 0)

      // 1) Smooth wind speed
      this.windSmoothMpsByRegion[r]! += (region.windSpeed100mMps - (this.windSmoothMpsByRegion[r] ?? 0)) * (dt / C.tauWindSmoothS)

      // 2) Gust shutdown hysteresis
      if (!this.shutdownActiveByRegion[r] && region.windGustMps >= C.gustTripMps) {
        this.shutdownActiveByRegion[r] = true
        this.shutdownTimerSByRegion[r] = C.shutdownMinDurationS
      }

      if (this.shutdownActiveByRegion[r]) {
        this.shutdownTimerSByRegion[r] = Math.max(0, (this.shutdownTimerSByRegion[r] ?? 0) - dt)
        if (this.shutdownTimerSByRegion[r] === 0 && region.windGustMps <= C.gustRestartMps) {
          this.shutdownActiveByRegion[r] = false
        }
      }

      // 3) Base power fraction
      let basePowerFrac01 = 0
      if (!this.shutdownActiveByRegion[r]) {
        basePowerFrac01 = fleetPowerCurveFrac(this.windSmoothMpsByRegion[r] ?? 0)
      }

      // 4) Icing derate
      const tempWeight = Math.exp(-Math.pow((region.temperatureC - C.icingTempCenterC) / C.icingTempWidthC, 2))
      const icingFactor01 = clamp01(1.0 - region.icingRisk01 * C.icingDerateMax01 * tempWeight)

      // 5) Curtailment
      const curtailFactor01 = clamp01(1.0 - (input.curtailmentFrac01 ?? 0))

      // 6) Instant power fraction
      const powerFracInstant01 = clamp01(basePowerFrac01 * icingFactor01 * curtailFactor01)

      // 7) Smooth power fraction (two stages)
      this.powerFracSmooth01ByRegion[r]! += (powerFracInstant01 - (this.powerFracSmooth01ByRegion[r] ?? 0)) * (dt / C.tauPowerSmoothS)
      this.powerFracSmooth201ByRegion[r]! += ((this.powerFracSmooth01ByRegion[r] ?? 0) - (this.powerFracSmooth201ByRegion[r] ?? 0)) * (dt / C.tauPowerSmooth2S)

      // 8) Production MW
      const productionMW = capacityMW * (this.powerFracSmooth201ByRegion[r] ?? 0)
      totalProductionMW += productionMW

      regions.push({
        productionMW,
        capacityMW,
        powerFrac01: this.powerFracSmooth201ByRegion[r] ?? 0,
        windSmoothMps: this.windSmoothMpsByRegion[r] ?? 0,
        shutdownActive: this.shutdownActiveByRegion[r] ?? false,
      })
    }

    this._productionMW = totalProductionMW

    this.lastBreakdown = {
      productionMW: totalProductionMW,
      totalCapacityMW: C.installedCapacityMWTotal,
      regions,
      regionIds: REGION_IDS,
    }

    return this.lastBreakdown
  }

  get productionMW(): number {
    return this._productionMW
  }

  get breakdown(): WindFleetRegionalBreakdown | null {
    return this.lastBreakdown
  }

  getUpdate(): PowerUpdate {
    return { production: this._productionMW, consumption: 0 }
  }

  requestPowerUpdate(_update: PowerUpdate): void {
    // Wind generation is not directly controllable
  }

  reset(): void {
    this.windSmoothMpsByRegion = Array(WIND_N).fill(8.0)
    this.powerFracSmooth01ByRegion = Array(WIND_N).fill(0.3)
    this.powerFracSmooth201ByRegion = Array(WIND_N).fill(0.3)
    this.shutdownActiveByRegion = Array(WIND_N).fill(false)
    this.shutdownTimerSByRegion = Array(WIND_N).fill(0)
    this._productionMW = 0
    this.lastBreakdown = null
  }
}
