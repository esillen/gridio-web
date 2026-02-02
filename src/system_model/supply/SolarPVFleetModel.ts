import type { Actor, PowerUpdate } from '../../game/Actor'

export interface SolarInput {
  solarIrradianceWm2: number
  temperatureC: number
  precipitationSnowMmph: number
  curtailmentFrac01?: number
}

export interface SolarBreakdown {
  productionMW: number
  capacityMW: number
  powerFrac01: number
  snowCover01: number
}

const CONSTANTS = {
  installedCapacityMWAC: 4808.4,
  dcAcRatio: 1.15,
  availability: 0.995,
  soilingLoss: 0.03,
  wiringMismatchLoss: 0.05,
  inverterLoss: 0.03,

  ghiToPlaneFactor: 1.10,
  irradianceRefWm2: 1000.0,
  minIrradianceWm2: 10.0,

  NOCT_C: 45.0,
  tempCoeffPerC: -0.004,
  TRefC: 25.0,

  snowAccumTempThresholdC: 1.0,
  snowAccumRatePerMm: 0.12,
  snowAccumColdBoost: 1.5,
  snowMeltTempStartC: 0.0,
  snowMeltRatePerSAt5C: 2.5e-5,
  snowMeltSolarRatePerWm2PerS: 2.0e-8,

  tauPowerSmoothS: 10.0,
}

const NET_LOSS_FACTOR = (1 - CONSTANTS.soilingLoss) * (1 - CONSTANTS.wiringMismatchLoss) * (1 - CONSTANTS.inverterLoss)

function clamp(x: number, min: number, max: number): number {
  return Math.min(Math.max(x, min), max)
}

function clamp01(x: number): number {
  return clamp(x, 0, 1)
}

export class SolarPVFleetModel implements Actor {
  id: string
  name: string

  private powerFracSmooth = 0
  private snowCover01 = 0
  private lastProductionMW = 0
  private lastBreakdown: SolarBreakdown | null = null

  constructor(id: string = 'solar-pv', name: string = 'Swedish Solar PV Fleet') {
    this.id = id
    this.name = name
  }

  tick(input: SolarInput): SolarBreakdown {
    const C = CONSTANTS
    const dt = 1.0

    // Effective plane-of-array irradiance
    const poaWm2 = input.solarIrradianceWm2 * C.ghiToPlaneFactor

    // Update snow cover
    const snowMmThisTick = input.precipitationSnowMmph * (dt / 3600.0)
    const coldBoost = input.temperatureC <= C.snowAccumTempThresholdC ? C.snowAccumColdBoost : 1.0
    const snowAccumDelta = snowMmThisTick * C.snowAccumRatePerMm * coldBoost

    const tempAbove0C = Math.max(0, input.temperatureC - C.snowMeltTempStartC)
    const meltRateTempPerS = C.snowMeltRatePerSAt5C * (tempAbove0C / 5.0)
    const meltRateSolarPerS = C.snowMeltSolarRatePerWm2PerS * Math.max(0, poaWm2)
    const snowMeltDelta = (meltRateTempPerS + meltRateSolarPerS) * dt

    this.snowCover01 = clamp01(this.snowCover01 + snowAccumDelta - snowMeltDelta)

    // DC power fraction from irradiance
    let powerFracDC = 0
    if (poaWm2 >= C.minIrradianceWm2) {
      const powerFracIrr = clamp01(poaWm2 / C.irradianceRefWm2)

      // Cell temperature and efficiency
      const TCellC = input.temperatureC + ((C.NOCT_C - 20.0) / 800.0) * poaWm2
      const tempEff = clamp(1.0 + C.tempCoeffPerC * (TCellC - C.TRefC), 0.75, 1.10)

      powerFracDC = clamp01(powerFracIrr * tempEff)
    }

    // Apply losses, curtailment, snow
    const curtailFactor = clamp01(1.0 - (input.curtailmentFrac01 ?? 0))
    const snowFactor = clamp01(1.0 - this.snowCover01)

    const powerFracACInstant = clamp01(
      powerFracDC * C.availability * NET_LOSS_FACTOR * curtailFactor * snowFactor
    )

    // Smooth power fraction
    this.powerFracSmooth += (powerFracACInstant - this.powerFracSmooth) * (dt / C.tauPowerSmoothS)

    // Output MW
    const productionMW = C.installedCapacityMWAC * this.powerFracSmooth

    this.lastProductionMW = productionMW
    this.lastBreakdown = {
      productionMW,
      capacityMW: C.installedCapacityMWAC,
      powerFrac01: this.powerFracSmooth,
      snowCover01: this.snowCover01,
    }

    return this.lastBreakdown
  }

  getUpdate(): PowerUpdate {
    return {
      production: this.lastProductionMW,
      consumption: 0,
    }
  }

  get breakdown(): SolarBreakdown | null {
    return this.lastBreakdown
  }

  get productionMW(): number {
    return this.lastProductionMW
  }

  get totalCapacityMW(): number {
    return CONSTANTS.installedCapacityMWAC
  }

  reset(): void {
    this.powerFracSmooth = 0
    this.snowCover01 = 0
    this.lastProductionMW = 0
    this.lastBreakdown = null
  }
}
