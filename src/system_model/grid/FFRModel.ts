export interface FFRInput {
  frequencyHz: number
  rocofHzPerS: number
  availableCapacityMW: number
  energyBudgetMWh?: number
  enabled?: boolean
}

export interface FFRBreakdown {
  activationMW: number
  armed: boolean
  active: boolean
  rearmTimerS: number
  deliveredEnergyMWh: number
  capacityMW: number
}

const CONSTANTS = {
  triggerFreqHz: 49.70,
  triggerRocofHzPerS: -0.01,  // Very relaxed - FCR dampens RoCoF quickly
  criticalFreqHz: 49.60,      // Emergency trigger on frequency alone
  resetFreqHz: 49.85,
  resetRocofHzPerS: -0.02,
  rearmCooldownS: 900.0, // 15 minutes
  rampUpTimeS: 1.0,
  holdTimeS: 5.0,
  rampDownTimeS: 10.0,
  defaultEnergyPerMWMWh: 0.0042,
  maxActivationMW: 5000.0,
  minCapacityToArmMW: 10.0,
}

function clamp(x: number, min: number, max: number): number {
  return Math.min(Math.max(x, min), max)
}

function clamp01(x: number): number {
  return clamp(x, 0, 1)
}

export class FFRModel {
  private armed = true
  private active = false
  private timeSinceTriggerS = 0
  private deliveredEnergyMWh = 0
  private lastActivationMW = 0
  private rearmTimerS = 0
  private lastBreakdown: FFRBreakdown | null = null

  tick(input: FFRInput): FFRBreakdown {
    const dt = 1.0
    const enabled = input.enabled ?? true
    const f = input.frequencyHz
    const rocof = input.rocofHzPerS

    let capMW = clamp(input.availableCapacityMW, 0, CONSTANTS.maxActivationMW)
    if (capMW < CONSTANTS.minCapacityToArmMW) {
      capMW = 0
    }

    // Energy budget
    const energyBudgetMWh = input.energyBudgetMWh !== undefined
      ? Math.max(0, input.energyBudgetMWh)
      : capMW * CONSTANTS.defaultEnergyPerMWMWh

    // Rearm timer countdown
    this.rearmTimerS = Math.max(0, this.rearmTimerS - dt)

    // Arm/disarm logic
    const canArm = enabled && capMW > 0 && this.rearmTimerS === 0
    if (!canArm) {
      this.armed = false
    }
    if (canArm && !this.active) {
      this.armed = true
    }

    // Trigger condition: either frequency+RoCoF OR critically low frequency alone
    const normalTrigger = f <= CONSTANTS.triggerFreqHz && rocof <= CONSTANTS.triggerRocofHzPerS
    const emergencyTrigger = f <= CONSTANTS.criticalFreqHz  // Very low frequency - trigger regardless of RoCoF
    const trigger = this.armed && !this.active && (normalTrigger || emergencyTrigger)

    if (trigger) {
      this.active = true
      this.armed = false
      this.timeSinceTriggerS = 0
      this.deliveredEnergyMWh = 0
    }

    // Active delivery profile
    if (this.active) {
      this.timeSinceTriggerS += dt

      const t = this.timeSinceTriggerS
      let pu = 0

      // Piecewise profile
      if (t <= CONSTANTS.rampUpTimeS) {
        pu = clamp01(t / Math.max(1e-6, CONSTANTS.rampUpTimeS))
      } else if (t <= CONSTANTS.rampUpTimeS + CONSTANTS.holdTimeS) {
        pu = 1.0
      } else if (t <= CONSTANTS.rampUpTimeS + CONSTANTS.holdTimeS + CONSTANTS.rampDownTimeS) {
        const rampDownElapsed = t - CONSTANTS.rampUpTimeS - CONSTANTS.holdTimeS
        pu = clamp01(1.0 - rampDownElapsed / Math.max(1e-6, CONSTANTS.rampDownTimeS))
      } else {
        pu = 0
      }

      let desiredMW = capMW * pu

      // Enforce energy budget
      const dtH = dt / 3600
      const remainingMWh = Math.max(0, energyBudgetMWh - this.deliveredEnergyMWh)
      const maxMWFromEnergy = dtH > 0 ? remainingMWh / dtH : desiredMW
      const activationMW = Math.min(desiredMW, maxMWFromEnergy)

      this.deliveredEnergyMWh += activationMW * dtH
      this.lastActivationMW = activationMW

      // End conditions
      const finishedProfile = t > CONSTANTS.rampUpTimeS + CONSTANTS.holdTimeS + CONSTANTS.rampDownTimeS
      const depleted = remainingMWh <= 1e-6
      const recovered = f >= CONSTANTS.resetFreqHz && rocof >= CONSTANTS.resetRocofHzPerS

      if (finishedProfile || depleted || recovered) {
        this.active = false
        this.lastActivationMW = 0
        this.rearmTimerS = CONSTANTS.rearmCooldownS
      }
    }

    if (!this.active) {
      this.timeSinceTriggerS = 0
    }

    this.lastBreakdown = {
      activationMW: this.lastActivationMW,
      armed: this.armed,
      active: this.active,
      rearmTimerS: this.rearmTimerS,
      deliveredEnergyMWh: this.deliveredEnergyMWh,
      capacityMW: capMW,
    }

    return this.lastBreakdown
  }

  get breakdown(): FFRBreakdown | null {
    return this.lastBreakdown
  }

  get currentActivationMW(): number {
    return this.lastActivationMW
  }

  reset(): void {
    this.armed = true
    this.active = false
    this.timeSinceTriggerS = 0
    this.deliveredEnergyMWh = 0
    this.lastActivationMW = 0
    this.rearmTimerS = 0
    this.lastBreakdown = null
  }
}
