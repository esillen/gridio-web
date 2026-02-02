import type { Actor, PowerUpdate } from '../../game/Actor'

export type CHPDispatchMode = 'heat_follow' | 'electric_target' | 'cap_electric'
export type CHPHeatPriority = 'waste_first' | 'biofuel_first'

export interface CHPInput {
  heatDemandMWth: number
  nonChpHeatSupplyMWth?: number
  dispatchMode?: CHPDispatchMode
  electricTargetMW?: number
  heatPriority?: CHPHeatPriority
  electricCurtailmentFrac01?: number
  biofuelAvailability01?: number
  wasteAvailability01?: number
}

export interface CHPBreakdown {
  productionMW: number
  wasteElectricMW: number
  biofuelElectricMW: number
  wasteHeatMWth: number
  biofuelHeatMWth: number
  totalHeatMWth: number
  wasteElectricCapacityMW: number
  biofuelElectricCapacityMW: number
}

const BIOFUEL = {
  electricCapacityMW: 2800.0,
  heatCapacityMWth: 6000.0,
  minLoadFrac: 0.20,
  pToHRatio: 0.42,
  condensingExtraElecFracOfCap: 0.08,
  condensingAllowedIfHeatLoadLowFrac: 0.35,
  rampUpMWPerS: 6.0,
  rampDownMWPerS: 8.0,
  netElectricLossFactor: 0.98,
}

const WASTE = {
  electricCapacityMW: 1200.0,
  heatCapacityMWth: 5200.0,
  mustRunFrac: 0.55,
  minLoadFrac: 0.45,
  pToHRatio: 0.23,
  rampUpMWPerS: 3.0,
  rampDownMWPerS: 4.0,
  netElectricLossFactor: 0.985,
}

const DEFAULT_AVAILABILITY = 0.98

function clamp(x: number, min: number, max: number): number {
  return Math.min(Math.max(x, min), max)
}

function clamp01(x: number): number {
  return clamp(x, 0, 1)
}

export class BiofuelWasteCHPModel implements Actor {
  id: string
  name: string

  private wasteElectricMW = 0
  private biofuelElectricMW = 0
  private wasteHeatMWth = 0
  private biofuelHeatMWth = 0
  private lastBreakdown: CHPBreakdown | null = null

  constructor(id: string = 'chp-biofuel-waste', name: string = 'Biofuel & Waste CHP') {
    this.id = id
    this.name = name
  }

  tick(input: CHPInput): CHPBreakdown {
    const dt = 1.0

    // Availability
    const bioAvail = clamp01(input.biofuelAvailability01 ?? DEFAULT_AVAILABILITY)
    const wasAvail = clamp01(input.wasteAvailability01 ?? DEFAULT_AVAILABILITY)
    const elecCurtailFactor = clamp(1 - (input.electricCurtailmentFrac01 ?? 0), 0, 1)

    // Heat needed from CHP
    const heatNeededMWth = Math.max(0, input.heatDemandMWth - (input.nonChpHeatSupplyMWth ?? 0))

    // Priority
    const wasteFirst = (input.heatPriority ?? 'waste_first') === 'waste_first'

    // Waste CHP heat
    const wasteHeatMinMWth = WASTE.heatCapacityMWth * WASTE.mustRunFrac * wasAvail
    const wasteHeatCapMWth = WASTE.heatCapacityMWth * wasAvail

    let wasteHeatTargetMWth: number
    if (wasteFirst) {
      wasteHeatTargetMWth = clamp(heatNeededMWth, wasteHeatMinMWth, wasteHeatCapMWth)
    } else {
      wasteHeatTargetMWth = wasteHeatMinMWth
    }

    // Remaining heat after waste
    const heatRemainingAfterWasteMWth = Math.max(0, heatNeededMWth - wasteHeatTargetMWth)

    // Biofuel CHP heat
    const bioHeatMinMWth = BIOFUEL.heatCapacityMWth * BIOFUEL.minLoadFrac * bioAvail
    const bioHeatCapMWth = BIOFUEL.heatCapacityMWth * bioAvail

    let bioHeatTargetMWth: number
    if (wasteFirst) {
      bioHeatTargetMWth = clamp(heatRemainingAfterWasteMWth, 0, bioHeatCapMWth)
    } else {
      bioHeatTargetMWth = clamp(heatNeededMWth, bioHeatMinMWth, bioHeatCapMWth)
      const heatRemainingAfterBioMWth = Math.max(0, heatNeededMWth - bioHeatTargetMWth)
      wasteHeatTargetMWth = clamp(heatRemainingAfterBioMWth, wasteHeatMinMWth, wasteHeatCapMWth)
    }

    // Convert heat to ideal electricity
    let wasteElecIdealMW = wasteHeatTargetMWth * WASTE.pToHRatio
    let bioElecIdealMW = bioHeatTargetMWth * BIOFUEL.pToHRatio

    // Condensing extra for biofuel when heat load is low
    const bioHeatLoadFrac = bioHeatCapMWth > 0 ? bioHeatTargetMWth / bioHeatCapMWth : 0
    const condensingAllowed = bioHeatLoadFrac <= BIOFUEL.condensingAllowedIfHeatLoadLowFrac
    let bioCondensingExtraMW = 0
    if (condensingAllowed && input.dispatchMode === 'electric_target') {
      bioCondensingExtraMW = BIOFUEL.electricCapacityMW * BIOFUEL.condensingExtraElecFracOfCap * bioAvail
    }

    // Apply electric caps and losses
    const wasteElecCapMW = WASTE.electricCapacityMW * wasAvail
    const bioElecCapMW = BIOFUEL.electricCapacityMW * bioAvail

    let wasteElecTargetMW = Math.min(wasteElecCapMW, wasteElecIdealMW) * WASTE.netElectricLossFactor
    let bioElecTargetMW = Math.min(bioElecCapMW, bioElecIdealMW + bioCondensingExtraMW) * BIOFUEL.netElectricLossFactor

    let totalElecTargetMW = (wasteElecTargetMW + bioElecTargetMW) * elecCurtailFactor

    // Dispatch mode adjustments
    if (input.dispatchMode === 'cap_electric' && input.electricTargetMW !== undefined) {
      const capMW = Math.max(0, input.electricTargetMW)
      if (totalElecTargetMW > 1e-6) {
        const scale = Math.min(1.0, capMW / totalElecTargetMW)
        wasteElecTargetMW *= scale
        bioElecTargetMW *= scale
      }
    } else if (input.dispatchMode === 'electric_target' && input.electricTargetMW !== undefined) {
      const targetMW = Math.max(0, input.electricTargetMW)
      if (totalElecTargetMW > targetMW) {
        const scale = targetMW / totalElecTargetMW
        wasteElecTargetMW *= scale
        bioElecTargetMW *= scale
      }
    }

    // Ramp toward targets
    const wasteDelta = wasteElecTargetMW - this.wasteElectricMW
    const wasteDeltaLimited = wasteDelta >= 0
      ? Math.min(wasteDelta, WASTE.rampUpMWPerS * dt)
      : Math.max(wasteDelta, -WASTE.rampDownMWPerS * dt)
    this.wasteElectricMW += wasteDeltaLimited

    const bioDelta = bioElecTargetMW - this.biofuelElectricMW
    const bioDeltaLimited = bioDelta >= 0
      ? Math.min(bioDelta, BIOFUEL.rampUpMWPerS * dt)
      : Math.max(bioDelta, -BIOFUEL.rampDownMWPerS * dt)
    this.biofuelElectricMW += bioDeltaLimited

    // Back-calculate heat from actual electricity
    this.wasteHeatMWth = clamp(
      this.wasteElectricMW / Math.max(1e-6, WASTE.pToHRatio),
      wasteHeatMinMWth,
      wasteHeatCapMWth
    )
    this.biofuelHeatMWth = clamp(
      this.biofuelElectricMW / Math.max(1e-6, BIOFUEL.pToHRatio),
      0,
      bioHeatCapMWth
    )

    const productionMW = this.wasteElectricMW + this.biofuelElectricMW

    this.lastBreakdown = {
      productionMW,
      wasteElectricMW: this.wasteElectricMW,
      biofuelElectricMW: this.biofuelElectricMW,
      wasteHeatMWth: this.wasteHeatMWth,
      biofuelHeatMWth: this.biofuelHeatMWth,
      totalHeatMWth: this.wasteHeatMWth + this.biofuelHeatMWth,
      wasteElectricCapacityMW: wasteElecCapMW,
      biofuelElectricCapacityMW: bioElecCapMW,
    }

    return this.lastBreakdown
  }

  getUpdate(): PowerUpdate {
    return {
      production: this.wasteElectricMW + this.biofuelElectricMW,
      consumption: 0,
    }
  }

  get breakdown(): CHPBreakdown | null {
    return this.lastBreakdown
  }

  get productionMW(): number {
    return this.wasteElectricMW + this.biofuelElectricMW
  }

  get totalCapacityMW(): number {
    return WASTE.electricCapacityMW + BIOFUEL.electricCapacityMW
  }

  reset(): void {
    this.wasteElectricMW = 0
    this.biofuelElectricMW = 0
    this.wasteHeatMWth = 0
    this.biofuelHeatMWth = 0
    this.lastBreakdown = null
  }
}
