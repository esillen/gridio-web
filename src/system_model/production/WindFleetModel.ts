import type { Actor, PowerUpdate } from '../../game/Actor'

export interface WindInput {
  windSpeed100mMps: number
  windGustMps: number
  temperatureC: number
  icingRisk01: number
  curtailmentFrac01?: number
}

export interface WindBreakdown {
  productionMW: number
  availableMW: number
  capacityMW: number
  powerFrac01: number
  shutdownActive: boolean
  windSmoothMps: number
}

const CONSTANTS = {
  installedCapacityMW: 16820.0,

  // Availability & technical losses
  availability: 0.97,
  wakeLoss: 0.08,
  electricalLoss: 0.02,
  otherLoss: 0.01,

  // Fleet power curve
  vCutInMps: 3.0,
  vRatedMps: 12.0,
  vCutOutMps: 25.0,
  belowRatedExponent: 3.0,

  // Smoothing (spatial diversity)
  tauWindSmoothS: 120.0,
  tauPowerSmoothS: 30.0,
  tauPowerSmooth2S: 15.0,  // Additional mild smoothing

  // Gust shutdown with hysteresis
  gustTripMps: 28.0,
  gustRestartMps: 22.0,
  shutdownMinDurationS: 600.0,

  // Icing / cold climate derate
  icingDerateMax: 0.35,
  icingTempCenterC: -1.0,
  icingTempWidthC: 6.0,
}

const NET_LOSS_FACTOR = (1 - CONSTANTS.wakeLoss) * (1 - CONSTANTS.electricalLoss) * (1 - CONSTANTS.otherLoss)

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

export class WindFleetModel implements Actor {
  id: string
  name: string

  private windSmoothMps = 8.0
  private powerFracSmooth = 0.3
  private powerFracSmooth2 = 0.3
  private shutdownActive = false
  private shutdownTimerS = 0
  private _productionMW = 0
  private lastBreakdown: WindBreakdown | null = null

  constructor(id: string = 'wind-fleet', name: string = 'Swedish Wind Fleet') {
    this.id = id
    this.name = name
  }

  tick(input: WindInput): WindBreakdown {
    const C = CONSTANTS
    const dt = 1.0

    // 1) Smooth wind speed
    this.windSmoothMps += (input.windSpeed100mMps - this.windSmoothMps) * (dt / C.tauWindSmoothS)

    // 2) Gust shutdown logic (uses raw gust, not smoothed wind)
    if (!this.shutdownActive && input.windGustMps >= C.gustTripMps) {
      this.shutdownActive = true
      this.shutdownTimerS = C.shutdownMinDurationS
    }

    if (this.shutdownActive) {
      this.shutdownTimerS = Math.max(0, this.shutdownTimerS - dt)
      if (this.shutdownTimerS === 0 && input.windGustMps <= C.gustRestartMps) {
        this.shutdownActive = false
      }
    }

    // 3) Base power fraction from smoothed wind (or 0 if shutdown)
    const basePowerFrac = this.shutdownActive ? 0 : fleetPowerCurveFrac(this.windSmoothMps)

    // 4) Icing derate factor
    const tempWeight = Math.exp(-Math.pow((input.temperatureC - C.icingTempCenterC) / C.icingTempWidthC, 2))
    const icingFactor = clamp01(1.0 - input.icingRisk01 * C.icingDerateMax * tempWeight)

    // 5) Curtailment factor
    const curtailFactor = clamp01(1.0 - (input.curtailmentFrac01 ?? 0))

    // 6) Combine factors into instantaneous power fraction
    const powerFracInstant = clamp01(
      basePowerFrac * C.availability * NET_LOSS_FACTOR * icingFactor * curtailFactor
    )

    // 7) Smooth power fraction (first stage)
    this.powerFracSmooth += (powerFracInstant - this.powerFracSmooth) * (dt / C.tauPowerSmoothS)

    // 7b) Additional mild smoothing (second stage)
    this.powerFracSmooth2 += (this.powerFracSmooth - this.powerFracSmooth2) * (dt / C.tauPowerSmooth2S)

    // 8) Output MW (use smooth2)
    this._productionMW = C.installedCapacityMW * this.powerFracSmooth2
    const availableMW = C.installedCapacityMW * C.availability * NET_LOSS_FACTOR * icingFactor

    this.lastBreakdown = {
      productionMW: this._productionMW,
      availableMW,
      capacityMW: C.installedCapacityMW,
      powerFrac01: this.powerFracSmooth2,
      shutdownActive: this.shutdownActive,
      windSmoothMps: this.windSmoothMps,
    }

    return this.lastBreakdown
  }

  getUpdate(): PowerUpdate {
    return {
      production: this._productionMW,
      consumption: 0,
    }
  }

  get breakdown(): WindBreakdown | null {
    return this.lastBreakdown
  }

  get productionMW(): number {
    return this._productionMW
  }

  get totalCapacityMW(): number {
    return CONSTANTS.installedCapacityMW
  }

  reset(): void {
    this.windSmoothMps = 8.0
    this.powerFracSmooth = 0.3
    this.powerFracSmooth2 = 0.3
    this.shutdownActive = false
    this.shutdownTimerS = 0
    this._productionMW = 0
    this.lastBreakdown = null
  }
}
