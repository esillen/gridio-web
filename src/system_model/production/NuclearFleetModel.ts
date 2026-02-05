import type { Actor, PowerUpdate } from '../../game/Actor'

export type DispatchMode = 'must_run' | 'follow_schedule_fleet' | 'follow_schedule_by_unit'

export type UnitId = 'Forsmark_1' | 'Forsmark_2' | 'Forsmark_3' | 'Ringhals_3' | 'Ringhals_4' | 'Oskarshamn_3'

export interface UnitState {
  netCapacityMW: number
  currentMW: number
}

export interface NuclearDispatch {
  mode: DispatchMode
  scheduleStepS: number
  scheduleTargetFleetMW: number[]
  scheduleTargetByUnitMW: Record<UnitId, number[]>
}

export interface NuclearBreakdown {
  productionMW: number
  productionByUnitMW: Record<UnitId, number>
  availableCapacityByUnitMW: Record<UnitId, number>
  availableCapacityTotalMW: number
  maxProductionMW: number
}

export const UNIT_IDS: UnitId[] = ['Forsmark_1', 'Forsmark_2', 'Forsmark_3', 'Ringhals_3', 'Ringhals_4', 'Oskarshamn_3']

export const INITIAL_UNITS: Record<UnitId, UnitState> = {
  Forsmark_1: { netCapacityMW: 1104.0, currentMW: 1104.0 },
  Forsmark_2: { netCapacityMW: 1121.0, currentMW: 1121.0 },
  Forsmark_3: { netCapacityMW: 1172.0, currentMW: 1172.0 },
  Ringhals_3: { netCapacityMW: 1081.0, currentMW: 1081.0 },
  Ringhals_4: { netCapacityMW: 1134.0, currentMW: 1134.0 },
  Oskarshamn_3: { netCapacityMW: 1400.0, currentMW: 1400.0 },
}

export const NUCLEAR_TOTAL_CAPACITY_MW = Object.values(INITIAL_UNITS).reduce((sum, u) => sum + u.netCapacityMW, 0)

export const NUCLEAR_CONSTANTS = {
  minStableFraction: 0.50,
  rampRateMWPerSPerUnit: 0.05,
  rampRateFleetMWPerS: 0.30,
}

const CONSTANTS = NUCLEAR_CONSTANTS

function clamp(x: number, min: number, max: number): number {
  return Math.min(Math.max(x, min), max)
}

function createDefaultSchedule(value: number, steps: number): number[] {
  return new Array(steps).fill(value)
}

export class NuclearFleetModel implements Actor {
  id: string
  name: string
  
  private units: Record<UnitId, UnitState>
  private dispatch: NuclearDispatch
  private lastBreakdown: NuclearBreakdown | null = null

  constructor(id: string = 'nuclear-fleet', name: string = 'Swedish Nuclear Fleet') {
    this.id = id
    this.name = name
    this.units = this.createInitialUnits()
    this.dispatch = this.createDefaultDispatch()
  }

  private createInitialUnits(): Record<UnitId, UnitState> {
    const units = {} as Record<UnitId, UnitState>
    for (const id of UNIT_IDS) {
      units[id] = { ...INITIAL_UNITS[id] }
    }
    return units
  }

  private createDefaultDispatch(): NuclearDispatch {
    const totalCapacity = this.getTotalCapacity()
    const steps = 96 // 15-minute intervals for 24h
    return {
      mode: 'must_run',
      scheduleStepS: 900,
      scheduleTargetFleetMW: createDefaultSchedule(totalCapacity, steps),
      scheduleTargetByUnitMW: {
        Forsmark_1: createDefaultSchedule(INITIAL_UNITS.Forsmark_1.netCapacityMW, steps),
        Forsmark_2: createDefaultSchedule(INITIAL_UNITS.Forsmark_2.netCapacityMW, steps),
        Forsmark_3: createDefaultSchedule(INITIAL_UNITS.Forsmark_3.netCapacityMW, steps),
        Ringhals_3: createDefaultSchedule(INITIAL_UNITS.Ringhals_3.netCapacityMW, steps),
        Ringhals_4: createDefaultSchedule(INITIAL_UNITS.Ringhals_4.netCapacityMW, steps),
        Oskarshamn_3: createDefaultSchedule(INITIAL_UNITS.Oskarshamn_3.netCapacityMW, steps),
      },
    }
  }

  private getTotalCapacity(): number {
    return UNIT_IDS.reduce((sum, id) => sum + INITIAL_UNITS[id].netCapacityMW, 0)
  }

  setDispatch(dispatch: Partial<NuclearDispatch>): void {
    if (dispatch.mode !== undefined) this.dispatch.mode = dispatch.mode
    if (dispatch.scheduleStepS !== undefined) this.dispatch.scheduleStepS = dispatch.scheduleStepS
    if (dispatch.scheduleTargetFleetMW !== undefined) this.dispatch.scheduleTargetFleetMW = dispatch.scheduleTargetFleetMW
    if (dispatch.scheduleTargetByUnitMW !== undefined) this.dispatch.scheduleTargetByUnitMW = dispatch.scheduleTargetByUnitMW
  }

  tick(timeInDayS: number): NuclearBreakdown {
    const C = CONSTANTS
    const dt = 1.0

    // Compute per-unit max/min
    const unitLimits: Record<UnitId, { maxMW: number; minMW: number }> = {} as any
    for (const id of UNIT_IDS) {
      const maxMW = this.units[id].netCapacityMW
      unitLimits[id] = { maxMW, minMW: C.minStableFraction * maxMW }
    }

    // Schedule indices
    const stepS = this.dispatch.scheduleStepS
    const tInStepS = timeInDayS % stepS
    const timeToNextS = stepS - tInStepS
    const idxNow = Math.floor(timeInDayS / stepS)
    const idxNext = idxNow + 1

    // Compute targets based on dispatch mode
    const unitTargets: Record<UnitId, number> = {} as any

    if (this.dispatch.mode === 'must_run') {
      for (const id of UNIT_IDS) {
        unitTargets[id] = unitLimits[id].maxMW
      }
    } else if (this.dispatch.mode === 'follow_schedule_fleet') {
      const schedule = this.dispatch.scheduleTargetFleetMW
      const desiredFleetNowMW = schedule[idxNow] ?? this.getTotalCapacity()
      const desiredFleetNextMW = schedule[idxNext] ?? desiredFleetNowMW

      // Look-ahead feasibility adjustment
      const maxChangeToNextMW = C.rampRateFleetMWPerS * timeToNextS
      const feasibleFleetTargetMW = clamp(
        desiredFleetNowMW,
        desiredFleetNextMW - maxChangeToNextMW,
        desiredFleetNextMW + maxChangeToNextMW
      )

      // Distribute proportionally to capacity
      const fleetMaxMW = UNIT_IDS.reduce((sum, id) => sum + unitLimits[id].maxMW, 0)
      for (const id of UNIT_IDS) {
        const share = fleetMaxMW > 0 ? unitLimits[id].maxMW / fleetMaxMW : 0
        const targetRaw = feasibleFleetTargetMW * share
        unitTargets[id] = clamp(targetRaw, unitLimits[id].minMW, unitLimits[id].maxMW)
      }
    } else {
      // follow_schedule_by_unit
      for (const id of UNIT_IDS) {
        const schedule = this.dispatch.scheduleTargetByUnitMW[id]
        const desiredNowMW = schedule?.[idxNow] ?? this.units[id].netCapacityMW
        const desiredNextMW = schedule?.[idxNext] ?? desiredNowMW

        // Look-ahead feasibility adjustment per unit
        const maxChangeToNextMW = C.rampRateMWPerSPerUnit * timeToNextS
        const feasibleTargetMW = clamp(
          desiredNowMW,
          desiredNextMW - maxChangeToNextMW,
          desiredNextMW + maxChangeToNextMW
        )
        unitTargets[id] = clamp(feasibleTargetMW, unitLimits[id].minMW, unitLimits[id].maxMW)
      }
    }

    // Ramp each unit toward its target
    for (const id of UNIT_IDS) {
      const unit = this.units[id]
      const deltaMW = unitTargets[id] - unit.currentMW
      const deltaLimitedMW = clamp(deltaMW, -C.rampRateMWPerSPerUnit * dt, C.rampRateMWPerSPerUnit * dt)
      unit.currentMW = clamp(unit.currentMW + deltaLimitedMW, 0, unitLimits[id].maxMW)
    }

    // Build outputs
    let productionMW = 0
    const productionByUnitMW = {} as Record<UnitId, number>
    const availableCapacityByUnitMW = {} as Record<UnitId, number>

    for (const id of UNIT_IDS) {
      productionMW += this.units[id].currentMW
      productionByUnitMW[id] = this.units[id].currentMW
      availableCapacityByUnitMW[id] = this.units[id].netCapacityMW
    }

    const totalCapacity = this.getTotalCapacity()

    this.lastBreakdown = {
      productionMW,
      productionByUnitMW,
      availableCapacityByUnitMW,
      availableCapacityTotalMW: totalCapacity,
      maxProductionMW: totalCapacity,
    }

    return this.lastBreakdown
  }

  getUpdate(): PowerUpdate {
    const production = UNIT_IDS.reduce((sum, id) => sum + this.units[id].currentMW, 0)
    return { production, consumption: 0 }
  }

  get breakdown(): NuclearBreakdown | null {
    return this.lastBreakdown
  }

  get productionMW(): number {
    return UNIT_IDS.reduce((sum, id) => sum + this.units[id].currentMW, 0)
  }

  get totalCapacityMW(): number {
    return this.getTotalCapacity()
  }

  reset(): void {
    this.units = this.createInitialUnits()
    this.dispatch = this.createDefaultDispatch()
    this.lastBreakdown = null
  }
}
