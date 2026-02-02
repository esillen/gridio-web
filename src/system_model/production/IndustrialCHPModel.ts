import type { Actor, PowerUpdate } from '../../game/Actor'

export type IndustrialCHPDispatchMode = 'must_run' | 'cap_at_target'

export interface IndustrialCHPInput {
  industrialActivity01?: number
  dispatchMode?: IndustrialCHPDispatchMode
  targetProductionMW?: number
  availability01?: number
}

export interface IndustrialCHPBreakdown {
  productionMW: number
  baseMW: number
  minMW: number
  maxMW: number
  availabilityFactor: number
  activityFactor: number
}

const ANNUAL_ENERGY_TWH = 6.5
const AVG_MW = (ANNUAL_ENERGY_TWH * 1_000_000) / 8760.0
const MAX_MW = AVG_MW * 1.20
const MIN_MW = AVG_MW * 0.70
const RAMP_UP_MW_PER_S = 2.0
const RAMP_DOWN_MW_PER_S = 3.0

function clamp(x: number, min: number, max: number): number {
  return Math.min(Math.max(x, min), max)
}

function clamp01(x: number): number {
  return clamp(x, 0, 1)
}

export class IndustrialCHPModel implements Actor {
  id: string
  name: string

  private _productionMW = AVG_MW
  private _lastBreakdown: IndustrialCHPBreakdown | null = null

  constructor(id: string = 'industrial-chp', name: string = 'Industrial CHP') {
    this.id = id
    this.name = name
  }

  tick(input: IndustrialCHPInput): IndustrialCHPBreakdown {
    const dt = 1.0

    const avail = clamp01(input.availability01 ?? 1.0)
    const act = clamp01(input.industrialActivity01 ?? 1.0)

    // Baseline process-driven output
    const baseMW = AVG_MW * act * avail
    const minAllowedMW = MIN_MW * act * avail
    const maxAllowedMW = MAX_MW * act * avail

    // Dispatcher interaction
    let targetMW: number
    if (input.dispatchMode === 'cap_at_target' && input.targetProductionMW !== undefined) {
      targetMW = clamp(input.targetProductionMW, minAllowedMW, maxAllowedMW)
    } else {
      targetMW = baseMW
    }

    // Ramp-limited movement
    const delta = targetMW - this._productionMW
    const deltaLimited = delta >= 0
      ? Math.min(delta, RAMP_UP_MW_PER_S * dt)
      : Math.max(delta, -RAMP_DOWN_MW_PER_S * dt)

    this._productionMW += deltaLimited

    this._lastBreakdown = {
      productionMW: this._productionMW,
      baseMW,
      minMW: minAllowedMW,
      maxMW: maxAllowedMW,
      availabilityFactor: avail,
      activityFactor: act,
    }

    return this._lastBreakdown
  }

  getUpdate(): PowerUpdate {
    return {
      production: this._productionMW,
      consumption: 0,
    }
  }

  get breakdown(): IndustrialCHPBreakdown | null {
    return this._lastBreakdown
  }

  get productionMW(): number {
    return this._productionMW
  }

  get avgCapacityMW(): number {
    return AVG_MW
  }

  get maxCapacityMW(): number {
    return MAX_MW
  }

  reset(): void {
    this._productionMW = AVG_MW
    this._lastBreakdown = null
  }
}
