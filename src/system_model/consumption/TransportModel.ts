import type { Actor, PowerUpdate } from '../../game/Actor'

export interface TransportInput {
  localHour: number
  localMinute: number
  dayOfWeek: number  // 0=Mon ... 6=Sun
  temperatureC: number
  gridStress01?: number
  priceSignal01?: number
}

export interface TransportBreakdown {
  consumptionMW: number
  railTotalMW: number
  railTractionMW: number
  railAuxMW: number
  evTotalMW: number
  evHomeMW: number
  evWorkplaceMW: number
  evPublicFastMW: number
}

const RAIL_CONSTANTS = {
  annualEnergyTWhProxy: 2.875,
  tractionShare: 0.75,
  auxShare: 0.25,
  tractionPeakMultiplierWeekday: 1.9,
  tractionPeakMultiplierWeekend: 1.3,
  auxTempRefC: 0,
  auxTempSlopePerC: 0.015,
  tractionNoiseSigmaFrac: 0.04,
  tractionNoiseTauS: 30.0,
  spikeEventRatePerHourWeekday: 8,
  spikeEventRatePerHourWeekend: 4,
  spikeDurationSRange: [10, 40] as [number, number],
  spikeAmplitudeFracRange: [0.03, 0.10] as [number, number],
}

const EV_CONSTANTS = {
  bevCount: 307000,
  avgKmPerCarPerYear: 11260,
  baseKWhPer100km: 21.0,
  winterPenaltyMaxFrac: 0.30,
  winterPenaltyWarmC: 15,
  winterPenaltyColdC: -15,
  dailyRechargeFraction: 0.95,
  maxHomeMW: 2200,
  maxWorkplaceMW: 500,
  maxPublicFastMW: 1200,
  smartChargingMinFraction: 0.40,
  smartChargingStressExponent: 1.6,
  catchupGainPerS: 0.0025,
}

// Derived
const RAIL_AVG_POWER_MW = (RAIL_CONSTANTS.annualEnergyTWhProxy * 1_000_000) / 8760
const AVG_KM_PER_CAR_PER_DAY = EV_CONSTANTS.avgKmPerCarPerYear / 365
const BASE_KWH_PER_KM = EV_CONSTANTS.baseKWhPer100km / 100

function clamp(x: number, min: number, max: number): number {
  return Math.min(Math.max(x, min), max)
}

function clamp01(x: number): number {
  return clamp(x, 0, 1)
}

function gauss(tSeconds: number, centerHours: number, sigmaHours: number): number {
  const centerSeconds = centerHours * 3600
  const sigmaSeconds = sigmaHours * 3600
  return Math.exp(-0.5 * Math.pow((tSeconds - centerSeconds) / sigmaSeconds, 2))
}

function randomNormal(): number {
  let u = 0
  let v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v)
}

// Rail traction profiles
function railTractionProfileWeekday(t: number): number {
  return 0.55 + 0.85 * gauss(t, 8.0, 1.7) + 0.75 * gauss(t, 16.8, 2.2) + 0.20 * gauss(t, 12.0, 4.5)
}

function railTractionProfileWeekend(t: number): number {
  return 0.60 + 0.35 * gauss(t, 11.5, 3.5) + 0.25 * gauss(t, 17.0, 3.5)
}

function railAuxProfile(t: number): number {
  return 0.85 + 0.15 * gauss(t, 13.0, 6.0)
}

// EV profiles
function evHomeProfileWeekday(t: number): number {
  return 0.25 + 0.90 * gauss(t, 20.5, 2.4) + 0.55 * gauss(t, 2.0, 2.8) + 0.20 * gauss(t, 7.0, 1.0)
}

function evWorkplaceProfileWeekday(t: number): number {
  return 0.05 + 0.85 * gauss(t, 10.5, 2.8) + 0.55 * gauss(t, 14.0, 2.5)
}

function evPublicFastProfileWeekday(t: number): number {
  return 0.10 + 0.45 * gauss(t, 12.5, 2.2) + 0.55 * gauss(t, 17.5, 2.0) + 0.25 * gauss(t, 20.5, 1.8)
}

function evHomeProfileWeekend(t: number): number {
  return 0.30 + 0.65 * gauss(t, 21.0, 2.7) + 0.45 * gauss(t, 9.5, 2.5) + 0.30 * gauss(t, 2.0, 3.0)
}

function evWorkplaceProfileWeekend(t: number): number {
  return 0.03 + 0.25 * gauss(t, 12.0, 3.0)
}

function evPublicFastProfileWeekend(t: number): number {
  return 0.08 + 0.55 * gauss(t, 13.5, 3.5) + 0.35 * gauss(t, 18.0, 2.8)
}

export class TransportModel implements Actor {
  id: string
  name: string

  private evEnergyNeedTodayMWh = 0
  private evEnergyDeliveredTodayMWh = 0
  private lastTDayS = -1
  private railNoiseLP = 0
  private railSpikeActiveUntilS = -1
  private railSpikeAmplitudeFrac = 0
  private lastConsumptionMW = 0
  private lastBreakdown: TransportBreakdown | null = null

  constructor(id: string, name: string) {
    this.id = id
    this.name = name
  }

  tick(input: TransportInput): TransportBreakdown {
    const dt = 1.0
    const tDayS = input.localHour * 3600 + input.localMinute * 60
    const isWeekend = input.dayOfWeek >= 5
    const isNewDay = this.lastTDayS >= 0 && this.lastTDayS > tDayS

    // Daily reset for EV energy tracking
    if (isNewDay || this.lastTDayS < 0) {
      const winterPenaltyFrac = clamp01(
        (EV_CONSTANTS.winterPenaltyWarmC - input.temperatureC) /
        (EV_CONSTANTS.winterPenaltyWarmC - EV_CONSTANTS.winterPenaltyColdC)
      ) * EV_CONSTANTS.winterPenaltyMaxFrac
      const effectiveKWhPerKm = BASE_KWH_PER_KM * (1 + winterPenaltyFrac)
      
      this.evEnergyNeedTodayMWh = (
        EV_CONSTANTS.bevCount * AVG_KM_PER_CAR_PER_DAY * effectiveKWhPerKm * EV_CONSTANTS.dailyRechargeFraction
      ) / 1000
      this.evEnergyDeliveredTodayMWh = 0
      this.railNoiseLP = 0
      this.railSpikeActiveUntilS = -1
      this.railSpikeAmplitudeFrac = 0
    }
    this.lastTDayS = tDayS

    // Rail demand
    const railTractionBaseMW = RAIL_AVG_POWER_MW * RAIL_CONSTANTS.tractionShare
    const railAuxBaseMW = RAIL_AVG_POWER_MW * RAIL_CONSTANTS.auxShare

    const tractionProfileWeight = isWeekend
      ? railTractionProfileWeekend(tDayS)
      : railTractionProfileWeekday(tDayS)
    const tractionPeakMult = isWeekend
      ? RAIL_CONSTANTS.tractionPeakMultiplierWeekend
      : RAIL_CONSTANTS.tractionPeakMultiplierWeekday

    const tractionNoiseTarget = randomNormal() * RAIL_CONSTANTS.tractionNoiseSigmaFrac
    this.railNoiseLP += (tractionNoiseTarget - this.railNoiseLP) * (dt / RAIL_CONSTANTS.tractionNoiseTauS)

    const spikeRatePerHour = isWeekend
      ? RAIL_CONSTANTS.spikeEventRatePerHourWeekend
      : RAIL_CONSTANTS.spikeEventRatePerHourWeekday
    const spikeRatePerS = spikeRatePerHour / 3600

    if (tDayS > this.railSpikeActiveUntilS && Math.random() < spikeRatePerS) {
      const [durMin, durMax] = RAIL_CONSTANTS.spikeDurationSRange
      const [ampMin, ampMax] = RAIL_CONSTANTS.spikeAmplitudeFracRange
      const durationS = durMin + Math.random() * (durMax - durMin)
      this.railSpikeActiveUntilS = tDayS + durationS
      this.railSpikeAmplitudeFrac = ampMin + Math.random() * (ampMax - ampMin)
    }

    const spikeFactor = tDayS <= this.railSpikeActiveUntilS ? 1 + this.railSpikeAmplitudeFrac : 1.0
    const noiseFactor = 1 + this.railNoiseLP

    const railTractionMW = Math.max(0, railTractionBaseMW * tractionPeakMult * tractionProfileWeight * noiseFactor * spikeFactor)

    const auxProfileWeight = railAuxProfile(tDayS)
    const auxTempMult = 1 + RAIL_CONSTANTS.auxTempSlopePerC * Math.max(0, RAIL_CONSTANTS.auxTempRefC - input.temperatureC)
    const railAuxMW = Math.max(0, railAuxBaseMW * auxProfileWeight * auxTempMult)

    const railTotalMW = railTractionMW + railAuxMW

    // EV charging
    const remainingS = Math.max(1, 86400 - tDayS)
    const remainingH = remainingS / 3600
    const evEnergyRemainingMWh = Math.max(0, this.evEnergyNeedTodayMWh - this.evEnergyDeliveredTodayMWh)

    // Profile weights
    const homeW = isWeekend ? evHomeProfileWeekend(tDayS) : evHomeProfileWeekday(tDayS)
    const workW = isWeekend ? evWorkplaceProfileWeekend(tDayS) : evWorkplaceProfileWeekday(tDayS)
    const fastW = isWeekend ? evPublicFastProfileWeekend(tDayS) : evPublicFastProfileWeekday(tDayS)

    const wSum = Math.max(1e-6, homeW + workW + fastW)
    const shareHome = homeW / wSum
    const shareWork = workW / wSum
    const shareFast = fastW / wSum

    // Planned power to finish today
    const avgMWNeeded = evEnergyRemainingMWh / remainingH

    // Smart charging throttle
    const gridStress = input.gridStress01 ?? 0
    const priceSignal = input.priceSignal01 ?? 0
    const smartSignal = clamp01(Math.max(gridStress, priceSignal))
    const throttle = Math.max(
      EV_CONSTANTS.smartChargingMinFraction,
      Math.pow(1 - smartSignal, EV_CONSTANTS.smartChargingStressExponent)
    )

    const remainingFrac = remainingH / 24
    const errorMWh = evEnergyRemainingMWh - this.evEnergyNeedTodayMWh * remainingFrac
    const errorMW = remainingH > 0 ? errorMWh / remainingH : 0
    const catchupMW = errorMW * EV_CONSTANTS.catchupGainPerS * dt

    const plannedTotalMW = Math.max(0, (avgMWNeeded + catchupMW) * throttle)

    // Allocate and cap
    let evHomeMW = Math.min(EV_CONSTANTS.maxHomeMW, plannedTotalMW * shareHome)
    let evWorkplaceMW = Math.min(EV_CONSTANTS.maxWorkplaceMW, plannedTotalMW * shareWork)
    let evPublicFastMW = Math.min(EV_CONSTANTS.maxPublicFastMW, plannedTotalMW * shareFast)

    let evTotalMWCapped = evHomeMW + evWorkplaceMW + evPublicFastMW

    // Don't over-deliver
    const deliverableMWhThisStep = evTotalMWCapped / 3600
    const actualDeliverMWh = Math.min(deliverableMWhThisStep, evEnergyRemainingMWh)
    const scale = deliverableMWhThisStep > 1e-9 ? actualDeliverMWh / deliverableMWhThisStep : 0

    evHomeMW *= scale
    evWorkplaceMW *= scale
    evPublicFastMW *= scale
    const evTotalMW = evHomeMW + evWorkplaceMW + evPublicFastMW

    // Update delivered energy
    this.evEnergyDeliveredTodayMWh += evTotalMW / 3600

    const consumptionInstantMW = railTotalMW + evTotalMW

    this.lastConsumptionMW = consumptionInstantMW
    this.lastBreakdown = {
      consumptionMW: consumptionInstantMW,
      railTotalMW,
      railTractionMW,
      railAuxMW,
      evTotalMW,
      evHomeMW,
      evWorkplaceMW,
      evPublicFastMW,
    }

    return this.lastBreakdown
  }

  forecast24h(input: TransportInput, stepS: number): { stepS: number; consumptionMW: number[] } {
    const out: number[] = []
    let evEnergyNeedTodayMWh = this.evEnergyNeedTodayMWh
    let evEnergyDeliveredTodayMWh = this.evEnergyDeliveredTodayMWh
    let lastTDayS = input.localHour * 3600 + input.localMinute * 60
    const startTDayS = lastTDayS

    for (let i = 0; i < Math.floor(86400 / stepS); i++) {
      const tOffsetS = i * stepS
      const tDayS = (startTDayS + tOffsetS) % 86400
      const dayOffset = Math.floor((startTDayS + tOffsetS) / 86400)
      const dayOfWeek = (input.dayOfWeek + dayOffset) % 7
      const isWeekend = dayOfWeek >= 5
      const isNewDay = tDayS < lastTDayS
      lastTDayS = tDayS

      if (isNewDay || i === 0) {
        const winterPenaltyFrac = clamp01(
          (EV_CONSTANTS.winterPenaltyWarmC - input.temperatureC) /
          (EV_CONSTANTS.winterPenaltyWarmC - EV_CONSTANTS.winterPenaltyColdC)
        ) * EV_CONSTANTS.winterPenaltyMaxFrac
        const effectiveKWhPerKm = BASE_KWH_PER_KM * (1 + winterPenaltyFrac)

        evEnergyNeedTodayMWh = (
          EV_CONSTANTS.bevCount * AVG_KM_PER_CAR_PER_DAY * effectiveKWhPerKm * EV_CONSTANTS.dailyRechargeFraction
        ) / 1000
        evEnergyDeliveredTodayMWh = 0
      }

      const railTractionBaseMW = RAIL_AVG_POWER_MW * RAIL_CONSTANTS.tractionShare
      const railAuxBaseMW = RAIL_AVG_POWER_MW * RAIL_CONSTANTS.auxShare

      const tractionProfileWeight = isWeekend
        ? railTractionProfileWeekend(tDayS)
        : railTractionProfileWeekday(tDayS)
      const tractionPeakMult = isWeekend
        ? RAIL_CONSTANTS.tractionPeakMultiplierWeekend
        : RAIL_CONSTANTS.tractionPeakMultiplierWeekday
      const railTractionMW = Math.max(0, railTractionBaseMW * tractionPeakMult * tractionProfileWeight)

      const auxProfileWeight = railAuxProfile(tDayS)
      const auxTempMult = 1 + RAIL_CONSTANTS.auxTempSlopePerC * Math.max(0, RAIL_CONSTANTS.auxTempRefC - input.temperatureC)
      const railAuxMW = Math.max(0, railAuxBaseMW * auxProfileWeight * auxTempMult)
      const railTotalMW = railTractionMW + railAuxMW

      const remainingS = Math.max(1, 86400 - tDayS)
      const remainingH = remainingS / 3600
      const evEnergyRemainingMWh = Math.max(0, evEnergyNeedTodayMWh - evEnergyDeliveredTodayMWh)

      const homeW = isWeekend ? evHomeProfileWeekend(tDayS) : evHomeProfileWeekday(tDayS)
      const workW = isWeekend ? evWorkplaceProfileWeekend(tDayS) : evWorkplaceProfileWeekday(tDayS)
      const fastW = isWeekend ? evPublicFastProfileWeekend(tDayS) : evPublicFastProfileWeekday(tDayS)

      const wSum = Math.max(1e-6, homeW + workW + fastW)
      const shareHome = homeW / wSum
      const shareWork = workW / wSum
      const shareFast = fastW / wSum

      const avgMWNeeded = evEnergyRemainingMWh / remainingH
      const remainingFrac = remainingH / 24
      const errorMWh = evEnergyRemainingMWh - evEnergyNeedTodayMWh * remainingFrac
      const errorMW = remainingH > 0 ? errorMWh / remainingH : 0
      const catchupMW = errorMW * EV_CONSTANTS.catchupGainPerS * stepS

      const gridStress = input.gridStress01 ?? 0
      const priceSignal = input.priceSignal01 ?? 0
      const smartSignal = clamp01(Math.max(gridStress, priceSignal))
      const throttle = Math.max(
        EV_CONSTANTS.smartChargingMinFraction,
        Math.pow(1 - smartSignal, EV_CONSTANTS.smartChargingStressExponent)
      )
      const plannedTotalMW = Math.max(0, (avgMWNeeded + catchupMW) * throttle)

      let evHomeMW = Math.min(EV_CONSTANTS.maxHomeMW, plannedTotalMW * shareHome)
      let evWorkplaceMW = Math.min(EV_CONSTANTS.maxWorkplaceMW, plannedTotalMW * shareWork)
      let evPublicFastMW = Math.min(EV_CONSTANTS.maxPublicFastMW, plannedTotalMW * shareFast)

      let evTotalMWCapped = evHomeMW + evWorkplaceMW + evPublicFastMW
      const deliverableMWhThisStep = evTotalMWCapped * (stepS / 3600)
      const actualDeliverMWh = Math.min(deliverableMWhThisStep, evEnergyRemainingMWh)
      const scale = deliverableMWhThisStep > 1e-9 ? actualDeliverMWh / deliverableMWhThisStep : 0

      evHomeMW *= scale
      evWorkplaceMW *= scale
      evPublicFastMW *= scale
      const evTotalMW = evHomeMW + evWorkplaceMW + evPublicFastMW

      evEnergyDeliveredTodayMWh += evTotalMW * (stepS / 3600)

      out.push(railTotalMW + evTotalMW)
    }

    return { stepS, consumptionMW: out }
  }

  getUpdate(): PowerUpdate {
    return {
      production: 0,
      consumption: this.lastConsumptionMW,
    }
  }

  get breakdown(): TransportBreakdown | null {
    return this.lastBreakdown
  }

  get consumptionMW(): number {
    return this.lastConsumptionMW
  }

  reset(): void {
    this.evEnergyNeedTodayMWh = 0
    this.evEnergyDeliveredTodayMWh = 0
    this.lastTDayS = -1
    this.railNoiseLP = 0
    this.railSpikeActiveUntilS = -1
    this.railSpikeAmplitudeFrac = 0
    this.lastConsumptionMW = 0
    this.lastBreakdown = null
  }
}
