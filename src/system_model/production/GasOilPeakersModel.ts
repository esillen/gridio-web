import type { Actor, PowerUpdate } from '../../game/Actor'

export type PeakersDispatchMode = 'off' | 'follow_target'

export interface PeakersInput {
  dispatchMode?: PeakersDispatchMode
  targetProductionMW?: number
  availability01?: number
}

export interface PeakersBreakdown {
  productionMW: number
  online: boolean
  startTimerS: number
  availableCapacityMW: number
  targetMW: number
}

const INSTALLED_CAPACITY_MW = 3500.0
const MIN_STABLE_MW = 300.0
const RAMP_UP_MW_PER_S = 40.0
const RAMP_DOWN_MW_PER_S = 60.0
const START_DELAY_S = 600.0

function clamp(x: number, min: number, max: number): number {
  return Math.min(Math.max(x, min), max)
}

function clamp01(x: number): number {
  return clamp(x, 0, 1)
}

export class GasOilPeakersModel implements Actor {
  id: string
  name: string

  private _online = false
  private _productionMW = 0
  private _startTimerS = 0
  private _lastBreakdown: PeakersBreakdown | null = null

  constructor(id: string = 'gas-oil-peakers', name: string = 'Gas/Oil Peakers') {
    this.id = id
    this.name = name
  }

  tick(input: PeakersInput): PeakersBreakdown {
    const dt = 1.0

    const avail = clamp01(input.availability01 ?? 1.0)
    const capMW = INSTALLED_CAPACITY_MW * avail

    const wantOn = input.dispatchMode === 'follow_target' 
      && (input.targetProductionMW ?? 0) > 0

    // Handle start-up
    if (wantOn && !this._online) {
      this._startTimerS += dt
      if (this._startTimerS >= START_DELAY_S) {
        this._online = true
        this._startTimerS = 0
      }
    }

    // Handle shutdown
    if (!wantOn && this._online) {
      this._online = false
      this._productionMW = 0
      this._startTimerS = 0
    }

    // Determine target MW if online
    let targetMW: number
    if (this._online) {
      targetMW = clamp(input.targetProductionMW ?? 0, MIN_STABLE_MW, capMW)
    } else {
      targetMW = 0
    }

    // Ramp-limited output
    const delta = targetMW - this._productionMW
    const deltaLimited = delta >= 0
      ? Math.min(delta, RAMP_UP_MW_PER_S * dt)
      : Math.max(delta, -RAMP_DOWN_MW_PER_S * dt)

    this._productionMW += deltaLimited

    this._lastBreakdown = {
      productionMW: this._productionMW,
      online: this._online,
      startTimerS: this._startTimerS,
      availableCapacityMW: capMW,
      targetMW,
    }

    return this._lastBreakdown
  }

  getUpdate(): PowerUpdate {
    return {
      production: this._productionMW,
      consumption: 0,
    }
  }

  get breakdown(): PeakersBreakdown | null {
    return this._lastBreakdown
  }

  get productionMW(): number {
    return this._productionMW
  }

  get online(): boolean {
    return this._online
  }

  get installedCapacityMW(): number {
    return INSTALLED_CAPACITY_MW
  }

  get isStarting(): boolean {
    return this._startTimerS > 0 && !this._online
  }

  get startProgress01(): number {
    return this._startTimerS / START_DELAY_S
  }

  reset(): void {
    this._online = false
    this._productionMW = 0
    this._startTimerS = 0
    this._lastBreakdown = null
  }
}
