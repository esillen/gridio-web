export interface DispatcherTimeInput {
  unixS: number
  localHour: number
  localMinute: number
  localSecond: number
  dayOfWeek: number
}

export interface SandboxConfig {
  enableNuclear: boolean
  enableHydroReservoir: boolean
  enableHydroRunOfRiver: boolean
  enableWind: boolean
  enableSolar: boolean
  enableBioWasteCHP: boolean
  enableGasOilPeakers: boolean
  enableInterconnectors: boolean
  enableDemandResponse: boolean
}

export interface FrequencyStateInput {
  frequencyHz: number
  rocofHzPerS: number
  imbalanceMW?: number
}

export interface ReservesStateInput {
  fcrActivatedMW: number
  afrrActivatedMW: number
  mfrrActivatedMW: number
  fcrUpUsedMW: number
  fcrDownUsedMW: number
  afrrUpUsedMW: number
  afrrDownUsedMW: number
}

export interface Forecast24h {
  stepS: number
  demandTotalMW: number[]
  windGenerationMW: number[]
  solarGenerationMW: number[]
  runOfRiverGenerationMW: number[]
  bioWasteChpGenerationMW: number[]
  industrialChpGenerationMW: number[]
}

export interface NuclearCapabilities {
  onlinePlantsMW: number
  minMW: number
  maxMW: number
  rampUpMWPerS: number
  rampDownMWPerS: number
}

export interface HydroReservoirCapabilities {
  minMW: number
  maxMW: number
  rampUpMWPerS: number
  rampDownMWPerS: number
  reservoirEnergyMWh: number
  reservoirEnergyMinMWh: number
  reservoirEnergyMaxMWh: number
  maxDailyEnergyDrawMWh?: number
}

export interface HydroRoRCapabilities {
  minMW: number
  maxMW: number
}

export interface GasOilPeakersCapabilities {
  minMW: number
  maxMW: number
  rampUpMWPerS: number
  rampDownMWPerS: number
  startDelayS: number
}

export interface InterconnectorsCapabilities {
  netImportMinMW: number
  netImportMaxMW: number
  rampMWPerS: number
}

export interface DemandResponseCapabilities {
  maxShedMW: number
  maxShedRampMWPerS: number
}

export interface CapabilitiesNow {
  nuclear: NuclearCapabilities
  hydroReservoir: HydroReservoirCapabilities
  hydroRunOfRiver: HydroRoRCapabilities
  gasOilPeakers: GasOilPeakersCapabilities
  interconnectors: InterconnectorsCapabilities
  demandResponse: DemandResponseCapabilities
}

export interface PolicyInput {
  hydroPeakShaping01: number
  preferImports01: number
  preferDR01: number
}

export interface DispatcherInput {
  time: DispatcherTimeInput
  sandbox: SandboxConfig
  frequencyState: FrequencyStateInput
  reservesState: ReservesStateInput
  forecast24h: Forecast24h
  capabilities: CapabilitiesNow
  policy: PolicyInput
}

export interface HourlyPlan {
  hydroReservoirMW: number[]
  netImportMW: number[]
  peakersMW: number[]
  nuclearMW: number[]
  fcrUpMW: number[]
  fcrDownMW: number[]
  afrrUpMW: number[]
  afrrDownMW: number[]
  mfrrUpMW: number[]
  mfrrDownMW: number[]
}

export interface SetpointsNow {
  nuclearMW: number
  hydroReservoirMW: number
  netImportMW: number
  peakersMW: number
  drShedMW: number
}

export interface ReserveAvailability {
  fcr: { upCapacityMW: number; downCapacityMW: number }
  afrr: { upCapacityMW: number; downCapacityMW: number }
  mfrr: { upCapacityMW: number; downCapacityMW: number }
}

export interface DispatcherBreakdown {
  hourIndex: number
  planNow: {
    nuclearMW: number
    hydroReservoirMW: number
    netImportMW: number
    peakersMW: number
    fcrTargetMW: number
    afrrTargetMW: number
    mfrrTargetMW: number
  }
  setpoints: SetpointsNow
  reserveAvailability: ReserveAvailability
  needEscalation: boolean
}

const CONSTANTS = {
  dayAheadStepS: 3600,
  replanningIntervalS: 60,
  planHorizonS: 86400,
  
  forecastErrorMarginFrac: 0.05,
  lossesMarginFrac: 0.03,
  
  reserveRules: {
    fcrFracOfLoad: 0.015,
    fcrMinMW: 250,
    fcrMaxMW: 900,
    afrrFracOfLoad: 0.020,
    afrrMinMW: 300,
    afrrMaxMW: 1200,
    mfrrFracOfLoad: 0.050,
    mfrrMinMW: 600,
    mfrrMaxMW: 3000,
  },
  
  realtime: {
    freqNomHz: 50.0,
    hydroFreqGainMWPerHz: 3500.0,
    importFreqGainMWPerHz: 1500.0,
    peakerTriggerHz: 49.70,
    drTriggerHz: 49.75,
    emergencyHz: 49.50,
    fcrSaturationFrac: 0.85,
    afrrSaturationFrac: 0.85,
  },
  
  hydroPolicy: {
    endOfDayTargetFracOfCurrent: 0.35,
    minEndOfDayFrac: 0.20,
  },
}

function clamp(x: number, min: number, max: number): number {
  return Math.min(Math.max(x, min), max)
}

function clamp01(x: number): number {
  return clamp(x, 0, 1)
}

function rampToward(current: number, target: number, rampUp: number, rampDown: number, dt: number): number {
  const delta = target - current
  if (delta >= 0) {
    return current + Math.min(delta, rampUp * dt)
  } else {
    return current + Math.max(delta, -rampDown * dt)
  }
}

function computeReserveTargets(loadMW: number): { fcr: number; afrr: number; mfrr: number } {
  const rules = CONSTANTS.reserveRules
  return {
    fcr: clamp(loadMW * rules.fcrFracOfLoad, rules.fcrMinMW, rules.fcrMaxMW),
    afrr: clamp(loadMW * rules.afrrFracOfLoad, rules.afrrMinMW, rules.afrrMaxMW),
    mfrr: clamp(loadMW * rules.mfrrFracOfLoad, rules.mfrrMinMW, rules.mfrrMaxMW),
  }
}

function createEmptyHourlyPlan(): HourlyPlan {
  return {
    hydroReservoirMW: new Array(24).fill(0),
    netImportMW: new Array(24).fill(0),
    peakersMW: new Array(24).fill(0),
    nuclearMW: new Array(24).fill(0),
    fcrUpMW: new Array(24).fill(0),
    fcrDownMW: new Array(24).fill(0),
    afrrUpMW: new Array(24).fill(0),
    afrrDownMW: new Array(24).fill(0),
    mfrrUpMW: new Array(24).fill(0),
    mfrrDownMW: new Array(24).fill(0),
  }
}

export class DispatcherModel {
  private planHourly: HourlyPlan = createEmptyHourlyPlan()
  private setpointsNow: SetpointsNow = {
    nuclearMW: 6800,       // Match nuclear starting output
    hydroReservoirMW: 5000, // Start mid-range for reserves
    netImportMW: 0,
    peakersMW: 0,
    drShedMW: 0,
  }
  
  private lastPlanningDayId = -1
  private secondsSinceLastReplan = 1e9
  private lastBreakdown: DispatcherBreakdown | null = null

  tick(input: DispatcherInput): DispatcherBreakdown {
    const dt = 1.0
    const tDayS = input.time.localHour * 3600 + input.time.localMinute * 60 + input.time.localSecond
    const dayId = Math.floor(input.time.unixS / 86400)
    
    this.secondsSinceLastReplan += dt
    
    const shouldReplan = (dayId !== this.lastPlanningDayId) || 
                         (this.secondsSinceLastReplan >= CONSTANTS.replanningIntervalS)
    
    if (shouldReplan) {
      this.buildDayAheadPlan(input)
      this.lastPlanningDayId = dayId
      this.secondsSinceLastReplan = 0
    }
    
    // Get current hour plan
    const hNow = clamp(Math.floor(tDayS / CONSTANTS.dayAheadStepS), 0, 23)
    const nuclearPlanNow = this.planHourly.nuclearMW[hNow] ?? 0
    const hydroPlanNow = this.planHourly.hydroReservoirMW[hNow] ?? 0
    const importPlanNow = this.planHourly.netImportMW[hNow] ?? 0
    const peakerPlanNow = this.planHourly.peakersMW[hNow] ?? 0
    
    // Real-time corrections based on frequency
    const f = input.frequencyState.frequencyHz
    const df = CONSTANTS.realtime.freqNomHz - f // positive when low freq => need +MW
    
    const fcrUpTarget = this.planHourly.fcrUpMW[hNow] ?? 0
    const afrrUpTarget = this.planHourly.afrrUpMW[hNow] ?? 0
    
    const fcrUpSat = fcrUpTarget > 1e-6 
      ? input.reservesState.fcrUpUsedMW / fcrUpTarget 
      : 0
    const afrrUpSat = afrrUpTarget > 1e-6 
      ? input.reservesState.afrrUpUsedMW / afrrUpTarget 
      : 0
    
    // Hydro correction (primary real-time actuator)
    const hydroCorrMW = input.sandbox.enableHydroReservoir 
      ? CONSTANTS.realtime.hydroFreqGainMWPerHz * df 
      : 0
    let hydroTargetRtMW = clamp(
      hydroPlanNow + hydroCorrMW,
      input.capabilities.hydroReservoir.minMW,
      input.capabilities.hydroReservoir.maxMW
    )
    
    // Import correction (secondary actuator)
    const importCorrMW = input.sandbox.enableInterconnectors
      ? CONSTANTS.realtime.importFreqGainMWPerHz * df
      : 0
    let importTargetRtMW = clamp(
      importPlanNow + importCorrMW,
      input.capabilities.interconnectors.netImportMinMW,
      input.capabilities.interconnectors.netImportMaxMW
    )
    
    // Escalation: DR and peakers if frequency bad or reserves saturated
    const needEscalation = (f <= CONSTANTS.realtime.peakerTriggerHz) ||
                           (fcrUpSat >= CONSTANTS.realtime.fcrSaturationFrac) ||
                           (afrrUpSat >= CONSTANTS.realtime.afrrSaturationFrac)
    
    let drTargetMW = 0
    if (input.sandbox.enableDemandResponse && needEscalation && f <= CONSTANTS.realtime.drTriggerHz) {
      const u = clamp01((CONSTANTS.realtime.drTriggerHz - f) / 
                        Math.max(1e-6, CONSTANTS.realtime.drTriggerHz - CONSTANTS.realtime.emergencyHz))
      drTargetMW = Math.min(
        input.capabilities.demandResponse.maxShedMW,
        u * input.capabilities.demandResponse.maxShedMW * clamp01(input.policy.preferDR01)
      )
    }
    
    let peakerTargetMW = peakerPlanNow
    if (input.sandbox.enableGasOilPeakers && needEscalation && f <= CONSTANTS.realtime.peakerTriggerHz) {
      const u = clamp01((CONSTANTS.realtime.peakerTriggerHz - f) / 
                        Math.max(1e-6, CONSTANTS.realtime.peakerTriggerHz - CONSTANTS.realtime.emergencyHz))
      peakerTargetMW = clamp(
        peakerPlanNow + u * input.capabilities.gasOilPeakers.maxMW,
        input.capabilities.gasOilPeakers.minMW,
        input.capabilities.gasOilPeakers.maxMW
      )
    }
    
    // Ramp-limit setpoints
    this.setpointsNow.nuclearMW = rampToward(
      this.setpointsNow.nuclearMW,
      input.sandbox.enableNuclear 
        ? clamp(nuclearPlanNow, input.capabilities.nuclear.minMW, input.capabilities.nuclear.maxMW) 
        : 0,
      input.capabilities.nuclear.rampUpMWPerS,
      input.capabilities.nuclear.rampDownMWPerS,
      dt
    )
    
    this.setpointsNow.hydroReservoirMW = rampToward(
      this.setpointsNow.hydroReservoirMW,
      input.sandbox.enableHydroReservoir ? hydroTargetRtMW : 0,
      input.capabilities.hydroReservoir.rampUpMWPerS,
      input.capabilities.hydroReservoir.rampDownMWPerS,
      dt
    )
    
    this.setpointsNow.netImportMW = rampToward(
      this.setpointsNow.netImportMW,
      input.sandbox.enableInterconnectors ? importTargetRtMW : 0,
      input.capabilities.interconnectors.rampMWPerS,
      input.capabilities.interconnectors.rampMWPerS,
      dt
    )
    
    this.setpointsNow.peakersMW = rampToward(
      this.setpointsNow.peakersMW,
      input.sandbox.enableGasOilPeakers ? peakerTargetMW : 0,
      input.capabilities.gasOilPeakers.rampUpMWPerS,
      input.capabilities.gasOilPeakers.rampDownMWPerS,
      dt
    )
    
    this.setpointsNow.drShedMW = rampToward(
      this.setpointsNow.drShedMW,
      input.sandbox.enableDemandResponse ? drTargetMW : 0,
      input.capabilities.demandResponse.maxShedRampMWPerS,
      input.capabilities.demandResponse.maxShedRampMWPerS,
      dt
    )
    
    // Compute reserve availability
    const reserveAvailability = this.computeReserveAvailability(input, hNow)
    
    this.lastBreakdown = {
      hourIndex: hNow,
      planNow: {
        nuclearMW: nuclearPlanNow,
        hydroReservoirMW: hydroPlanNow,
        netImportMW: importPlanNow,
        peakersMW: peakerPlanNow,
        fcrTargetMW: fcrUpTarget,
        afrrTargetMW: afrrUpTarget,
        mfrrTargetMW: this.planHourly.mfrrUpMW[hNow] ?? 0,
      },
      setpoints: { ...this.setpointsNow },
      reserveAvailability,
      needEscalation,
    }
    
    return this.lastBreakdown
  }

  private buildDayAheadPlan(input: DispatcherInput): void {
    const N = 24
    const forecast = input.forecast24h
    const cap = input.capabilities
    const sandbox = input.sandbox
    const policy = input.policy
    
    // Phase 1: Compute residual load and peak weights for each hour
    const residualMW: number[] = []
    const peakWeights: number[] = []
    
    for (let h = 0; h < N; h++) {
      const demandH = (forecast.demandTotalMW[h] ?? 0) * 
                      (1 + CONSTANTS.forecastErrorMarginFrac + CONSTANTS.lossesMarginFrac)
      
      const vreH = (sandbox.enableWind ? (forecast.windGenerationMW[h] ?? 0) : 0) +
                   (sandbox.enableSolar ? (forecast.solarGenerationMW[h] ?? 0) : 0)
      
      const mustTakeH = (sandbox.enableHydroRunOfRiver ? (forecast.runOfRiverGenerationMW[h] ?? 0) : 0) +
                        (sandbox.enableBioWasteCHP ? (forecast.bioWasteChpGenerationMW[h] ?? 0) + (forecast.industrialChpGenerationMW[h] ?? 0) : 0) +
                        vreH
      
      // Nuclear plan: flat at ~98% of max
      const nuclearCapH = sandbox.enableNuclear ? cap.nuclear.maxMW : 0
      const nuclearPlanH = nuclearCapH * 0.98
      this.planHourly.nuclearMW[h] = nuclearPlanH
      
      const residualH = Math.max(0, demandH - mustTakeH - nuclearPlanH)
      residualMW[h] = residualH
      
      // Peak weight for hydro allocation
      const shapingPower = 1.0 + 1.5 * clamp01(policy.hydroPeakShaping01)
      peakWeights[h] = Math.pow(Math.max(0, residualH), shapingPower)
      
      // Reserve targets based on demand
      const reserves = computeReserveTargets(demandH)
      this.planHourly.fcrUpMW[h] = reserves.fcr
      this.planHourly.fcrDownMW[h] = reserves.fcr
      this.planHourly.afrrUpMW[h] = reserves.afrr
      this.planHourly.afrrDownMW[h] = reserves.afrr
      this.planHourly.mfrrUpMW[h] = reserves.mfrr
      this.planHourly.mfrrDownMW[h] = reserves.mfrr
    }
    
    // Phase 2: Distribute hydro energy budget by peak weights
    if (sandbox.enableHydroReservoir) {
      const eNow = cap.hydroReservoir.reservoirEnergyMWh
      const eMin = cap.hydroReservoir.reservoirEnergyMinMWh
      const eMax = cap.hydroReservoir.reservoirEnergyMaxMWh
      
      const targetFrac = clamp(
        CONSTANTS.hydroPolicy.endOfDayTargetFracOfCurrent,
        CONSTANTS.hydroPolicy.minEndOfDayFrac,
        1.0
      )
      const eTarget = Math.max(eMin, Math.min(eMax, eNow * targetFrac))
      let eBudgetMWh = Math.max(0, eNow - eTarget)
      
      if (cap.hydroReservoir.maxDailyEnergyDrawMWh !== undefined) {
        eBudgetMWh = Math.min(eBudgetMWh, Math.max(0, cap.hydroReservoir.maxDailyEnergyDrawMWh))
      }
      
      const wSum = peakWeights.reduce((a, b) => a + b, 0) + 1e-6
      
      for (let h = 0; h < N; h++) {
        const eH = eBudgetMWh * (peakWeights[h]! / wSum)
        const hydroFromEnergyMW = eH // per hour => MW
        this.planHourly.hydroReservoirMW[h] = clamp(hydroFromEnergyMW, 0, cap.hydroReservoir.maxMW)
      }
    } else {
      for (let h = 0; h < N; h++) {
        this.planHourly.hydroReservoirMW[h] = 0
      }
    }
    
    // Phase 3: Allocate imports and peakers to cover remaining residual
    for (let h = 0; h < N; h++) {
      const demandH = (forecast.demandTotalMW[h] ?? 0) * 
                      (1 + CONSTANTS.forecastErrorMarginFrac + CONSTANTS.lossesMarginFrac)
      
      const vreH = (sandbox.enableWind ? (forecast.windGenerationMW[h] ?? 0) : 0) +
                   (sandbox.enableSolar ? (forecast.solarGenerationMW[h] ?? 0) : 0)
      
      const mustTakeH = (sandbox.enableHydroRunOfRiver ? (forecast.runOfRiverGenerationMW[h] ?? 0) : 0) +
                        (sandbox.enableBioWasteCHP ? (forecast.bioWasteChpGenerationMW[h] ?? 0) + (forecast.industrialChpGenerationMW[h] ?? 0) : 0) +
                        vreH
      
      const nuclearH = this.planHourly.nuclearMW[h]!
      const hydroH = this.planHourly.hydroReservoirMW[h]!
      
      const residual = demandH - mustTakeH - nuclearH - hydroH
      const prefer = clamp01(policy.preferImports01)

      const impMin = cap.interconnectors.netImportMinMW  // negative allowed
      const impMax = cap.interconnectors.netImportMaxMW  // positive

      let importUse = 0
      if (residual >= 0) {
        // need supply → import (0..impMax)
        importUse = clamp(residual * prefer, 0, impMax)
      } else {
        // surplus → export (impMin..0) IF you want exports in the game
        importUse = clamp(residual * prefer, impMin, 0)
      }

      this.planHourly.netImportMW[h] = importUse
      
      // Peakers
      const residualAfterImportH = Math.max(0, residual - importUse)
      const peakerCapH = sandbox.enableGasOilPeakers ? cap.gasOilPeakers.maxMW : 0
      this.planHourly.peakersMW[h] = Math.min(peakerCapH, residualAfterImportH)
    }
  }

  private computeReserveAvailability(input: DispatcherInput, hNow: number): ReserveAvailability {
    const sandbox = input.sandbox
    const cap = input.capabilities
    const setpoints = this.setpointsNow
    
    // Compute headrooms
    const hydroUpHeadroom = Math.max(0, cap.hydroReservoir.maxMW - setpoints.hydroReservoirMW)
    const hydroDownHeadroom = Math.max(0, setpoints.hydroReservoirMW - cap.hydroReservoir.minMW)
    
    const peakerUpHeadroom = Math.max(0, cap.gasOilPeakers.maxMW - setpoints.peakersMW)
    const peakerDownHeadroom = Math.max(0, setpoints.peakersMW - cap.gasOilPeakers.minMW)
    
    const importUpHeadroom = Math.max(0, cap.interconnectors.netImportMaxMW - setpoints.netImportMW)
    const importDownHeadroom = Math.max(0, setpoints.netImportMW - cap.interconnectors.netImportMinMW)
    
    const drUpHeadroom = Math.max(0, cap.demandResponse.maxShedMW - setpoints.drShedMW)
    
    // Reserve targets
    const fcrTarget = this.planHourly.fcrUpMW[hNow] ?? 0
    const afrrTarget = this.planHourly.afrrUpMW[hNow] ?? 0
    const mfrrTarget = this.planHourly.mfrrUpMW[hNow] ?? 0
    
    // FCR: primarily from hydro
    const fcrUpAvailable = Math.min(fcrTarget, hydroUpHeadroom)
    const fcrDownAvailable = Math.min(fcrTarget, hydroDownHeadroom)
    
    const hydroUpAfterFcr = Math.max(0, hydroUpHeadroom - fcrUpAvailable)
    const hydroDownAfterFcr = Math.max(0, hydroDownHeadroom - fcrDownAvailable)
    
    // aFRR: from remaining hydro + imports
    const afrrUpAvailable = Math.min(
      afrrTarget,
      hydroUpAfterFcr + (sandbox.enableInterconnectors ? importUpHeadroom : 0)
    )
    const afrrDownAvailable = Math.min(
      afrrTarget,
      hydroDownAfterFcr + (sandbox.enableInterconnectors ? importDownHeadroom : 0)
    )
    
    // mFRR: from peakers + imports + DR
    const mfrrUpAvailable = Math.min(
      mfrrTarget,
      (sandbox.enableGasOilPeakers ? peakerUpHeadroom : 0) +
      (sandbox.enableInterconnectors ? importUpHeadroom : 0) +
      (sandbox.enableDemandResponse ? drUpHeadroom : 0)
    )
    const mfrrDownAvailable = Math.min(
      mfrrTarget,
      (sandbox.enableGasOilPeakers ? peakerDownHeadroom : 0) +
      (sandbox.enableInterconnectors ? importDownHeadroom : 0)
    )
    
    return {
      fcr: { upCapacityMW: fcrUpAvailable, downCapacityMW: fcrDownAvailable },
      afrr: { upCapacityMW: afrrUpAvailable, downCapacityMW: afrrDownAvailable },
      mfrr: { upCapacityMW: mfrrUpAvailable, downCapacityMW: mfrrDownAvailable },
    }
  }

  get breakdown(): DispatcherBreakdown | null {
    return this.lastBreakdown
  }

  get hourlyPlan(): HourlyPlan {
    return this.planHourly
  }

  get setpoints(): SetpointsNow {
    return this.setpointsNow
  }

  reset(): void {
    this.planHourly = createEmptyHourlyPlan()
    this.setpointsNow = {
      nuclearMW: 6800,
      hydroReservoirMW: 5000,
      netImportMW: 0,
      peakersMW: 0,
      drShedMW: 0,
    }
    this.lastPlanningDayId = -1
    this.secondsSinceLastReplan = 1e9
    this.lastBreakdown = null
  }
}
