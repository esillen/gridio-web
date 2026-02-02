import type { Actor, PowerUpdate } from '../../game/Actor'

export type RoRDispatchMode = 'must_take' | 'follow_target' | 'cap_at_target'

export interface RoRDispatch {
  mode: RoRDispatchMode
  targetProductionMW: number
}

export interface RoRInput {
  inflowMWEquiv: number
  dispatch?: RoRDispatch
  holdbackMW?: number
}

export interface RoRBreakdown {
  productionMW: number
  capacityMW: number
  pondageEnergyMWh: number
  pondageCapacityMWh: number
  minGenerationMW: number
  spillMWEquiv: number
  inflowMW: number
}

const CONSTANTS = {
  installedCapacityMW: 2500.0,
  availability: 0.98,
  netLossFactor: 0.97,
  pondageHoursAtFullPower: 0.50,
  minFlowFractionOfInflow: 0.05,
  rampUpMWPerS: 50.0,
  rampDownMWPerS: 80.0,
}

const EFFECTIVE_CAPACITY = CONSTANTS.installedCapacityMW * CONSTANTS.availability * CONSTANTS.netLossFactor
const PONDAGE_CAPACITY_MWH = EFFECTIVE_CAPACITY * CONSTANTS.pondageHoursAtFullPower

function clamp(x: number, min: number, max: number): number {
  return Math.min(Math.max(x, min), max)
}

export class HydroRunOfRiverModel implements Actor {
  id: string
  name: string

  private pondageEnergyMWh = PONDAGE_CAPACITY_MWH * 0.5
  private currentProductionMW = 0
  private lastBreakdown: RoRBreakdown | null = null

  constructor(id: string = 'hydro-ror', name: string = 'Run-of-River Hydro') {
    this.id = id
    this.name = name
  }

  tick(input: RoRInput): RoRBreakdown {
    const dt = 1.0
    const inflowMW = input.inflowMWEquiv

    const holdbackMW = Math.max(0, input.holdbackMW ?? 0)
    const capMW = Math.max(0, EFFECTIVE_CAPACITY - holdbackMW)

    // Add inflow to pondage
    const inflowMWhThisTick = inflowMW * (dt / 3600.0)
    this.pondageEnergyMWh = Math.min(PONDAGE_CAPACITY_MWH, this.pondageEnergyMWh + inflowMWhThisTick)

    // Ecological minimum flow
    const minGenMW = Math.min(capMW, inflowMW * CONSTANTS.minFlowFractionOfInflow)

    // Determine desired setpoint based on dispatch mode
    const dispatch = input.dispatch ?? { mode: 'must_take' as RoRDispatchMode, targetProductionMW: 0 }
    let desiredMW: number

    switch (dispatch.mode) {
      case 'must_take':
        desiredMW = capMW
        break
      case 'cap_at_target':
      case 'follow_target':
        desiredMW = clamp(dispatch.targetProductionMW, 0, capMW)
        break
      default:
        desiredMW = capMW
    }

    // Energy availability constraint
    const maxMWFromPondage = this.pondageEnergyMWh * (3600.0 / dt)
    const maxMWNow = Math.min(capMW, maxMWFromPondage)

    // Target before ramping
    let targetMWPreRamp: number
    if (dispatch.mode === 'must_take') {
      targetMWPreRamp = Math.max(minGenMW, maxMWNow)
    } else {
      targetMWPreRamp = clamp(desiredMW, minGenMW, maxMWNow)
    }

    // Ramp toward target
    const deltaMW = targetMWPreRamp - this.currentProductionMW
    let deltaLimitedMW: number
    if (deltaMW >= 0) {
      deltaLimitedMW = Math.min(deltaMW, CONSTANTS.rampUpMWPerS * dt)
    } else {
      deltaLimitedMW = Math.max(deltaMW, -CONSTANTS.rampDownMWPerS * dt)
    }
    let newMW = this.currentProductionMW + deltaLimitedMW

    // Spend pondage energy
    const genMWhThisTick = newMW * (dt / 3600.0)
    if (genMWhThisTick <= this.pondageEnergyMWh) {
      this.pondageEnergyMWh -= genMWhThisTick
      this.currentProductionMW = newMW
    } else {
      this.currentProductionMW = this.pondageEnergyMWh * (3600.0 / dt)
      this.pondageEnergyMWh = 0
    }

    // Spill calculation (informational)
    const pondageFull = this.pondageEnergyMWh >= PONDAGE_CAPACITY_MWH
    const spillMWEquiv = pondageFull ? Math.max(0, inflowMW - this.currentProductionMW) : 0

    this.lastBreakdown = {
      productionMW: this.currentProductionMW,
      capacityMW: EFFECTIVE_CAPACITY,
      pondageEnergyMWh: this.pondageEnergyMWh,
      pondageCapacityMWh: PONDAGE_CAPACITY_MWH,
      minGenerationMW: minGenMW,
      spillMWEquiv,
      inflowMW,
    }

    return this.lastBreakdown
  }

  getUpdate(): PowerUpdate {
    return {
      production: this.currentProductionMW,
      consumption: 0,
    }
  }

  get breakdown(): RoRBreakdown | null {
    return this.lastBreakdown
  }

  get productionMW(): number {
    return this.currentProductionMW
  }

  get totalCapacityMW(): number {
    return EFFECTIVE_CAPACITY
  }

  reset(): void {
    this.pondageEnergyMWh = PONDAGE_CAPACITY_MWH * 0.5
    this.currentProductionMW = 0
    this.lastBreakdown = null
  }
}
