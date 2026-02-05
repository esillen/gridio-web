import type { Actor, PowerUpdate } from '../../game/Actor'

export type HydroDispatchMode = 'follow_target' | 'must_run_min' | 'water_saver'

export interface HydroDispatch {
  targetProductionMW: number
  mode: HydroDispatchMode
  holdbackMW: number
}

export interface HydroForecast {
  stepS: number
  netLoadMW: number[]
  inflowMWEquiv: number[]
}

export interface HydroBreakdown {
  productionMW: number
  availablePowerMW: number
  energyBudgetTodayMWh: number
  energyLimitedPowerMW: number
  reservoirStorageMWh: number
  reservoirStorageLevelPct: number
  maxProductionMW: number
  dailyEnergyBudgetMaxMWh: number
}

const CONSTANTS = {
  installedHydroCapacityMW: 16200.0,
  storageEnergyCapacityMWh: 34_000_000.0,
  reservoirFractionOfInstalled: 0.90,
  turbineEfficiency: 0.92,
  rampRateUpMWPerS: 20.0,
  rampRateDownMWPerS: 40.0,
  mustRunMinMW: 500.0,
  sustainableFractionForDay: 0.95,
  lookaheadPeakWindowS: 6000,
  waterSaverStrength: 0.6,
  waterSaverMinFractionOfTarget: 0.50,
}

const MAX_POWER_MW = CONSTANTS.installedHydroCapacityMW * CONSTANTS.reservoirFractionOfInstalled
const DAILY_ENERGY_BUDGET_MAX_MWH = MAX_POWER_MW * 24.0 * CONSTANTS.sustainableFractionForDay

function clamp(x: number, min: number, max: number): number {
  return Math.min(Math.max(x, min), max)
}

export class HydroReservoirFleetModel implements Actor {
  id: string
  name: string

  private energyBudgetTodayMWh: number
  private reservoirStorageMWh: number
  private currentProductionMW: number
  private lastLocalDayIndex: number
  
  private dispatch: HydroDispatch
  private forecast: HydroForecast
  private lastBreakdown: HydroBreakdown | null = null

  constructor(id: string = 'hydro-reservoir', name: string = 'Swedish Hydro Reservoir Fleet') {
    this.id = id
    this.name = name
    this.energyBudgetTodayMWh = DAILY_ENERGY_BUDGET_MAX_MWH
    this.reservoirStorageMWh = CONSTANTS.storageEnergyCapacityMWh * 0.60
    this.currentProductionMW = CONSTANTS.mustRunMinMW
    this.lastLocalDayIndex = 0
    this.dispatch = {
      targetProductionMW: MAX_POWER_MW,
      mode: 'follow_target',
      holdbackMW: 0,
    }
    this.forecast = this.createDefaultForecast()
  }

  private createDefaultForecast(): HydroForecast {
    const steps = 96 // 15-minute intervals
    return {
      stepS: 900,
      netLoadMW: new Array(steps).fill(10000),
      inflowMWEquiv: new Array(steps).fill(7500), // ~65 TWh/year average
    }
  }

  setDispatch(dispatch: Partial<HydroDispatch>): void {
    if (dispatch.targetProductionMW !== undefined) this.dispatch.targetProductionMW = dispatch.targetProductionMW
    if (dispatch.mode !== undefined) this.dispatch.mode = dispatch.mode
    if (dispatch.holdbackMW !== undefined) this.dispatch.holdbackMW = dispatch.holdbackMW
  }

  setForecast(forecast: Partial<HydroForecast>): void {
    if (forecast.stepS !== undefined) this.forecast.stepS = forecast.stepS
    if (forecast.netLoadMW !== undefined) this.forecast.netLoadMW = forecast.netLoadMW
    if (forecast.inflowMWEquiv !== undefined) this.forecast.inflowMWEquiv = forecast.inflowMWEquiv
  }

  tick(timeInDayS: number): HydroBreakdown {
    const C = CONSTANTS
    const dt = 1.0

    // Daily reset check (simple: based on time wrapping)
    const localDayIndex = Math.floor(timeInDayS / 86400)
    if (localDayIndex !== this.lastLocalDayIndex) {
      this.energyBudgetTodayMWh = DAILY_ENERGY_BUDGET_MAX_MWH
      this.lastLocalDayIndex = localDayIndex
    }

    // Available capacity after reserve holdback
    const holdbackMW = Math.max(0, this.dispatch.holdbackMW)
    const availablePowerMW = Math.max(0, MAX_POWER_MW - holdbackMW)

    // Inflow for this tick (using first element = now)
    const inflowMWEquivNow = this.forecast.inflowMWEquiv[0] ?? 7500
    const inflowMWhThisTick = inflowMWEquivNow * (dt / 3600.0)
    
    // Add inflow to budget
    this.energyBudgetTodayMWh = Math.min(
      this.energyBudgetTodayMWh + inflowMWhThisTick,
      DAILY_ENERGY_BUDGET_MAX_MWH
    )

    // Energy-limited power for rest of day
    const remainingDayS = Math.max(1, 86400 - timeInDayS)
    const energyLimitedPowerMW = (this.energyBudgetTodayMWh * 3600.0) / remainingDayS

    // Determine raw target based on mode
    let rawTargetMW: number

    if (this.dispatch.mode === 'follow_target') {
      rawTargetMW = this.dispatch.targetProductionMW
    } else if (this.dispatch.mode === 'must_run_min') {
      rawTargetMW = Math.max(this.dispatch.targetProductionMW, C.mustRunMinMW)
    } else {
      // water_saver mode
      const nlNowMW = this.forecast.netLoadMW[0] ?? 10000
      const windowSteps = Math.min(
        Math.floor(C.lookaheadPeakWindowS / this.forecast.stepS),
        this.forecast.netLoadMW.length - 1
      )
      
      let nlPeakMW = nlNowMW
      for (let i = 1; i <= windowSteps && i < this.forecast.netLoadMW.length; i++) {
        nlPeakMW = Math.max(nlPeakMW, this.forecast.netLoadMW[i] ?? nlNowMW)
      }
      
      const peakGapMW = Math.max(0, nlPeakMW - nlNowMW)
      const saveBiasMW = C.waterSaverStrength * peakGapMW
      
      rawTargetMW = Math.max(C.mustRunMinMW, this.dispatch.targetProductionMW - saveBiasMW)
      rawTargetMW = Math.max(rawTargetMW, C.waterSaverMinFractionOfTarget * this.dispatch.targetProductionMW)
    }

    // Apply constraints
    const constrainedTargetMW = clamp(
      rawTargetMW,
      C.mustRunMinMW,
      Math.min(availablePowerMW, energyLimitedPowerMW)
    )

    // Ramp toward target
    const deltaMW = constrainedTargetMW - this.currentProductionMW
    let deltaLimitedMW: number
    if (deltaMW >= 0) {
      deltaLimitedMW = Math.min(deltaMW, C.rampRateUpMWPerS * dt)
    } else {
      deltaLimitedMW = Math.max(deltaMW, -C.rampRateDownMWPerS * dt)
    }

    let newProductionMW = clamp(this.currentProductionMW + deltaLimitedMW, 0, availablePowerMW)

    // Spend energy budget
    const producedMWhThisTick = newProductionMW * (dt / 3600.0)
    const requiredBudgetMWhThisTick = producedMWhThisTick / C.turbineEfficiency

    if (requiredBudgetMWhThisTick <= this.energyBudgetTodayMWh) {
      this.energyBudgetTodayMWh -= requiredBudgetMWhThisTick
      this.currentProductionMW = newProductionMW
    } else {
      // Not enough budget
      const maxMWhPossible = this.energyBudgetTodayMWh * C.turbineEfficiency
      this.currentProductionMW = maxMWhPossible * (3600.0 / dt)
      this.energyBudgetTodayMWh = 0
    }

    // Update long-run storage
    this.reservoirStorageMWh = clamp(
      this.reservoirStorageMWh - requiredBudgetMWhThisTick + (inflowMWhThisTick / C.turbineEfficiency),
      0,
      CONSTANTS.storageEnergyCapacityMWh
    )

    this.lastBreakdown = {
      productionMW: this.currentProductionMW,
      availablePowerMW,
      energyBudgetTodayMWh: this.energyBudgetTodayMWh,
      energyLimitedPowerMW,
      reservoirStorageMWh: this.reservoirStorageMWh,
      reservoirStorageLevelPct: (this.reservoirStorageMWh / CONSTANTS.storageEnergyCapacityMWh) * 100,
      maxProductionMW: MAX_POWER_MW,
      dailyEnergyBudgetMaxMWh: DAILY_ENERGY_BUDGET_MAX_MWH,
    }

    return this.lastBreakdown
  }

  getUpdate(): PowerUpdate {
    return {
      production: this.currentProductionMW,
      consumption: 0,
    }
  }

  get breakdown(): HydroBreakdown | null {
    return this.lastBreakdown
  }

  get productionMW(): number {
    return this.currentProductionMW
  }

  get totalCapacityMW(): number {
    return MAX_POWER_MW
  }

  reset(): void {
    this.energyBudgetTodayMWh = DAILY_ENERGY_BUDGET_MAX_MWH
    this.reservoirStorageMWh = CONSTANTS.storageEnergyCapacityMWh * 0.60
    this.currentProductionMW = CONSTANTS.mustRunMinMW
    this.lastLocalDayIndex = 0
    this.dispatch = {
      targetProductionMW: MAX_POWER_MW,
      mode: 'follow_target',
      holdbackMW: 0,
    }
    this.forecast = this.createDefaultForecast()
    this.lastBreakdown = null
  }
}
