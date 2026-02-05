export interface GameplayCorrectionInput {
  frequencyHz: number
  imbalanceMW: number
}

export interface GameplayCorrectionOutput {
  correctionMW: number
}

const CONSTANTS = {
  freqTargetHz: 50.0,
  
  // Frequency PID gains
  freqKp: 2000.0,      // MW per Hz error
  freqKi: 800.0,       // MW per Hz*s
  
  // Imbalance PI gains
  imbKp: 0.3,          // Fraction of imbalance
  imbKi: 0.15,         // Integral gain
  
  // Limits
  maxCorrectionMW: 2000.0,
  integralLimitHz: 1.0,
  integralLimitMW: 5000.0,
  
  // Smoothing
  tauSmoothS: 3.0,
}

function clamp(x: number, min: number, max: number): number {
  return Math.min(Math.max(x, min), max)
}


// This model applies a little bit of magic to correct for faulty models.
export class GameplayCorrectionModel {
  private freqIntegral = 0
  private imbalanceIntegral = 0
  private smoothedCorrectionMW = 0

  tick(input: GameplayCorrectionInput): GameplayCorrectionOutput {
    const dt = 1.0
    const C = CONSTANTS

    // Frequency error (positive when freq too low)
    const freqError = C.freqTargetHz - input.frequencyHz

    // Update frequency integral with anti-windup
    this.freqIntegral += freqError * dt
    this.freqIntegral = clamp(this.freqIntegral, -C.integralLimitHz, C.integralLimitHz)

    // Frequency PI correction
    const freqCorrectionMW = C.freqKp * freqError + C.freqKi * this.freqIntegral

    // Imbalance integral with anti-windup
    this.imbalanceIntegral += input.imbalanceMW * dt
    this.imbalanceIntegral = clamp(this.imbalanceIntegral, -C.integralLimitMW, C.integralLimitMW)

    // Imbalance PI correction (negative because we want to counter the imbalance)
    const imbCorrectionMW = -C.imbKp * input.imbalanceMW - C.imbKi * this.imbalanceIntegral

    // Combined and clamped
    const totalCorrectionMW = clamp(
      freqCorrectionMW + imbCorrectionMW,
      -C.maxCorrectionMW,
      C.maxCorrectionMW
    )

    // Smooth the output to avoid sudden jumps
    this.smoothedCorrectionMW += (totalCorrectionMW - this.smoothedCorrectionMW) * (dt / C.tauSmoothS)

    // DISABLED FOR TESTING - to re-enable, uncomment the line below and comment out the return 0 line
    // return { correctionMW: this.smoothedCorrectionMW }
    return {
      correctionMW: 0,  // Disabled - FFR testing
    }
  }

  reset(): void {
    this.freqIntegral = 0
    this.imbalanceIntegral = 0
    this.smoothedCorrectionMW = 0
  }
}
