import type { Actor, PowerUpdate } from '../../game/Actor'

export interface IndustryInput {
  localHour: number
  dayOfWeek: number
  activityFactor?: number
  gridStress01?: number
  priceSignal01?: number
  drParticipation01?: number
  manualCurtailmentFrac01?: number
}

export interface IndustryBreakdown {
  consumptionMW: number
  pulpPaperMW: number
  basicMetalsMW: number
  chemicalsRefiningMW: number
  miningQuarryingMW: number
  foodMW: number
  woodProductsMW: number
  machineryEquipmentMW: number
  transportEquipmentMW: number
  otherIndustryMW: number
  paybackMW: number
  deferredMWh: number
  drRequest01: number
  activityFactor: number
}

// SCB data Jan-Nov 2025 annualized to average MW
const SCB_DATA = {
  totalGWh: 38347.0,
  pulpPaperGWh: 14171.0,
  basicMetalsGWh: 5908.0,
  chemicalsRefiningGWh: 4262.0,
  miningQuarryingGWh: 3567.0,
  foodGWh: 1936.0,
  woodProductsGWh: 1198.0,
  machineryEquipmentGWh: 1496.0,
  transportEquipmentGWh: 1459.0,
}

const ANNUALIZATION = 12.0 / 11.0

function gwhToAvgMW(gwh: number): number {
  return (gwh * ANNUALIZATION * 1000.0) / 8760.0
}

const AVG_MW = {
  total: gwhToAvgMW(SCB_DATA.totalGWh),
  pulpPaper: gwhToAvgMW(SCB_DATA.pulpPaperGWh),
  basicMetals: gwhToAvgMW(SCB_DATA.basicMetalsGWh),
  chemicalsRefining: gwhToAvgMW(SCB_DATA.chemicalsRefiningGWh),
  miningQuarrying: gwhToAvgMW(SCB_DATA.miningQuarryingGWh),
  food: gwhToAvgMW(SCB_DATA.foodGWh),
  woodProducts: gwhToAvgMW(SCB_DATA.woodProductsGWh),
  machineryEquipment: gwhToAvgMW(SCB_DATA.machineryEquipmentGWh),
  transportEquipment: gwhToAvgMW(SCB_DATA.transportEquipmentGWh),
}

AVG_MW.total = gwhToAvgMW(SCB_DATA.totalGWh)
const otherMW = Math.max(0,
  AVG_MW.total - AVG_MW.pulpPaper - AVG_MW.basicMetals - AVG_MW.chemicalsRefining
  - AVG_MW.miningQuarrying - AVG_MW.food - AVG_MW.woodProducts
  - AVG_MW.machineryEquipment - AVG_MW.transportEquipment
)

const SCHEDULE = {
  continuous: { night: 0.98, day: 1.02 },
  manufacturing: { night: 0.75, day: 1.20, weekendMult: 0.80 },
  mining: { night: 0.85, day: 1.10, weekendMult: 0.90 },
}

const FLEX_SHARE = {
  pulpPaper: 0.05,
  basicMetals: 0.07,
  chemicalsRefining: 0.08,
  miningQuarrying: 0.06,
  food: 0.05,
  woodProducts: 0.06,
  machineryEquipment: 0.10,
  transportEquipment: 0.10,
  other: 0.08,
}

const DR = {
  aStress: 0.90,
  bPrice: 0.40,
  flexMinFactor: 0.30,
  paybackMaxMW: 2500.0,
  paybackAllowedIfStressBelow: 0.35,
}

function clamp01(x: number): number {
  return Math.min(Math.max(x, 0), 1)
}

function getScheduleFactor(type: 'continuous' | 'manufacturing' | 'mining', hour: number): number {
  const isDay = hour >= 6 && hour < 18
  const sched = SCHEDULE[type]
  return isDay ? sched.day : sched.night
}

export class IndustryProcessModel implements Actor {
  id: string
  name: string

  private deferredMWh = 0
  private lastConsumptionMW = 0
  private lastBreakdown: IndustryBreakdown | null = null

  constructor(id: string = 'industry-process', name: string = 'Industrial Process') {
    this.id = id
    this.name = name
  }

  tick(input: IndustryInput): IndustryBreakdown {
    const dt = 1.0
    const hour = input.localHour
    const isWeekend = input.dayOfWeek >= 5
    const activityFactor = clamp01(input.activityFactor ?? 1.0)

    // Base loads by sector with schedule and activity
    let pulpPaperBase = AVG_MW.pulpPaper * getScheduleFactor('continuous', hour) * activityFactor
    let basicMetalsBase = AVG_MW.basicMetals * getScheduleFactor('continuous', hour) * activityFactor
    let chemicalsRefiningBase = AVG_MW.chemicalsRefining * getScheduleFactor('continuous', hour) * activityFactor

    const miningFactor = getScheduleFactor('mining', hour) * (isWeekend ? SCHEDULE.mining.weekendMult : 1.0)
    let miningQuarryingBase = AVG_MW.miningQuarrying * miningFactor * activityFactor

    const manufFactor = getScheduleFactor('manufacturing', hour) * (isWeekend ? SCHEDULE.manufacturing.weekendMult : 1.0)
    let foodBase = AVG_MW.food * manufFactor * activityFactor
    let woodProductsBase = AVG_MW.woodProducts * manufFactor * activityFactor
    let machineryEquipmentBase = AVG_MW.machineryEquipment * manufFactor * activityFactor
    let transportEquipmentBase = AVG_MW.transportEquipment * manufFactor * activityFactor
    let otherIndustryBase = otherMW * manufFactor * activityFactor

    // DR request calculation
    const gridStress = clamp01(input.gridStress01 ?? 0)
    const priceSignal = clamp01(input.priceSignal01 ?? 0)
    const manualCurtail = clamp01(input.manualCurtailmentFrac01 ?? 0)
    const participation = clamp01(input.drParticipation01 ?? 0)

    let drRequest = clamp01(DR.aStress * gridStress + DR.bPrice * priceSignal + manualCurtail)
    drRequest *= participation

    // Curtailment by sector
    const curtailFactor = (1 - DR.flexMinFactor) * drRequest
    const pulpPaperCurtailed = pulpPaperBase * FLEX_SHARE.pulpPaper * curtailFactor
    const basicMetalsCurtailed = basicMetalsBase * FLEX_SHARE.basicMetals * curtailFactor
    const chemicalsRefiningCurtailed = chemicalsRefiningBase * FLEX_SHARE.chemicalsRefining * curtailFactor
    const miningQuarryingCurtailed = miningQuarryingBase * FLEX_SHARE.miningQuarrying * curtailFactor
    const foodCurtailed = foodBase * FLEX_SHARE.food * curtailFactor
    const woodProductsCurtailed = woodProductsBase * FLEX_SHARE.woodProducts * curtailFactor
    const machineryEquipmentCurtailed = machineryEquipmentBase * FLEX_SHARE.machineryEquipment * curtailFactor
    const transportEquipmentCurtailed = transportEquipmentBase * FLEX_SHARE.transportEquipment * curtailFactor
    const otherIndustryCurtailed = otherIndustryBase * FLEX_SHARE.other * curtailFactor

    const totalCurtailedMW = pulpPaperCurtailed + basicMetalsCurtailed + chemicalsRefiningCurtailed
      + miningQuarryingCurtailed + foodCurtailed + woodProductsCurtailed
      + machineryEquipmentCurtailed + transportEquipmentCurtailed + otherIndustryCurtailed

    // Accumulate deferred energy
    const curtailedMWhThisTick = totalCurtailedMW * (dt / 3600.0)
    this.deferredMWh += curtailedMWhThisTick

    // Payback when stress is low
    const paybackAllowed = gridStress <= DR.paybackAllowedIfStressBelow
    let paybackMW = 0
    if (paybackAllowed) {
      paybackMW = Math.min(DR.paybackMaxMW, this.deferredMWh * (3600.0 / dt))
    }
    const paybackMWhThisTick = paybackMW * (dt / 3600.0)
    this.deferredMWh = Math.max(0, this.deferredMWh - paybackMWhThisTick)

    // Final sector values after curtailment
    const pulpPaperMW = pulpPaperBase - pulpPaperCurtailed
    const basicMetalsMW = basicMetalsBase - basicMetalsCurtailed
    const chemicalsRefiningMW = chemicalsRefiningBase - chemicalsRefiningCurtailed
    const miningQuarryingMW = miningQuarryingBase - miningQuarryingCurtailed
    const foodMW = foodBase - foodCurtailed
    const woodProductsMW = woodProductsBase - woodProductsCurtailed
    const machineryEquipmentMW = machineryEquipmentBase - machineryEquipmentCurtailed
    const transportEquipmentMW = transportEquipmentBase - transportEquipmentCurtailed
    const otherIndustryMW = otherIndustryBase - otherIndustryCurtailed

    const consumptionMW = pulpPaperMW + basicMetalsMW + chemicalsRefiningMW + miningQuarryingMW
      + foodMW + woodProductsMW + machineryEquipmentMW + transportEquipmentMW + otherIndustryMW
      + paybackMW

    this.lastConsumptionMW = consumptionMW
    this.lastBreakdown = {
      consumptionMW,
      pulpPaperMW,
      basicMetalsMW,
      chemicalsRefiningMW,
      miningQuarryingMW,
      foodMW,
      woodProductsMW,
      machineryEquipmentMW,
      transportEquipmentMW,
      otherIndustryMW,
      paybackMW,
      deferredMWh: this.deferredMWh,
      drRequest01: drRequest,
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

  get breakdown(): IndustryBreakdown | null {
    return this.lastBreakdown
  }

  get consumptionMW(): number {
    return this.lastConsumptionMW
  }

  reset(): void {
    this.deferredMWh = 0
    this.lastConsumptionMW = 0
    this.lastBreakdown = null
  }
}
