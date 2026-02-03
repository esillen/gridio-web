export type FrequencyBand = 'normal' | 'off_normal' | 'alert' | 'emergency' | 'blackout'

export interface InertiaInputs {
  nuclearMW: number
  hydroReservoirMW: number
  hydroRoRMW: number
  bioWasteChpMW: number
  industrialChpMW?: number
  gasOilPeakersMW?: number
  otherSynchronousMW?: number
  motorLoadMW: number
  virtualInertiaEnabled?: boolean
  virtualInertiaMWEquiv?: number
  hVirtualS?: number
}

export interface FrequencyInput {
  totalGenerationMW: number
  totalConsumptionMW: number
  netImbalanceMW?: number
  inertia: InertiaInputs
  ffrMW?: number
  loadShedMW?: number
  fcrCapacityMW?: number        // FCR capacity for internal droop calculation
  fcrFullActivationHz?: number  // Hz deviation for full FCR activation (default 0.2)
}

export interface FrequencyBreakdown {
  frequencyHz: number
  rocofHzPerS: number
  imbalanceRawMW: number
  imbalanceWithControlsMW: number
  imbalanceDampedMW: number
  fcrResponseMW: number
  loadDampingMW: number
  sBaseMW: number
  hEquivS: number
  synchronousOnlineMW: number
  motorLoadMW: number
  virtualInertiaMW: number
  energyImbalanceMWh: number
  band: FrequencyBand
  shedRequestMW: number
}

const H_BY_TYPE_S = {
  nuclear: 6.0,
  hydro: 3.5,
  chpSteam: 3.0,
  gasOil: 4.0,
  otherSynchronous: 3.0,
}

const H_MOTOR_S = 1.5
const D_LOAD_MW_PER_HZ = 600.0        // Load damping (slightly increased)
const F_NOM_HZ = 50.0
const S_BASE_MIN_MW = 2000.0
const H_EQUIV_MIN_S = 0.5
const H_EQUIV_MAX_S = 12.0
const DEFAULT_FCR_FULL_ACTIVATION_HZ = 0.10  // Full FCR at ±0.1 Hz (aggressive)
const DEFAULT_FCR_CAPACITY_MW = 1200.0       // Higher default capacity

const LIMITS = {
  normalLowHz: 49.90,
  normalHighHz: 50.10,
  alertLowHz: 49.70,
  alertHighHz: 50.30,
  emergencyLowHz: 49.50,
  emergencyHighHz: 50.50,
  blackoutLowHz: 49.00,
  blackoutHighHz: 51.00,
}

const AUTO_SHED = {
  enabled: true,
  shedStartHz: 49.40,
  shedFullAtHz: 49.00,
  shedMaxMW: 3000.0,
}

function clamp(x: number, min: number, max: number): number {
  return Math.min(Math.max(x, min), max)
}

function clamp01(x: number): number {
  return clamp(x, 0, 1)
}

function safe(x: number, eps: number): number {
  return Math.abs(x) < eps ? (x >= 0 ? eps : -eps) : x
}

export class FrequencyModel {
  private frequencyHz = 50.0
  private rocofHzPerS = 0.0
  private energyImbalanceMWh = 0.0
  private lastBreakdown: FrequencyBreakdown | null = null

  tick(input: FrequencyInput): FrequencyBreakdown {
    const dt = 1.0

    // Compute imbalance
    const pImbalanceMW = input.netImbalanceMW ?? (input.totalGenerationMW - input.totalConsumptionMW)

    // Apply control actions
    const pControlMW = (input.ffrMW ?? 0) + (input.loadShedMW ?? 0)
    const pNetMW = pImbalanceMW + pControlMW

    // Synchronous online MW
    const synNuclearMW = Math.max(0, input.inertia.nuclearMW)
    const synHydroMW = Math.max(0, input.inertia.hydroReservoirMW) + Math.max(0, input.inertia.hydroRoRMW)
    const synChpMW = Math.max(0, input.inertia.bioWasteChpMW) + Math.max(0, input.inertia.industrialChpMW ?? 0)
    const synGasOilMW = Math.max(0, input.inertia.gasOilPeakersMW ?? 0)
    const synOtherMW = Math.max(0, input.inertia.otherSynchronousMW ?? 0)
    const synTotalMW = synNuclearMW + synHydroMW + synChpMW + synGasOilMW + synOtherMW

    // Motor load inertia
    const motorMW = Math.max(0, input.inertia.motorLoadMW)

    // Virtual inertia
    const virtEnabled = input.inertia.virtualInertiaEnabled ?? false
    const virtMW = virtEnabled ? Math.max(0, input.inertia.virtualInertiaMWEquiv ?? 0) : 0
    const hVirtS = virtEnabled ? Math.max(0, input.inertia.hVirtualS ?? 0) : 0

    // S_base (inertial base)
    const sBaseRawMW = synTotalMW + motorMW + virtMW
    const sBaseMW = Math.max(S_BASE_MIN_MW, sBaseRawMW)

    // Equivalent inertia constant (weighted)
    const hSynWeighted =
      synNuclearMW * H_BY_TYPE_S.nuclear +
      synHydroMW * H_BY_TYPE_S.hydro +
      synChpMW * H_BY_TYPE_S.chpSteam +
      synGasOilMW * H_BY_TYPE_S.gasOil +
      synOtherMW * H_BY_TYPE_S.otherSynchronous

    const hMotorWeighted = motorMW * H_MOTOR_S
    const hVirtWeighted = virtMW * hVirtS

    const hEquivRaw = (hSynWeighted + hMotorWeighted + hVirtWeighted) / sBaseMW
    const hEquivS = clamp(hEquivRaw, H_EQUIV_MIN_S, H_EQUIV_MAX_S)

    // Frequency deviation
    const deltaFHz = this.frequencyHz - F_NOM_HZ

    // Load damping (natural load response to frequency)
    const loadDampingMW = D_LOAD_MW_PER_HZ * deltaFHz

    // Internal FCR/governor droop response (immediate, no delay)
    // This provides primary frequency control - the main stabilizing force
    const fcrCapMW = input.fcrCapacityMW ?? DEFAULT_FCR_CAPACITY_MW
    const fcrFullActHz = input.fcrFullActivationHz ?? DEFAULT_FCR_FULL_ACTIVATION_HZ
    
    // Droop gain: MW response per Hz deviation
    // With 1200 MW capacity and 0.1 Hz full activation: K_fcr = 12000 MW/Hz
    const droopGainMWPerHz = fcrCapMW / Math.max(1e-6, fcrFullActHz)
    
    // FCR response: proportional to frequency deviation (governor droop)
    // No deadband for more responsive control
    // Negative deltaF (low freq) => positive response (add power)
    const fcrResponseMW = -droopGainMWPerHz * deltaFHz
    // Clamp to available capacity
    const fcrResponseClampedMW = clamp(fcrResponseMW, -fcrCapMW, fcrCapMW)

    // Total damping/control effect
    // Positive control (FCR + load damping) opposes positive imbalance
    const pDampedMW = pNetMW - loadDampingMW + fcrResponseClampedMW

    // Swing equation: df/dt = P / (2 * H * S_base)
    // Note: NOT using f0 factor - keeps dynamics as original model
    // The effective droop gain handles frequency stabilization
    const denom = 2.0 * hEquivS * sBaseMW
    this.rocofHzPerS = pDampedMW / safe(denom, 1e-6)

    // Integrate frequency (clamped to physically realistic bounds)
    this.frequencyHz += this.rocofHzPerS * dt
    this.frequencyHz = clamp(this.frequencyHz, 45.0, 55.0) // Realistic bounds

    // Track energy imbalance integral
    this.energyImbalanceMWh += pNetMW * (dt / 3600.0)

    // Automatic load shed request
    let shedRequestMW = 0
    if (AUTO_SHED.enabled) {
      const shedReqFrac = clamp01(
        (AUTO_SHED.shedStartHz - this.frequencyHz) /
        Math.max(1e-6, AUTO_SHED.shedStartHz - AUTO_SHED.shedFullAtHz)
      )
      shedRequestMW = AUTO_SHED.shedMaxMW * shedReqFrac
    }

    // Determine frequency band
    let band: FrequencyBand
    if (this.frequencyHz < LIMITS.blackoutLowHz || this.frequencyHz > LIMITS.blackoutHighHz) {
      band = 'blackout'
    } else if (this.frequencyHz < LIMITS.emergencyLowHz || this.frequencyHz > LIMITS.emergencyHighHz) {
      band = 'emergency'
    } else if (this.frequencyHz < LIMITS.alertLowHz || this.frequencyHz > LIMITS.alertHighHz) {
      band = 'alert'
    } else if (this.frequencyHz < LIMITS.normalLowHz || this.frequencyHz > LIMITS.normalHighHz) {
      band = 'off_normal'
    } else {
      band = 'normal'
    }

    this.lastBreakdown = {
      frequencyHz: this.frequencyHz,
      rocofHzPerS: this.rocofHzPerS,
      imbalanceRawMW: pImbalanceMW,
      imbalanceWithControlsMW: pNetMW,
      imbalanceDampedMW: pDampedMW,
      fcrResponseMW: fcrResponseClampedMW,
      loadDampingMW,
      sBaseMW,
      hEquivS,
      synchronousOnlineMW: synTotalMW,
      motorLoadMW: motorMW,
      virtualInertiaMW: virtMW,
      energyImbalanceMWh: this.energyImbalanceMWh,
      band,
      shedRequestMW,
    }

    return this.lastBreakdown
  }

  get breakdown(): FrequencyBreakdown | null {
    return this.lastBreakdown
  }

  get currentFrequencyHz(): number {
    return this.frequencyHz
  }

  get currentBand(): FrequencyBand {
    return this.lastBreakdown?.band ?? 'normal'
  }

  reset(): void {
    this.frequencyHz = 50.0
    this.rocofHzPerS = 0.0
    this.energyImbalanceMWh = 0.0
    this.lastBreakdown = null
  }
}
