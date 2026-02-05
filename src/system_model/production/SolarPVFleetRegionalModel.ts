import type { Actor, PowerUpdate } from '../../game/Actor'
import type { SolarSiteWeather } from '../WeatherRegionsModel'

export interface SolarRegionalInput {
  solarSites: SolarSiteWeather[]
  curtailmentFrac01?: number
}

export interface SolarSiteBreakdown {
  productionMW: number
  capacityMW: number
  powerFrac01: number
  snowCover01: number
}

export interface SolarFleetRegionalBreakdown {
  productionMW: number
  totalCapacityMW: number
  sites: SolarSiteBreakdown[]
  siteIds: string[]
}

const SOLAR_N = 2
const SITE_IDS = ['South', 'North']

const CONSTANTS = {
  installedCapacityMWACTotal: 4808.4,
  capacityShare01BySite: [0.70, 0.30],

  dcAcRatio: 1.15,
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

  tauPowerSmoothS: 12.0,
}

function clamp(x: number, min: number, max: number): number {
  return Math.min(Math.max(x, min), max)
}

function clamp01(x: number): number {
  return clamp(x, 0, 1)
}

export class SolarPVFleetRegionalModel implements Actor {
  id: string
  name: string

  private powerFracSmooth01BySite: number[] = Array(SOLAR_N).fill(0)
  private snowCover01BySite: number[] = Array(SOLAR_N).fill(0)
  private _productionMW = 0
  private lastBreakdown: SolarFleetRegionalBreakdown | null = null

  constructor(id: string = 'solar-pv', name: string = 'Swedish Solar PV Fleet') {
    this.id = id
    this.name = name
  }

  tick(input: SolarRegionalInput): SolarFleetRegionalBreakdown {
    const C = CONSTANTS
    const dt = 1.0

    // Process each site
    const sites: SolarSiteBreakdown[] = []
    let totalProductionMW = 0

    for (let s = 0; s < SOLAR_N; s++) {
      const site = input.solarSites[s]!
      const capacityMW = C.installedCapacityMWACTotal * (C.capacityShare01BySite[s] ?? 0)

      // POA irradiance
      const poaWm2 = site.solarIrradianceWm2 * C.ghiToPlaneFactor

      // Snow cover update
      const snowMmThisTick = site.precipitationSnowMmph * (dt / 3600.0)
      const coldBoost = site.temperatureC <= C.snowAccumTempThresholdC ? C.snowAccumColdBoost : 1.0
      const snowAccumDelta = snowMmThisTick * C.snowAccumRatePerMm * coldBoost

      const tempAbove0C = Math.max(0, site.temperatureC - C.snowMeltTempStartC)
      const meltRateTempPerS = C.snowMeltRatePerSAt5C * (tempAbove0C / 5.0)
      const meltRateSolarPerS = C.snowMeltSolarRatePerWm2PerS * Math.max(0, poaWm2)
      const snowMeltDelta = (meltRateTempPerS + meltRateSolarPerS) * dt

      this.snowCover01BySite[s]! = clamp01((this.snowCover01BySite[s] ?? 0) + snowAccumDelta - snowMeltDelta)

      // Power fraction calculation
      let powerFracACInstant01 = 0.0
      if (poaWm2 >= C.minIrradianceWm2) {
        const irrFrac = clamp01(poaWm2 / C.irradianceRefWm2)

        // Cell temperature
        const TCellC = site.temperatureC + ((C.NOCT_C - 20.0) / 800.0) * poaWm2
        const tempEff = clamp(1.0 + C.tempCoeffPerC * (TCellC - C.TRefC), 0.75, 1.10)

        const dcFrac = clamp01(irrFrac * tempEff)

        // DC->AC with clipping
        const acFrac = Math.min(dcFrac * C.dcAcRatio, 1.0)

        // Curtailment
        const curtailFactor = clamp01(1.0 - (input.curtailmentFrac01 ?? 0))

        // Snow factor
        const snowFactor = clamp01(1.0 - (this.snowCover01BySite[s] ?? 0))

        powerFracACInstant01 = clamp01(acFrac * curtailFactor * snowFactor)
      }

      // Smooth output
      this.powerFracSmooth01BySite[s]! += (powerFracACInstant01 - (this.powerFracSmooth01BySite[s] ?? 0)) * (dt / C.tauPowerSmoothS)

      // Production MW
      const productionMW = capacityMW * (this.powerFracSmooth01BySite[s] ?? 0)
      totalProductionMW += productionMW

      sites.push({
        productionMW,
        capacityMW,
        powerFrac01: this.powerFracSmooth01BySite[s] ?? 0,
        snowCover01: this.snowCover01BySite[s] ?? 0,
      })
    }

    this._productionMW = totalProductionMW

    this.lastBreakdown = {
      productionMW: totalProductionMW,
      totalCapacityMW: C.installedCapacityMWACTotal,
      sites,
      siteIds: SITE_IDS,
    }

    return this.lastBreakdown
  }

  get productionMW(): number {
    return this._productionMW
  }

  get breakdown(): SolarFleetRegionalBreakdown | null {
    return this.lastBreakdown
  }

  getUpdate(): PowerUpdate {
    return { production: this._productionMW, consumption: 0 }
  }

  requestPowerUpdate(_update: PowerUpdate): void {
    // Solar generation is not directly controllable
  }

  reset(): void {
    this.powerFracSmooth01BySite = Array(SOLAR_N).fill(0)
    this.snowCover01BySite = Array(SOLAR_N).fill(0)
    this._productionMW = 0
    this.lastBreakdown = null
  }
}
