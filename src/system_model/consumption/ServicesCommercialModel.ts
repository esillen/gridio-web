import type { Actor, PowerUpdate } from '../../game/Actor'

export interface ServicesInput {
  localHour: number
  localMinute: number
  dayOfWeek: number  // 0=Mon ... 6=Sun
  temperatureOutdoorC: number
  cloudCover01: number
  businessActivity01?: number
  holiday01?: number
  curtailmentFrac01?: number
}

export interface ServicesBreakdown {
  consumptionMW: number
  plugItMW: number
  lightingMW: number
  ventilationMW: number
  refrigerationMW: number
  serviceHeatingMW: number
  occupancy01: number
  activityFactor: number
}

const CONSTANTS = {
  // Size anchors (TWh)
  totalElectricityUse2024TWh: 125.3,
  industryElectricityUse2024TWh: 45.3,
  householdElectricityUse2024TWh: 33.0,
  servicesShareOfOther: 0.70,

  // Sub-load shares
  sharePlugAndIt: 0.40,
  shareLighting: 0.18,
  shareVentilationAndPumps: 0.20,
  shareRefrigeration: 0.12,
  shareSpaceHeatingElectric: 0.10,

  // Caps
  peakCapMW: 8000.0,

  // Lighting
  lightingCloudCoeff: 0.25,
  lightingMinMultiplier: 0.35,
  lightingMaxMultiplier: 1.60,

  // Ventilation
  ventilationMinFraction: 0.35,
  ventilationOccSensitivity: 0.80,

  // Heating
  heatingBalanceTempC: 15.0,
  designTempC: -20.0,
  serviceHeatingPeakMW: 2500.0,
  heatingResponseTauS: 1800.0,

  // Refrigeration
  refrigerationOccCoeff: 0.10,
  refrigerationMinFraction: 0.90,

  // Curtailment
  curtailmentMinFactor: 0.80,
  curtailableShare: 0.55,
}

// Derived constants
const OTHER_TWH = CONSTANTS.totalElectricityUse2024TWh - CONSTANTS.industryElectricityUse2024TWh - CONSTANTS.householdElectricityUse2024TWh
const ANNUAL_SERVICES_TWH = OTHER_TWH * CONSTANTS.servicesShareOfOther
const AVG_SERVICES_MW = (ANNUAL_SERVICES_TWH * 1_000_000) / 8760.0

// Occupancy by hour [0-23]
const OCCUPANCY_WEEKDAY = [
  0.10, 0.08, 0.07, 0.07, 0.08, 0.12, 0.25, 0.55, 0.85, 0.95, 1.00, 1.00,
  0.98, 0.95, 0.92, 0.95, 1.00, 0.90, 0.65, 0.40, 0.25, 0.18, 0.14, 0.12,
]

const OCCUPANCY_WEEKEND = [
  0.10, 0.09, 0.08, 0.08, 0.09, 0.12, 0.18, 0.30, 0.45, 0.60, 0.70, 0.75,
  0.75, 0.72, 0.68, 0.65, 0.60, 0.50, 0.40, 0.30, 0.22, 0.16, 0.13, 0.11,
]

// Winter darkness by hour
const WINTER_DARKNESS_BY_HOUR = [
  1.00, 1.00, 1.00, 1.00, 1.00, 0.95, 0.85, 0.70, 0.55, 0.45, 0.40, 0.38,
  0.38, 0.42, 0.50, 0.62, 0.78, 0.90, 0.98, 1.00, 1.00, 1.00, 1.00, 1.00,
]

function clamp(x: number, min: number, max: number): number {
  return Math.min(Math.max(x, min), max)
}

function clamp01(x: number): number {
  return clamp(x, 0, 1)
}

export class ServicesCommercialModel implements Actor {
  id: string
  name: string

  private lastConsumptionMW = 0
  private lastHeatingMW = 0
  private lastBreakdown: ServicesBreakdown | null = null

  constructor(id: string, name: string) {
    this.id = id
    this.name = name
  }

  tick(input: ServicesInput): ServicesBreakdown {
    const C = CONSTANTS
    const dt = 1.0

    const isWeekend = input.dayOfWeek >= 5
    const occ01 = isWeekend
      ? (OCCUPANCY_WEEKEND[input.localHour] ?? 0.5)
      : (OCCUPANCY_WEEKDAY[input.localHour] ?? 0.5)

    // Activity factor
    const businessActivity = clamp01(input.businessActivity01 ?? 1.0)
    const holiday = clamp01(input.holiday01 ?? 0)
    const activityFactor = businessActivity * (1 - 0.35 * holiday)

    // Base MW
    const baseFloorMW = AVG_SERVICES_MW * 0.55
    const baseVariableMW = AVG_SERVICES_MW * 0.75
    const baseMWPreActivity = baseFloorMW + baseVariableMW * occ01
    const baseMW = baseMWPreActivity * activityFactor

    // Curtailment
    const curtailmentFactor = clamp(
      1 - (input.curtailmentFrac01 ?? 0),
      C.curtailmentMinFactor,
      1.0
    )
    const baseMWAfterDR = baseMW * (1 - C.curtailableShare + C.curtailableShare * curtailmentFactor)

    // Plug/IT
    const plugItMW = baseMWAfterDR * C.sharePlugAndIt

    // Lighting
    const darkness01 = WINTER_DARKNESS_BY_HOUR[input.localHour] ?? 0.5
    const lightingMultiplier = clamp(
      C.lightingMinMultiplier + 0.75 * darkness01 + C.lightingCloudCoeff * input.cloudCover01,
      C.lightingMinMultiplier,
      C.lightingMaxMultiplier
    )
    const lightingMW = baseMWAfterDR * C.shareLighting * lightingMultiplier * (0.35 + 0.65 * occ01)

    // Ventilation
    const ventilationFactor = C.ventilationMinFraction + C.ventilationOccSensitivity * occ01
    const ventilationMW = baseMWAfterDR * C.shareVentilationAndPumps * ventilationFactor

    // Refrigeration (minimal DR)
    const refrigerationFactor = Math.max(C.refrigerationMinFraction, 1.0 + C.refrigerationOccCoeff * (occ01 - 0.5))
    const refrigerationMW = baseMW * C.shareRefrigeration * refrigerationFactor

    // Service-sector electric heating (temperature-driven, smoothed)
    const heatingDegreeC = Math.max(0, C.heatingBalanceTempC - input.temperatureOutdoorC)
    const heatingDegreeDesignC = C.heatingBalanceTempC - C.designTempC
    const heatingTempFactor01 = clamp(heatingDegreeC / heatingDegreeDesignC, 0, 1)
    const heatingTargetMWRaw = C.serviceHeatingPeakMW * heatingTempFactor01 * (0.40 + 0.60 * occ01) * activityFactor
    const heatingTargetMW = heatingTargetMWRaw * curtailmentFactor

    // Smooth heating response
    this.lastHeatingMW += (heatingTargetMW - this.lastHeatingMW) * (dt / C.heatingResponseTauS)
    const heatingMW = this.lastHeatingMW

    // Total, capped
    let consumptionMW = plugItMW + lightingMW + ventilationMW + refrigerationMW + heatingMW
    consumptionMW = Math.min(consumptionMW, C.peakCapMW)

    this.lastConsumptionMW = consumptionMW
    this.lastBreakdown = {
      consumptionMW,
      plugItMW,
      lightingMW,
      ventilationMW,
      refrigerationMW,
      serviceHeatingMW: heatingMW,
      occupancy01: occ01,
      activityFactor,
    }

    return this.lastBreakdown
  }

  getUpdate(): PowerUpdate {
    return {
      production: 0,
      consumption: this.lastConsumptionMW,
    }
  }

  get breakdown(): ServicesBreakdown | null {
    return this.lastBreakdown
  }

  get consumptionMW(): number {
    return this.lastConsumptionMW
  }

  reset(): void {
    this.lastConsumptionMW = 0
    this.lastHeatingMW = 0
    this.lastBreakdown = null
  }
}
