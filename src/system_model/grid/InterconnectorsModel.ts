import type { Actor, PowerUpdate } from '../../game/Actor'

export type InterconnectorDispatchMode = 'auto_balance' | 'follow_target'

export interface InterconnectorInput {
  localHour?: number
  totalGenerationMW: number
  totalConsumptionMW: number
  frequencyHz: number
  rocofHzPerS?: number
  dispatchMode?: InterconnectorDispatchMode
  targetNetImportMW?: number
  neighborTightness01?: number
  neighborSurplus01?: number
  priceSpreadEurPerMWh?: number
  availability01?: number
}

export interface InterconnectorBreakdown {
  netImportMW: number
  importCapMW: number
  exportCapMW: number
  imbalanceExcludingInterconnectorsMW: number
  targetRawMW: number
  targetSmoothMW: number
  isImporting: boolean
  isExporting: boolean
}

const IMPORT_MAX_MW = 7000.0
const EXPORT_MAX_MW = 7000.0
const RAMP_MW_PER_S = 50.0

const CONTROL = {
  freqNomHz: 50.0,
  KpMWPerHz: 12000.0,
  KimbMWPerMW: 0.60,
  deadbandMW: 80.0,
  deadbandHz: 0.01,
  tauTargetS: 10.0,
}

const MARKET_LIMITS = {
  importReductionAtTightness1: 0.70,
  exportReductionAtSurplus0: 0.50,
}

function clamp(x: number, min: number, max: number): number {
  return Math.min(Math.max(x, min), max)
}

function clamp01(x: number): number {
  return clamp(x, 0, 1)
}

function rampToward(current: number, target: number, ramp: number, dt: number): number {
  const delta = target - current
  const maxStep = ramp * dt
  return current + clamp(delta, -maxStep, maxStep)
}

export class InterconnectorsModel implements Actor {
  id: string
  name: string

  private _netImportMW = 0
  private _lastTargetMW = 0
  private _lastBreakdown: InterconnectorBreakdown | null = null

  constructor(id: string = 'interconnectors', name: string = 'Interconnectors') {
    this.id = id
    this.name = name
  }

  tick(input: InterconnectorInput): InterconnectorBreakdown {
    const dt = 1.0

    const avail = clamp01(input.availability01 ?? 1.0)

    // Net imbalance excluding interconnector action
    const imbalanceMW = input.totalGenerationMW - input.totalConsumptionMW

    // Market-derated caps
    const tight = clamp01(input.neighborTightness01 ?? 0.2)
    const surplus = clamp01(input.neighborSurplus01 ?? 0.5)

    const importCapMW = IMPORT_MAX_MW * avail * (1 - MARKET_LIMITS.importReductionAtTightness1 * tight)
    const exportCapMW = EXPORT_MAX_MW * avail * (1 - MARKET_LIMITS.exportReductionAtSurplus0 * (1 - surplus))

    // Determine target in selected mode
    let targetRawMW: number

    if (input.dispatchMode === 'follow_target') {
      targetRawMW = clamp(input.targetNetImportMW ?? 0, -exportCapMW, importCapMW)
    } else {
      // auto_balance
      const dfHz = CONTROL.freqNomHz - input.frequencyHz

      const reqFromFreqMW = Math.abs(dfHz) <= CONTROL.deadbandHz
        ? 0.0
        : CONTROL.KpMWPerHz * dfHz

      const reqFromImbMW = Math.abs(imbalanceMW) <= CONTROL.deadbandMW
        ? 0.0
        : -CONTROL.KimbMWPerMW * imbalanceMW

      targetRawMW = clamp(reqFromFreqMW + reqFromImbMW, -exportCapMW, importCapMW)
    }

    // Smooth target
    this._lastTargetMW += (targetRawMW - this._lastTargetMW) * (dt / CONTROL.tauTargetS)

    // Ramp actual net import/export toward smoothed target
    this._netImportMW = rampToward(this._netImportMW, this._lastTargetMW, RAMP_MW_PER_S, dt)

    this._lastBreakdown = {
      netImportMW: this._netImportMW,
      importCapMW,
      exportCapMW,
      imbalanceExcludingInterconnectorsMW: imbalanceMW,
      targetRawMW,
      targetSmoothMW: this._lastTargetMW,
      isImporting: this._netImportMW > 0,
      isExporting: this._netImportMW < 0,
    }

    return this._lastBreakdown
  }

  getUpdate(): PowerUpdate {
    return {
      production: this._netImportMW,
      consumption: 0,
    }
  }

  get breakdown(): InterconnectorBreakdown | null {
    return this._lastBreakdown
  }

  get netImportMW(): number {
    return this._netImportMW
  }

  get productionMW(): number {
    return this._netImportMW
  }

  get isImporting(): boolean {
    return this._netImportMW > 0
  }

  get isExporting(): boolean {
    return this._netImportMW < 0
  }

  get importCapacityMW(): number {
    return IMPORT_MAX_MW
  }

  get exportCapacityMW(): number {
    return EXPORT_MAX_MW
  }

  reset(): void {
    this._netImportMW = 0
    this._lastTargetMW = 0
    this._lastBreakdown = null
  }
}
