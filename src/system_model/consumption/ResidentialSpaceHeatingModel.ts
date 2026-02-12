import type { Actor, PowerUpdate } from '../../game/Actor'

export interface HeatingModelInput {
  temperatureOutdoorC: number
  windSpeedMps: number
  localHour: number
  curtailmentFrac01?: number
}

export interface HeatingBreakdown {
  hpCompressorElecMW: number
  hpAuxResistiveElecMW: number
  directSpaceheatElecMW: number
  hvacParasiticMW: number
  copWeighted: number
  effectiveOutdoorTempC: number
  requestedThermalMW: number
  scheduleFactorRaw: number
  scheduleFactorSmooth: number
  tempFactor01: number
  windFactor: number
  curtailmentFactor: number
}

const CONSTANTS = {
  // Climate / heating control
  heatingBalanceTempC: 17.0,
  designTempC: -20.0,
  buildingTauS: 7200.0,

  // Schedule smoothing
  tauScheduleSmoothS: 1800.0,

  // Capacity caps (MW)
  hpCompressorElectricCapMW: 4500.0,
  hpAuxResistiveCapMW: 6500.0,
  directElectricSpaceheatCapMW: 3000.0,
  hvacParasiticMW: 150.0,

  // Wind effect
  windRefMps: 3.0,
  windLossCoeffPerMps: 0.02,

  // Schedule [startHour, endHour, multiplier]
  schedule: [
    [0, 5, 0.88],
    [5, 9, 1.08],
    [9, 16, 0.98],
    [16, 22, 1.10],
    [22, 24, 0.92],
  ] as [number, number, number][],

  // Heat pump COP model
  copAirAt7C: 3.0,
  copAirSlopePerC: 0.045,
  copAirMin: 1.2,
  copAirMax: 3.6,
  copGroundConstant: 3.4,
  copExhaustConstant: 2.6,

  // HP stock weights
  nHeatpumpsTotal: 1286000,
  nHeatpumpsAirAir: 543000,
  nHeatpumpsAirWaterOrExhaust: 286000,
  nHeatpumpsGroundOrLake: 457000,

  // Peak thermal
  thermalSpaceheatDesignMW: 25000.0,
  hpPreferredThermalShare: 0.70,

  // Curtailment clamp
  curtailmentMinFactor: 0.70,
}

// Precompute weights
const W_AIR_AIR = CONSTANTS.nHeatpumpsAirAir / CONSTANTS.nHeatpumpsTotal
const W_AIR_WATER_OR_EXHAUST = CONSTANTS.nHeatpumpsAirWaterOrExhaust / CONSTANTS.nHeatpumpsTotal
const W_GROUND_OR_LAKE = CONSTANTS.nHeatpumpsGroundOrLake / CONSTANTS.nHeatpumpsTotal
const HEATING_DEGREE_DESIGN_C = CONSTANTS.heatingBalanceTempC - CONSTANTS.designTempC

function clamp(x: number, min: number, max: number): number {
  return Math.min(Math.max(x, min), max)
}

function getScheduleFactorRaw(localHour: number): number {
  for (const [start, end, multiplier] of CONSTANTS.schedule) {
    if (localHour >= start && localHour < end) {
      return multiplier
    }
  }
  return 1.0
}

export class ResidentialSpaceHeatingModel implements Actor {
  id: string
  name: string
  
  private effectiveOutdoorTempC: number
  private scheduleFactorSmooth: number
  private lastConsumptionMW = 0
  private lastBreakdown: HeatingBreakdown | null = null

  constructor(id: string, name: string, initialTempC: number = -5) {
    this.id = id
    this.name = name
    this.effectiveOutdoorTempC = initialTempC
    this.scheduleFactorSmooth = 1.0
  }

  tick(input: HeatingModelInput): HeatingBreakdown {
    const C = CONSTANTS
    const dt = 1.0 // 1 second tick

    // 1) Smooth outdoor temperature (building thermal inertia)
    this.effectiveOutdoorTempC += 
      (input.temperatureOutdoorC - this.effectiveOutdoorTempC) * (dt / C.buildingTauS)

    // 2) Compute raw schedule factor then smooth it
    const scheduleFactorRaw = getScheduleFactorRaw(input.localHour)
    this.scheduleFactorSmooth += 
      (scheduleFactorRaw - this.scheduleFactorSmooth) * (dt / C.tauScheduleSmoothS)

    // 3) Compute demand multipliers
    const heatingDegreeC = Math.max(0, C.heatingBalanceTempC - this.effectiveOutdoorTempC)
    const tempFactor01 = clamp(heatingDegreeC / HEATING_DEGREE_DESIGN_C, 0, 1)
    
    const windFactor = 1 + C.windLossCoeffPerMps * Math.max(0, input.windSpeedMps - C.windRefMps)
    const curtailmentFactor = clamp(1 - (input.curtailmentFrac01 ?? 0), C.curtailmentMinFactor, 1.0)

    // 4) Requested thermal space-heating (MW_th)
    const requestedThermalSpaceheatMW = 
      C.thermalSpaceheatDesignMW * tempFactor01 * windFactor * this.scheduleFactorSmooth * curtailmentFactor

    // 5) Allocate between HP and direct electric
    const thermalHpRequestMW = requestedThermalSpaceheatMW * C.hpPreferredThermalShare
    const thermalDirectRequestMW = requestedThermalSpaceheatMW * (1 - C.hpPreferredThermalShare)

    // 6) COP (weighted)
    const copAir = clamp(
      C.copAirAt7C - C.copAirSlopePerC * (7 - this.effectiveOutdoorTempC),
      C.copAirMin,
      C.copAirMax
    )
    const copWeighted = 
      W_AIR_AIR * copAir +
      W_AIR_WATER_OR_EXHAUST * C.copExhaustConstant +
      W_GROUND_OR_LAKE * C.copGroundConstant

    // 7) HP compressor electricity
    const hpCompressorElecNeededMW = thermalHpRequestMW / copWeighted
    const hpCompressorElecMW = Math.min(C.hpCompressorElectricCapMW, hpCompressorElecNeededMW)
    const thermalServedByHpMW = hpCompressorElecMW * copWeighted
    const thermalHpRemainingMW = Math.max(0, thermalHpRequestMW - thermalServedByHpMW)

    // 8) Auxiliary resistive
    const hpAuxResistiveElecMW = Math.min(C.hpAuxResistiveCapMW, thermalHpRemainingMW)

    // 9) Direct electric
    const directSpaceheatElecMW = Math.min(C.directElectricSpaceheatCapMW, thermalDirectRequestMW)

    // 10) Total consumption (instantaneous)
    const consumptionInstantMW = 
      hpCompressorElecMW + 
      hpAuxResistiveElecMW + 
      directSpaceheatElecMW + 
      C.hvacParasiticMW
    
    this.lastConsumptionMW = consumptionInstantMW
    this.lastBreakdown = {
      hpCompressorElecMW,
      hpAuxResistiveElecMW,
      directSpaceheatElecMW,
      hvacParasiticMW: C.hvacParasiticMW,
      copWeighted,
      effectiveOutdoorTempC: this.effectiveOutdoorTempC,
      requestedThermalMW: requestedThermalSpaceheatMW,
      scheduleFactorRaw,
      scheduleFactorSmooth: this.scheduleFactorSmooth,
      tempFactor01,
      windFactor,
      curtailmentFactor,
    }

    return this.lastBreakdown
  }

  forecast24h(
    input: HeatingModelInput,
    weatherForecast: { stepS: number; temperatureOutdoorC: number[]; windSpeedMps: number[] }
  ): { stepS: number; consumptionMW: number[] } {
    const stepS = weatherForecast.stepS
    const out: number[] = []
    let effectiveOutdoorTempC = this.effectiveOutdoorTempC
    let scheduleFactorSmooth = this.scheduleFactorSmooth
    const tDayS0 = input.localHour * 3600

    for (let i = 0; i < weatherForecast.temperatureOutdoorC.length; i++) {
      const tOffsetS = i * stepS
      const tDayS = (tDayS0 + tOffsetS) % 86400
      const hour = Math.floor(tDayS / 3600)

      const tempC = weatherForecast.temperatureOutdoorC[i] ?? input.temperatureOutdoorC
      const windMps = weatherForecast.windSpeedMps[i] ?? input.windSpeedMps

      effectiveOutdoorTempC += (tempC - effectiveOutdoorTempC) * (stepS / CONSTANTS.buildingTauS)

      const scheduleFactorRaw = getScheduleFactorRaw(hour)
      scheduleFactorSmooth += (scheduleFactorRaw - scheduleFactorSmooth) * (stepS / CONSTANTS.tauScheduleSmoothS)

      const heatingDegreeC = Math.max(0, CONSTANTS.heatingBalanceTempC - effectiveOutdoorTempC)
      const tempFactor01 = clamp(heatingDegreeC / HEATING_DEGREE_DESIGN_C, 0, 1)
      const windFactor = 1 + CONSTANTS.windLossCoeffPerMps * Math.max(0, windMps - CONSTANTS.windRefMps)
      const curtailmentFactor = clamp(1 - (input.curtailmentFrac01 ?? 0), CONSTANTS.curtailmentMinFactor, 1.0)

      const requestedThermalSpaceheatMW =
        CONSTANTS.thermalSpaceheatDesignMW * tempFactor01 * windFactor * scheduleFactorSmooth * curtailmentFactor

      const thermalHpRequestMW = requestedThermalSpaceheatMW * CONSTANTS.hpPreferredThermalShare
      const thermalDirectRequestMW = requestedThermalSpaceheatMW * (1 - CONSTANTS.hpPreferredThermalShare)

      const copAir = clamp(
        CONSTANTS.copAirAt7C - CONSTANTS.copAirSlopePerC * (7 - effectiveOutdoorTempC),
        CONSTANTS.copAirMin,
        CONSTANTS.copAirMax
      )
      const copWeighted =
        W_AIR_AIR * copAir +
        W_AIR_WATER_OR_EXHAUST * CONSTANTS.copExhaustConstant +
        W_GROUND_OR_LAKE * CONSTANTS.copGroundConstant

      const hpCompressorElecNeededMW = thermalHpRequestMW / copWeighted
      const hpCompressorElecMW = Math.min(CONSTANTS.hpCompressorElectricCapMW, hpCompressorElecNeededMW)
      const thermalServedByHpMW = hpCompressorElecMW * copWeighted
      const thermalHpRemainingMW = Math.max(0, thermalHpRequestMW - thermalServedByHpMW)

      const hpAuxResistiveElecMW = Math.min(CONSTANTS.hpAuxResistiveCapMW, thermalHpRemainingMW)
      const directSpaceheatElecMW = Math.min(CONSTANTS.directElectricSpaceheatCapMW, thermalDirectRequestMW)

      out.push(
        hpCompressorElecMW +
        hpAuxResistiveElecMW +
        directSpaceheatElecMW +
        CONSTANTS.hvacParasiticMW
      )
    }

    return { stepS, consumptionMW: out }
  }

  getUpdate(): PowerUpdate {
    return {
      production: 0,
      consumption: this.lastConsumptionMW,
    }
  }

  get breakdown(): HeatingBreakdown | null {
    return this.lastBreakdown
  }

  get consumptionMW(): number {
    return this.lastConsumptionMW
  }

  reset(initialTempC: number = -5): void {
    this.effectiveOutdoorTempC = initialTempC
    this.scheduleFactorSmooth = 1.0
    this.lastConsumptionMW = 0
    this.lastBreakdown = null
  }
}
