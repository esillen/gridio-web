export interface BESSConfig {
  id: string
  name: string
  maxPowerMW: number
  capacityMWh: number
  roundTripEfficiency: number
  initialSoC01: number
}

export type BESSMode = 'charge' | 'discharge'
export type BESSMarket = 'da' | 'fcr' | 'inactive'

export interface BESSState {
  soc01: number
  currentPowerMW: number
  mode: BESSMode | null
  market: BESSMarket
  energyChargedMWh: number
  energyDischargedMWh: number
}

export interface BESSDispatchCommand {
  targetPowerMW: number
  source: 'da' | 'fcr' | 'manual'
}

export interface BESSTickResult {
  actualPowerMW: number
  deltaEnergyMWh: number
  soc01: number
  clipped: boolean
}

function clamp(x: number, min: number, max: number): number {
  return Math.min(Math.max(x, min), max)
}

export class BESSUnit {
  readonly config: BESSConfig
  private _state: BESSState

  constructor(config: BESSConfig) {
    this.config = config
    this._state = {
      soc01: config.initialSoC01,
      currentPowerMW: 0,
      mode: null,
      market: 'da',
      energyChargedMWh: 0,
      energyDischargedMWh: 0,
    }
  }

  tick(dtS: number, command?: BESSDispatchCommand): BESSTickResult {
    const dtH = dtS / 3600
    let targetMW = command?.targetPowerMW ?? 0

    // Clamp to power limits
    targetMW = clamp(targetMW, -this.config.maxPowerMW, this.config.maxPowerMW)

    // Calculate energy change
    // Positive power = discharge (output to grid)
    // Negative power = charge (input from grid)
    let deltaEnergyMWh: number
    if (targetMW > 0) {
      // Discharging
      deltaEnergyMWh = -targetMW * dtH // Negative = losing stored energy
    } else {
      // Charging - apply efficiency loss
      deltaEnergyMWh = -targetMW * dtH * Math.sqrt(this.config.roundTripEfficiency)
    }

    // Check SoC limits
    const currentEnergyMWh = this._state.soc01 * this.config.capacityMWh
    const newEnergyMWh = currentEnergyMWh + deltaEnergyMWh
    
    let clipped = false
    let actualDeltaMWh = deltaEnergyMWh
    let actualPowerMW = targetMW

    if (newEnergyMWh > this.config.capacityMWh) {
      // Would overfill - clip
      actualDeltaMWh = this.config.capacityMWh - currentEnergyMWh
      actualPowerMW = -actualDeltaMWh / dtH / Math.sqrt(this.config.roundTripEfficiency)
      clipped = true
    } else if (newEnergyMWh < 0) {
      // Would overdrain - clip
      actualDeltaMWh = -currentEnergyMWh
      actualPowerMW = -actualDeltaMWh / dtH
      clipped = true
    }

    // Apply changes
    const finalEnergyMWh = currentEnergyMWh + actualDeltaMWh
    this._state.soc01 = clamp(finalEnergyMWh / this.config.capacityMWh, 0, 1)
    this._state.currentPowerMW = actualPowerMW

    // Track cumulative energy
    if (actualPowerMW > 0) {
      this._state.energyDischargedMWh += actualPowerMW * dtH
    } else {
      this._state.energyChargedMWh += -actualPowerMW * dtH
    }

    return {
      actualPowerMW,
      deltaEnergyMWh: actualDeltaMWh,
      soc01: this._state.soc01,
      clipped,
    }
  }

  get state(): BESSState {
    return { ...this._state }
  }

  get soc01(): number {
    return this._state.soc01
  }

  get currentPowerMW(): number {
    return this._state.currentPowerMW
  }

  get mode(): BESSMode | null {
    return this._state.mode
  }

  set mode(m: BESSMode | null) {
    this._state.mode = m
  }

  get market(): BESSMarket {
    return this._state.market
  }

  set market(m: BESSMarket) {
    this._state.market = m
  }

  get availableChargeMW(): number {
    return this._state.soc01 < 1 ? this.config.maxPowerMW : 0
  }

  get availableDischargeMW(): number {
    return this._state.soc01 > 0 ? this.config.maxPowerMW : 0
  }

  get storedEnergyMWh(): number {
    return this._state.soc01 * this.config.capacityMWh
  }

  get availableEnergyMWh(): number {
    return this.storedEnergyMWh
  }

  get availableCapacityMWh(): number {
    return (1 - this._state.soc01) * this.config.capacityMWh
  }

  reset(): void {
    this._state = {
      soc01: this.config.initialSoC01,
      currentPowerMW: 0,
      mode: null,
      market: 'da',
      energyChargedMWh: 0,
      energyDischargedMWh: 0,
    }
  }
}

export class BESSFleet {
  readonly units: BESSUnit[]

  constructor(configs: BESSConfig[]) {
    this.units = configs.map(c => new BESSUnit(c))
  }

  get totalMaxPowerMW(): number {
    return this.units.reduce((sum, u) => sum + u.config.maxPowerMW, 0)
  }

  get totalCapacityMWh(): number {
    return this.units.reduce((sum, u) => sum + u.config.capacityMWh, 0)
  }

  get totalStoredEnergyMWh(): number {
    return this.units.reduce((sum, u) => sum + u.storedEnergyMWh, 0)
  }

  get aggregateSoC01(): number {
    const total = this.totalCapacityMWh
    return total > 0 ? this.totalStoredEnergyMWh / total : 0
  }

  get totalCurrentPowerMW(): number {
    return this.units.reduce((sum, u) => sum + u.currentPowerMW, 0)
  }

  get totalAvailableDischargeMW(): number {
    return this.units.reduce((sum, u) => sum + u.availableDischargeMW, 0)
  }

  get totalAvailableChargeMW(): number {
    return this.units.reduce((sum, u) => sum + u.availableChargeMW, 0)
  }

  tickAll(dtS: number, commands: Map<string, BESSDispatchCommand>): Map<string, BESSTickResult> {
    const results = new Map<string, BESSTickResult>()
    for (const unit of this.units) {
      const cmd = commands.get(unit.config.id)
      results.set(unit.config.id, unit.tick(dtS, cmd))
    }
    return results
  }

  reset(): void {
    for (const unit of this.units) {
      unit.reset()
    }
  }
}

export const DEFAULT_BESS_FLEET: BESSConfig[] = [
  { id: 'bess-1', name: 'BESS Alpha', maxPowerMW: 10, capacityMWh: 20, roundTripEfficiency: 0.90, initialSoC01: 0.5 },
  { id: 'bess-2', name: 'BESS Beta', maxPowerMW: 20, capacityMWh: 20, roundTripEfficiency: 0.90, initialSoC01: 0.5 },
  { id: 'bess-3', name: 'BESS Gamma', maxPowerMW: 5, capacityMWh: 20, roundTripEfficiency: 0.90, initialSoC01: 0.5 },
  { id: 'bess-4', name: 'BESS Delta', maxPowerMW: 10, capacityMWh: 10, roundTripEfficiency: 0.90, initialSoC01: 0.5 },
]
