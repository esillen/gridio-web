export interface FCRInput {
  frequencyHz: number
  rocofHzPerS?: number
  upCapacityMW?: number
  downCapacityMW?: number
  enabled?: boolean
}

export interface FCRBreakdown {
  activatedMW: number
  upUsedMW: number
  downUsedMW: number
  freqMeasHz: number
  requestFraction01: number
  availableUpMW: number
  availableDownMW: number
}

const F_NOM_HZ = 50.0
const DEADBAND_HZ = 0.02
const FULL_ACTIVATION_DEV_HZ = 0.20
const TAU_FREQ_FILTER_S = 2.0
const RAMP_UP_MW_PER_S = 200.0
const RAMP_DOWN_MW_PER_S = 300.0
const DEFAULT_UP_CAPACITY_MW = 600.0
const DEFAULT_DOWN_CAPACITY_MW = 600.0

function clamp(x: number, min: number, max: number): number {
  return Math.min(Math.max(x, min), max)
}

function clamp01(x: number): number {
  return clamp(x, 0, 1)
}

export class FCRModel {
  private freqMeasHz = F_NOM_HZ
  private activatedMW = 0
  private lastBreakdown: FCRBreakdown | null = null

  tick(input: FCRInput): FCRBreakdown {
    const dt = 1.0
    const enabled = input.enabled ?? true
    const upCap = Math.max(0, input.upCapacityMW ?? DEFAULT_UP_CAPACITY_MW)
    const downCap = Math.max(0, input.downCapacityMW ?? DEFAULT_DOWN_CAPACITY_MW)

    if (!enabled) {
      this.activatedMW = 0
      this.freqMeasHz = input.frequencyHz
      this.lastBreakdown = {
        activatedMW: 0,
        upUsedMW: 0,
        downUsedMW: 0,
        freqMeasHz: this.freqMeasHz,
        requestFraction01: 0,
        availableUpMW: upCap,
        availableDownMW: downCap,
      }
      return this.lastBreakdown
    }

    // Filter frequency measurement
    this.freqMeasHz += (input.frequencyHz - this.freqMeasHz) * (dt / TAU_FREQ_FILTER_S)

    // Compute deviation
    const dfHz = this.freqMeasHz - F_NOM_HZ
    const absDfHz = Math.abs(dfHz)

    // Apply deadband, map deviation to requested fraction
    let reqFrac01 = 0
    if (absDfHz > DEADBAND_HZ) {
      const effectiveDevHz = absDfHz - DEADBAND_HZ
      const spanHz = Math.max(1e-6, FULL_ACTIVATION_DEV_HZ - DEADBAND_HZ)
      reqFrac01 = clamp01(effectiveDevHz / spanHz)
    }

    // Requested MW with sign: if frequency low (df<0) => need up (+MW). If high => down (-MW).
    let reqMW = 0
    if (dfHz < 0) {
      reqMW = reqFrac01 * upCap
    } else if (dfHz > 0) {
      reqMW = -reqFrac01 * downCap
    }

    // Ramp limit toward requested MW
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
      requestFraction01: reqFrac01,
      availableUpMW: upCap,
      availableDownMW: downCap,
    }

    return this.lastBreakdown
  }

  get breakdown(): FCRBreakdown | null {
    return this.lastBreakdown
  }

  get currentActivatedMW(): number {
    return this.activatedMW
  }

  reset(): void {
    this.freqMeasHz = F_NOM_HZ
    this.activatedMW = 0
    this.lastBreakdown = null
  }
}
