import type { Actor, PowerUpdate } from '../../game/Actor'

export interface NonHeatingInput {
  localHour: number
  localMinute: number
  dayOfWeek: number  // 0=Mon ... 6=Sun
  temperatureOutdoorC: number
  cloudCover01: number
  curtailmentFrac01?: number
  includeDHW?: boolean
  includeEV?: boolean
  evTargetMW?: number
}

export interface NonHeatingBreakdown {
  consumptionMW: number
  appliancesMW: number
  lightingMW: number
  cookingMW: number
  laundryMW: number
  dhwMW: number
  evMW: number
}

const CONSTANTS = {
  householdsCount: 5_000_000,
  avgHouseholdNonHeatingKWhPerYear: 4500.0,

  shareAppliancesElectronics: 0.50,
  shareLighting: 0.15,
  shareCooking: 0.10,
  shareLaundryDishwasher: 0.10,
  shareDHWElectric: 0.15,

  // Cooking peaks
  cookingBreakfastPeakMW: 500.0,
  cookingDinnerPeakMW: 900.0,
  cookingPeakWidthS: 3600.0,
  cookingBreakfastTimeH: 7.5,
  cookingDinnerTimeH: 18.0,

  // Lighting
  lightingCloudCoeff: 0.25,
  lightingTempCoeffPerC: 0.002,

  // Laundry
  laundryDaytimeBiasWeekend: 1.20,
  laundryDaytimeBiasWeekday: 1.00,

  // DHW
  dhwMorningPeakMW: 700.0,
  dhwEveningPeakMW: 600.0,
  dhwPeakWidthS: 5400.0,
  dhwMorningTimeH: 7.0,
  dhwEveningTimeH: 20.0,

  curtailmentMinFactor: 0.70,
}

// Schedule: [startHour, endHour, multiplier]
const SCHEDULE_WEEKDAY: [number, number, number][] = [
  [0, 5, 0.82],
  [5, 9, 1.10],
  [9, 16, 0.95],
  [16, 22, 1.22],
  [22, 24, 0.90],
]

const SCHEDULE_WEEKEND: [number, number, number][] = [
  [0, 7, 0.86],
  [7, 11, 1.10],
  [11, 17, 1.02],
  [17, 23, 1.18],
  [23, 24, 0.92],
]

// Winter darkness by hour (0=midnight, higher = darker)
const WINTER_DARKNESS_BY_HOUR = [
  1.00, 1.00, 1.00, 1.00, 1.00, 0.95, 0.85, 0.70, 0.55, 0.45, 0.40, 0.38,
  0.38, 0.42, 0.50, 0.62, 0.78, 0.90, 0.98, 1.00, 1.00, 1.00, 1.00, 1.00,
]

// Derived constants
const ANNUAL_NON_HEATING_MWH = CONSTANTS.householdsCount * CONSTANTS.avgHouseholdNonHeatingKWhPerYear / 1000.0
const AVG_NON_HEATING_MW = ANNUAL_NON_HEATING_MWH / 8760.0

function clamp(x: number, min: number, max: number): number {
  return Math.min(Math.max(x, min), max)
}

function gaussPeak(tDayS: number, centerH: number, widthS: number): number {
  const sigma = widthS / 2.355
  const diff = tDayS - centerH * 3600
  return Math.exp(-0.5 * (diff / sigma) ** 2)
}

function getScheduleFactor(localHour: number, isWeekend: boolean): number {
  const schedule = isWeekend ? SCHEDULE_WEEKEND : SCHEDULE_WEEKDAY
  for (const [start, end, multiplier] of schedule) {
    if (localHour >= start && localHour < end) {
      return multiplier
    }
  }
  return 1.0
}

export class ResidentialNonHeatingModel implements Actor {
  id: string
  name: string

  private lastConsumptionMW = 0
  private lastBreakdown: NonHeatingBreakdown | null = null

  constructor(id: string, name: string) {
    this.id = id
    this.name = name
  }

  tick(input: NonHeatingInput): NonHeatingBreakdown {
    const C = CONSTANTS

    const tDayS = input.localHour * 3600 + input.localMinute * 60
    const isWeekend = input.dayOfWeek >= 5

    // Schedule factor
    const scheduleFactor = getScheduleFactor(input.localHour, isWeekend)

    // Curtailment factor
    const curtailmentFactor = clamp(
      1 - (input.curtailmentFrac01 ?? 0),
      C.curtailmentMinFactor,
      1.0
    )

    // Base total (MW)
    const baseTotalMW = AVG_NON_HEATING_MW * scheduleFactor * curtailmentFactor

    // Appliances/electronics
    const appliancesMW = baseTotalMW * C.shareAppliancesElectronics

    // Lighting
    const darkness01 = WINTER_DARKNESS_BY_HOUR[input.localHour] ?? 0.5
    const lightingMultiplier = clamp(
      0.35 + 0.65 * darkness01 +
      C.lightingCloudCoeff * input.cloudCover01 +
      C.lightingTempCoeffPerC * Math.max(0, -input.temperatureOutdoorC),
      0.2, 1.6
    )
    const lightingMW = baseTotalMW * C.shareLighting * lightingMultiplier

    // Cooking
    const cookingBaseMW = baseTotalMW * C.shareCooking
    const cookingPulseMW =
      C.cookingBreakfastPeakMW * gaussPeak(tDayS, C.cookingBreakfastTimeH, C.cookingPeakWidthS) +
      C.cookingDinnerPeakMW * gaussPeak(tDayS, C.cookingDinnerTimeH, C.cookingPeakWidthS)
    const cookingMW = cookingBaseMW + cookingPulseMW * curtailmentFactor

    // Laundry/dishwasher
    const laundryBaseMW = baseTotalMW * C.shareLaundryDishwasher
    const daytime01 = clamp((input.localHour - 8) / 8.0, 0, 1) * clamp((20 - input.localHour) / 6.0, 0, 1)
    const laundryBias = isWeekend ? C.laundryDaytimeBiasWeekend : C.laundryDaytimeBiasWeekday
    const laundryMW = laundryBaseMW * (1 + (laundryBias - 1) * daytime01)

    // DHW (optional)
    let dhwMW = 0
    if (input.includeDHW) {
      dhwMW = baseTotalMW * C.shareDHWElectric +
        C.dhwMorningPeakMW * gaussPeak(tDayS, C.dhwMorningTimeH, C.dhwPeakWidthS) +
        C.dhwEveningPeakMW * gaussPeak(tDayS, C.dhwEveningTimeH, C.dhwPeakWidthS)
    }

    // EV charging (optional)
    let evMW = 0
    if (input.includeEV && input.evTargetMW !== undefined) {
      evMW = Math.max(0, input.evTargetMW)
    }

    // Total
    const consumptionMW = appliancesMW + lightingMW + cookingMW + laundryMW + dhwMW + evMW

    this.lastConsumptionMW = consumptionMW
    this.lastBreakdown = {
      consumptionMW,
      appliancesMW,
      lightingMW,
      cookingMW,
      laundryMW,
      dhwMW,
      evMW,
    }

    return this.lastBreakdown
  }

  getUpdate(): PowerUpdate {
    return {
      production: 0,
      consumption: this.lastConsumptionMW,
    }
  }

  get breakdown(): NonHeatingBreakdown | null {
    return this.lastBreakdown
  }

  get consumptionMW(): number {
    return this.lastConsumptionMW
  }

  reset(): void {
    this.lastConsumptionMW = 0
    this.lastBreakdown = null
  }
}
