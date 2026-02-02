import type { Actor, PowerUpdate } from '../../game/Actor'

export interface GridLossesInput {
  totalConsumptionMW: number
  totalGenerationMW?: number
  netImportMW?: number
  internalTransferSe1Se2MW?: number
  internalTransferSe2Se3MW?: number
  internalTransferSe3Se4MW?: number
}

export interface GridLossesBreakdown {
  consumptionMW: number
  fixedLossesMW: number
  variableLossesMW: number
  effectiveFlowMW: number
  flowSmoothMW: number
}

const CONSTANTS = {
  avgLossFractionOfLoad: 0.065,
  fixedLossFractionOfAvg: 0.30,
  typicalAvgSystemLoadMW: 14000.0,
  internalTransferWeight: 0.35,
  tauFlowSmoothS: 30.0,
  tauLossesSmoothS: 10.0,
}

// Derived constants
const AVG_LOSSES_MW = CONSTANTS.typicalAvgSystemLoadMW * CONSTANTS.avgLossFractionOfLoad
const FIXED_LOSSES_MW = AVG_LOSSES_MW * CONSTANTS.fixedLossFractionOfAvg
const VARIABLE_LOSSES_AT_TYPICAL = AVG_LOSSES_MW - FIXED_LOSSES_MW
const K_QUADRATIC = VARIABLE_LOSSES_AT_TYPICAL / (CONSTANTS.typicalAvgSystemLoadMW * CONSTANTS.typicalAvgSystemLoadMW)

export class GridLossesModel implements Actor {
  id: string
  name: string

  private flowSmoothMW = CONSTANTS.typicalAvgSystemLoadMW
  private lastLossesMW = AVG_LOSSES_MW
  private lastBreakdown: GridLossesBreakdown | null = null

  constructor(id: string = 'grid-losses', name: string = 'Grid Losses') {
    this.id = id
    this.name = name
  }

  tick(input: GridLossesInput): GridLossesBreakdown {
    const dt = 1.0

    // Base flow from consumption
    const baseFlowMW = Math.max(0, input.totalConsumptionMW)

    // Internal transfers add extra flow stress
    const internalTransferAbsMW = Math.max(0,
      Math.abs(input.internalTransferSe1Se2MW ?? 0)
      + Math.abs(input.internalTransferSe2Se3MW ?? 0)
      + Math.abs(input.internalTransferSe3Se4MW ?? 0)
    )

    const effectiveFlowMW = baseFlowMW + CONSTANTS.internalTransferWeight * internalTransferAbsMW

    // Smooth flow
    this.flowSmoothMW += (effectiveFlowMW - this.flowSmoothMW) * (dt / CONSTANTS.tauFlowSmoothS)

    // Compute losses: fixed + quadratic variable
    const variableLossesMW = K_QUADRATIC * this.flowSmoothMW * this.flowSmoothMW
    const lossesInstantMW = FIXED_LOSSES_MW + variableLossesMW

    // Smooth losses
    this.lastLossesMW += (lossesInstantMW - this.lastLossesMW) * (dt / CONSTANTS.tauLossesSmoothS)

    this.lastBreakdown = {
      consumptionMW: this.lastLossesMW,
      fixedLossesMW: FIXED_LOSSES_MW,
      variableLossesMW,
      effectiveFlowMW,
      flowSmoothMW: this.flowSmoothMW,
    }

    return this.lastBreakdown
  }

  getUpdate(): PowerUpdate {
    return {
      production: 0,
      consumption: this.lastLossesMW,
    }
  }

  get breakdown(): GridLossesBreakdown | null {
    return this.lastBreakdown
  }

  get consumptionMW(): number {
    return this.lastLossesMW
  }

  reset(): void {
    this.flowSmoothMW = CONSTANTS.typicalAvgSystemLoadMW
    this.lastLossesMW = AVG_LOSSES_MW
    this.lastBreakdown = null
  }
}
