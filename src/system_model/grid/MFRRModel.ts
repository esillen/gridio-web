export interface MFRRInput {
  frequencyHz: number
  netImbalanceMW?: number
  afrrActivatedMW?: number
  afrrUpCapacityMW?: number
  afrrDownCapacityMW?: number
  upCapacityMW?: number
  downCapacityMW?: number
  enabled?: boolean
}

export interface MFRRBreakdown {
  activatedMW: number
  upUsedMW: number
  downUsedMW: number
  pendingMW: number
  pendingCount: number
  persistentTimerS: number
  availableUpMW: number
  availableDownMW: number
}

interface PendingBlock {
  mw: number
  timeToGoS: number
}

const F_NOM_HZ = 50.0
const FREQ_TRIGGER_HZ = 49.85
const FREQ_TRIGGER_HIGH_HZ = 50.15
const IMBALANCE_TRIGGER_MW = 500.0
const PERSISTENCE_S = 180.0
const ACTIVATION_DELAY_S = 300.0
const BLOCK_SIZE_MW = 100.0
const MAX_BLOCKS_PER_ACTIVATION = 5
const AFRR_SATURATION_FRAC_TRIGGER = 0.80
const RAMP_UP_MW_PER_S = 10.0
const RAMP_DOWN_MW_PER_S = 15.0
const DEFAULT_UP_CAPACITY_MW = 1200.0
const DEFAULT_DOWN_CAPACITY_MW = 1200.0

function clamp(x: number, min: number, max: number): number {
  return Math.min(Math.max(x, min), max)
}

export class MFRRModel {
  private activatedMW = 0
  private pending: PendingBlock[] = []
  private persistentTimerS = 0
  private lastBreakdown: MFRRBreakdown | null = null

  tick(input: MFRRInput): MFRRBreakdown {
    const dt = 1.0
    const enabled = input.enabled ?? true
    const upCap = Math.max(0, input.upCapacityMW ?? DEFAULT_UP_CAPACITY_MW)
    const downCap = Math.max(0, input.downCapacityMW ?? DEFAULT_DOWN_CAPACITY_MW)

    if (!enabled) {
      this.activatedMW = 0
      this.pending = []
      this.persistentTimerS = 0
      this.lastBreakdown = {
        activatedMW: 0,
        upUsedMW: 0,
        downUsedMW: 0,
        pendingMW: 0,
        pendingCount: 0,
        persistentTimerS: 0,
        availableUpMW: upCap,
        availableDownMW: downCap,
      }
      return this.lastBreakdown
    }

    const pImbalanceMW = input.netImbalanceMW ?? 0

    // Determine if conditions suggest persistent shortage/surplus
    const freqLow = input.frequencyHz <= FREQ_TRIGGER_HZ
    const freqHigh = input.frequencyHz >= FREQ_TRIGGER_HIGH_HZ

    // Check aFRR saturation
    const afrrActivated = input.afrrActivatedMW ?? 0
    const afrrUpCap = Math.max(1e-6, input.afrrUpCapacityMW ?? 400)
    const afrrDownCap = Math.max(1e-6, input.afrrDownCapacityMW ?? 400)
    const afrrUpSat = Math.max(0, afrrActivated) / afrrUpCap
    const afrrDownSat = Math.max(0, -afrrActivated) / afrrDownCap
    const afrrSaturated = afrrUpSat >= AFRR_SATURATION_FRAC_TRIGGER || afrrDownSat >= AFRR_SATURATION_FRAC_TRIGGER

    const needUp = freqLow || pImbalanceMW < -IMBALANCE_TRIGGER_MW || (afrrSaturated && input.frequencyHz < F_NOM_HZ)
    const needDown = freqHigh || pImbalanceMW > IMBALANCE_TRIGGER_MW || (afrrSaturated && input.frequencyHz > F_NOM_HZ)

    if (needUp || needDown) {
      this.persistentTimerS += dt
    } else {
      this.persistentTimerS = Math.max(0, this.persistentTimerS - 2 * dt)
    }

    // If persistent, schedule new blocks
    if (this.persistentTimerS >= PERSISTENCE_S) {
      const direction = needUp ? 1 : (needDown ? -1 : 0)
      if (direction !== 0) {
        // Estimate how much we want
        let desiredMW = input.netImbalanceMW !== undefined 
          ? clamp(Math.abs(pImbalanceMW), 0, 2000)
          : 500.0
        desiredMW = Math.min(desiredMW, MAX_BLOCKS_PER_ACTIVATION * BLOCK_SIZE_MW)

        let desiredBlocks = Math.round(desiredMW / BLOCK_SIZE_MW)
        desiredBlocks = clamp(desiredBlocks, 1, MAX_BLOCKS_PER_ACTIVATION)
        const scheduleMW = direction * desiredBlocks * BLOCK_SIZE_MW

        // Respect remaining capacity
        const pendingSumMW = this.pending.reduce((sum, b) => sum + b.mw, 0)
        const currentPlusPendingMW = this.activatedMW + pendingSumMW

        const remainingUp = Math.max(0, upCap - Math.max(0, currentPlusPendingMW))
        const remainingDown = Math.max(0, downCap - Math.max(0, -currentPlusPendingMW))

        let feasibleScheduleMW: number
        if (scheduleMW > 0) {
          feasibleScheduleMW = Math.min(scheduleMW, remainingUp)
        } else {
          feasibleScheduleMW = Math.max(scheduleMW, -remainingDown)
        }

        if (Math.abs(feasibleScheduleMW) >= BLOCK_SIZE_MW) {
          this.pending.push({
            mw: feasibleScheduleMW,
            timeToGoS: ACTIVATION_DELAY_S,
          })
          this.persistentTimerS = 0 // reset timer so we don't schedule every second
        }
      }
    }

    // Advance pending queue
    for (const block of this.pending) {
      block.timeToGoS = Math.max(0, block.timeToGoS - dt)
    }

    // Sum arrived blocks
    const arrivedBlocksMW = this.pending
      .filter(b => b.timeToGoS === 0)
      .reduce((sum, b) => sum + b.mw, 0)

    // Remove arrived entries
    this.pending = this.pending.filter(b => b.timeToGoS > 0)

    // Compute new target activation after arrivals
    let targetMW = this.activatedMW + arrivedBlocksMW
    targetMW = clamp(targetMW, -downCap, upCap)

    // Ramp actual activated toward target
    const delta = targetMW - this.activatedMW
    let deltaLimited: number
    if (delta >= 0) {
      deltaLimited = Math.min(delta, RAMP_UP_MW_PER_S * dt)
    } else {
      deltaLimited = Math.max(delta, -RAMP_DOWN_MW_PER_S * dt)
    }
    this.activatedMW += deltaLimited

    const pendingMW = this.pending.reduce((sum, b) => sum + b.mw, 0)

    this.lastBreakdown = {
      activatedMW: this.activatedMW,
      upUsedMW: Math.max(0, this.activatedMW),
      downUsedMW: Math.max(0, -this.activatedMW),
      pendingMW,
      pendingCount: this.pending.length,
      persistentTimerS: this.persistentTimerS,
      availableUpMW: upCap,
      availableDownMW: downCap,
    }

    return this.lastBreakdown
  }

  get breakdown(): MFRRBreakdown | null {
    return this.lastBreakdown
  }

  get currentActivatedMW(): number {
    return this.activatedMW
  }

  reset(): void {
    this.activatedMW = 0
    this.pending = []
    this.persistentTimerS = 0
    this.lastBreakdown = null
  }
}
