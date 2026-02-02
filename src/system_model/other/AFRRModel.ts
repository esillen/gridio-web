export interface AFRRInput {
  frequencyHz: number
  rocofHzPerS?: number
  netImbalanceMW?: number
  upCapacityMW?: number
  downCapacityMW?: number
  enabled?: boolean
}

export interface AFRRBreakdown {
  activatedMW: number
  upUsedMW: number
  downUsedMW: number
  freqMeasHz: number
  integralHzS: number
  activeGate01: number
  availableUpMW: number
  availableDownMW: number
}

const F_NOM_HZ = 50.0
const ACTIVATION_DELAY_S = 30.0
const DISTURBANCE_THRESHOLD_HZ = 0.03
const TAU_FREQ_FILTER_S = 5.0
const KP_MW_PER_HZ = 5000.0
const KI_MW_PER_HZ_S = 120.0
const INTEGRAL_LIMIT_HZ_S = 0.50 * 3600.0
const RAMP_UP_MW_PER_S = 40.0
const RAMP_DOWN_MW_PER_S = 60.0
const INTEGRAL_LEAK_PER_S = 0.0002
const DEFAULT_UP_CAPACITY_MW = 400.0
const DEFAULT_DOWN_CAPACITY_MW = 400.0

function clamp(x: number, min: number, max: number): number {
  return Math.min(Math.max(x, min), max)
}

export class AFRRModel {
  private freqMeasHz = F_NOM_HZ
  private integralHzS = 0
  private activatedMW = 0
  private timerSinceDisturbanceS = 0
  private lastBreakdown: AFRRBreakdown | null = null

  tick(input: AFRRInput): AFRRBreakdown {
    const dt = 1.0
    const enabled = input.enabled ?? true
    const upCap = Math.max(0, input.upCapacityMW ?? DEFAULT_UP_CAPACITY_MW)
    const downCap = Math.max(0, input.downCapacityMW ?? DEFAULT_DOWN_CAPACITY_MW)

    if (!enabled) {
      this.activatedMW = 0
      this.integralHzS = 0
      this.timerSinceDisturbanceS = 0
      this.freqMeasHz = input.frequencyHz
      this.lastBreakdown = {
        activatedMW: 0,
        upUsedMW: 0,
        downUsedMW: 0,
        freqMeasHz: this.freqMeasHz,
        integralHzS: 0,
        activeGate01: 0,
        availableUpMW: upCap,
        availableDownMW: downCap,
      }
      return this.lastBreakdown
    }

    // Filter frequency
    this.freqMeasHz += (input.frequencyHz - this.freqMeasHz) * (dt / TAU_FREQ_FILTER_S)

    const dfHz = this.freqMeasHz - F_NOM_HZ
    const errHz = F_NOM_HZ - this.freqMeasHz // positive if frequency low => need up

    // Disturbance timer logic
    if (Math.abs(dfHz) >= DISTURBANCE_THRESHOLD_HZ) {
      this.timerSinceDisturbanceS += dt
    } else {
      this.timerSinceDisturbanceS = Math.max(0, this.timerSinceDisturbanceS - 2 * dt)
    }

    const activeGate01 = this.timerSinceDisturbanceS >= ACTIVATION_DELAY_S ? 1 : 0

    // Integral update (only when active gate is open)
    if (activeGate01 === 1) {
      this.integralHzS += errHz * dt
    } else {
      this.integralHzS *= (1 - INTEGRAL_LEAK_PER_S * dt)
    }
    this.integralHzS = clamp(this.integralHzS, -INTEGRAL_LIMIT_HZ_S, INTEGRAL_LIMIT_HZ_S)

    // PI requested MW
    let reqMWRaw = KP_MW_PER_HZ * errHz + KI_MW_PER_HZ_S * this.integralHzS

    // Optional ACE-like assist if net_imbalance provided
    if (input.netImbalanceMW !== undefined) {
      reqMWRaw += 0.15 * (-input.netImbalanceMW)
    }

    // Clamp to available capacities
    const reqMW = clamp(reqMWRaw, -downCap, upCap)

    // Ramp limit
    const delta = reqMW - this.activatedMW
    let deltaLimited: number
    if (delta >= 0) {
      deltaLimited = Math.min(delta, RAMP_UP_MW_PER_S * dt)
    } else {
      deltaLimited = Math.max(delta, -RAMP_DOWN_MW_PER_S * dt)
    }
    this.activatedMW += deltaLimited

    this.lastBreakdown = {
      activatedMW: this.activatedMW,
      upUsedMW: Math.max(0, this.activatedMW),
      downUsedMW: Math.max(0, -this.activatedMW),
      freqMeasHz: this.freqMeasHz,
      integralHzS: this.integralHzS,
      activeGate01,
      availableUpMW: upCap,
      availableDownMW: downCap,
    }

    return this.lastBreakdown
  }

  get breakdown(): AFRRBreakdown | null {
    return this.lastBreakdown
  }

  get currentActivatedMW(): number {
    return this.activatedMW
  }

  reset(): void {
    this.freqMeasHz = F_NOM_HZ
    this.integralHzS = 0
    this.activatedMW = 0
    this.timerSinceDisturbanceS = 0
    this.lastBreakdown = null
  }
}
