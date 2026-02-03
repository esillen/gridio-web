export interface ImbalanceSettlementInput {
  timeNowUnixS: number
  playerDAScheduleMW24: number[]
  playerFCRScheduleMW24: number[]
  scheduleAnchorUnixS: number
  actualDADeliveredMW: number
  fcrRequiredMW: number
  fcrDeliveredMW: number
  systemFrequencyHz: number
  systemImbalanceMW: number
  daPriceEurPerMWh24: number[]
  imbPriceUpEurPerMWh24: number[]
  imbPriceDownEurPerMWh24: number[]
  pricesAnchorUnixS: number
  feesEnabled: boolean
}

export type SystemDirection = 'up_regulating' | 'down_regulating' | 'no_regulation'

export interface LastSettlement {
  ispStartUnixS: number
  ispEndUnixS: number
  systemDirection: SystemDirection
  settlementPriceEurPerMWh: number
  daDeviationMWh: number
  fcrShortfallMWh: number
  daImbalanceCashflowEur: number
  fcrPenaltyEur: number
  feeVolumeEur: number
  feeImbalanceEur: number
  feeWeeklyAllocEur: number
  netCashflowEur: number
}

export interface SettlementForecastOutput {
  startUnixS: number
  stepS: number
  expectedSettlementPriceEurPerMWh: number[]
}

export interface ImbalanceSettlementOutput {
  currentIspStartUnixS: number
  currentIspEndUnixS: number
  secondsIntoIsp: number
  scheduledMWhSoFar: number
  actualMWhSoFar: number
  deviationMWhSoFar: number
  lastSettlement: LastSettlement
  cumulativeDeviationMWh: number
  cumulativeFcrShortfallMWh: number
  cumulativeNetCashEur: number
  forecast4h: SettlementForecastOutput
}

export interface SettlementSnapshot {
  time: number
  settlementPriceEurPerMWh: number
}

export class ImbalanceSettlementModel {
  private readonly ISP_STEP_S = 3600 // 1 hour
  private readonly SYSTEM_REGULATION_DEADBAND_MW = 150.0
  private readonly FREQ_NOM_HZ = 50.0
  private readonly FREQ_DEADBAND_HZ = 0.01
  private readonly ESETT_VOLUME_FEE_EUR_PER_MWH = 2.0
  private readonly ESETT_IMBALANCE_FEE_EUR_PER_MWH = 1.15
  private readonly ESETT_WEEKLY_FEE_EUR = 30.0
  private readonly FCR_PENALTY_EUR_PER_MWH = 50.0 // Penalty for not delivering FCR
  private readonly FORECAST_HORIZON_S = 14400 // 4 hours
  private readonly FORECAST_STEP_S = 3600 // 1 hour

  private currentIspStartUnixS = 0
  private accDAScheduledMWh = 0
  private accDADeliveredMWh = 0
  private accFCRRequiredMWh = 0
  private accFCRDeliveredMWh = 0
  private accSystemImbalanceMWh = 0

  private lastSettlement: LastSettlement = {
    ispStartUnixS: 0,
    ispEndUnixS: 0,
    systemDirection: 'no_regulation',
    settlementPriceEurPerMWh: 0,
    daDeviationMWh: 0,
    fcrShortfallMWh: 0,
    daImbalanceCashflowEur: 0,
    fcrPenaltyEur: 0,
    feeVolumeEur: 0,
    feeImbalanceEur: 0,
    feeWeeklyAllocEur: 0,
    netCashflowEur: 0,
  }

  private cumulativeDeviationMWh = 0
  private cumulativeFcrShortfallMWh = 0
  private cumulativeNetCashEur = 0
  private _history: SettlementSnapshot[] = []

  get history(): SettlementSnapshot[] {
    return this._history
  }

  reset(startUnixS: number): void {
    this.currentIspStartUnixS = Math.floor(startUnixS / this.ISP_STEP_S) * this.ISP_STEP_S
    this.accDAScheduledMWh = 0
    this.accDADeliveredMWh = 0
    this.accFCRRequiredMWh = 0
    this.accFCRDeliveredMWh = 0
    this.accSystemImbalanceMWh = 0
    this.cumulativeDeviationMWh = 0
    this.cumulativeFcrShortfallMWh = 0
    this.cumulativeNetCashEur = 0
    this._history = []
    this.lastSettlement = {
      ispStartUnixS: 0,
      ispEndUnixS: 0,
      systemDirection: 'no_regulation',
      settlementPriceEurPerMWh: 0,
      daDeviationMWh: 0,
      fcrShortfallMWh: 0,
      daImbalanceCashflowEur: 0,
      fcrPenaltyEur: 0,
      feeVolumeEur: 0,
      feeImbalanceEur: 0,
      feeWeeklyAllocEur: 0,
      netCashflowEur: 0,
    }
  }

  tick(input: ImbalanceSettlementInput, dtS: number): ImbalanceSettlementOutput {
    const ispStartNow = Math.floor(input.timeNowUnixS / this.ISP_STEP_S) * this.ISP_STEP_S
    const ispChanged = ispStartNow !== this.currentIspStartUnixS

    // If ISP changed, settle the previous ISP
    if (ispChanged && this.currentIspStartUnixS > 0) {
      const ispStart = this.currentIspStartUnixS
      const ispEnd = ispStart + this.ISP_STEP_S

      // Average system imbalance over ISP (MW)
      const avgSysImbalanceMW = this.accSystemImbalanceMWh
      const dfHz = this.FREQ_NOM_HZ - input.systemFrequencyHz

      // Determine regulation direction
      let systemDirection: SystemDirection
      if (avgSysImbalanceMW <= -this.SYSTEM_REGULATION_DEADBAND_MW || dfHz > this.FREQ_DEADBAND_HZ) {
        systemDirection = 'up_regulating'
      } else if (avgSysImbalanceMW >= this.SYSTEM_REGULATION_DEADBAND_MW || dfHz < -this.FREQ_DEADBAND_HZ) {
        systemDirection = 'down_regulating'
      } else {
        systemDirection = 'no_regulation'
      }

      // Look up prices (hourly now)
      const hPrice = this.idxHour(input.pricesAnchorUnixS, ispStart)

      const daRefPrice = input.daPriceEurPerMWh24[hPrice] ?? 0
      const upPrice = input.imbPriceUpEurPerMWh24[hPrice] ?? 0
      const downPrice = input.imbPriceDownEurPerMWh24[hPrice] ?? 0

      const settlementPrice =
        systemDirection === 'up_regulating'
          ? upPrice
          : systemDirection === 'down_regulating'
          ? downPrice
          : daRefPrice

      // DA deviation vs schedule
      const daDeviationMWh = this.accDADeliveredMWh - this.accDAScheduledMWh

      // FCR shortfall (only penalize under-delivery)
      const fcrShortfallMWh = Math.max(0, Math.abs(this.accFCRRequiredMWh) - Math.abs(this.accFCRDeliveredMWh))

      // DA imbalance cashflow (one-price settlement)
      const daImbalanceCashflowEur = daDeviationMWh * settlementPrice

      // FCR penalty for shortfall
      const fcrPenaltyEur = fcrShortfallMWh * this.FCR_PENALTY_EUR_PER_MWH

      // Fees
      const totalActualMWh = Math.abs(this.accDADeliveredMWh) + Math.abs(this.accFCRDeliveredMWh)
      const totalDeviationMWh = Math.abs(daDeviationMWh) + fcrShortfallMWh
      const feeVolumeEur = input.feesEnabled ? totalActualMWh * this.ESETT_VOLUME_FEE_EUR_PER_MWH : 0
      const feeImbalanceEur = input.feesEnabled ? totalDeviationMWh * this.ESETT_IMBALANCE_FEE_EUR_PER_MWH : 0
      const feeWeeklyAllocEur = input.feesEnabled
        ? this.ESETT_WEEKLY_FEE_EUR / (7.0 * 24.0)
        : 0

      const netCashflowEur = daImbalanceCashflowEur - fcrPenaltyEur - feeVolumeEur - feeImbalanceEur - feeWeeklyAllocEur

      // Store last settlement
      this.lastSettlement = {
        ispStartUnixS: ispStart,
        ispEndUnixS: ispEnd,
        systemDirection,
        settlementPriceEurPerMWh: settlementPrice,
        daDeviationMWh,
        fcrShortfallMWh,
        daImbalanceCashflowEur,
        fcrPenaltyEur,
        feeVolumeEur,
        feeImbalanceEur,
        feeWeeklyAllocEur,
        netCashflowEur,
      }

      // Update totals
      this.cumulativeDeviationMWh += daDeviationMWh
      this.cumulativeFcrShortfallMWh += fcrShortfallMWh
      this.cumulativeNetCashEur += netCashflowEur

      // Record hourly history at the END of the settled hour
      // Settlement for hour H (H:00 to H+1:00) is recorded at time (H+1):00
      const settledHourIndex = this.idxHour(input.scheduleAnchorUnixS, ispStart)
      const settlementTimeS = (settledHourIndex + 1) * 3600
      if (settledHourIndex >= 0 && settledHourIndex < 24) {
        this._history.push({
          time: settlementTimeS,
          settlementPriceEurPerMWh: settlementPrice,
        })
      }

      // Reset accumulators and advance to new ISP
      this.currentIspStartUnixS = ispStartNow
      this.accDAScheduledMWh = 0
      this.accDADeliveredMWh = 0
      this.accFCRRequiredMWh = 0
      this.accFCRDeliveredMWh = 0
      this.accSystemImbalanceMWh = 0
    }

    // Accumulate within current ISP
    const dtH = dtS / 3600.0

    // Scheduled MW for this second (DA)
    const hSched = this.idxHour(input.scheduleAnchorUnixS, input.timeNowUnixS)
    const scheduledDAMWNow = input.playerDAScheduleMW24[hSched] ?? 0

    this.accDAScheduledMWh += scheduledDAMWNow * dtH
    this.accDADeliveredMWh += input.actualDADeliveredMW * dtH
    this.accFCRRequiredMWh += input.fcrRequiredMW * dtH
    this.accFCRDeliveredMWh += input.fcrDeliveredMW * dtH
    this.accSystemImbalanceMWh += input.systemImbalanceMW * dtH

    // Generate forecast
    const forecast4h = this.generateForecast(input)

    return {
      currentIspStartUnixS: this.currentIspStartUnixS,
      currentIspEndUnixS: this.currentIspStartUnixS + this.ISP_STEP_S,
      secondsIntoIsp: input.timeNowUnixS - this.currentIspStartUnixS,
      scheduledMWhSoFar: this.accDAScheduledMWh,
      actualMWhSoFar: this.accDADeliveredMWh,
      deviationMWhSoFar: this.accDADeliveredMWh - this.accDAScheduledMWh,
      lastSettlement: { ...this.lastSettlement },
      cumulativeDeviationMWh: this.cumulativeDeviationMWh,
      cumulativeFcrShortfallMWh: this.cumulativeFcrShortfallMWh,
      cumulativeNetCashEur: this.cumulativeNetCashEur,
      forecast4h,
    }
  }

  private generateForecast(input: ImbalanceSettlementInput): SettlementForecastOutput {
    const startUnixS = Math.floor(input.timeNowUnixS / this.ISP_STEP_S) * this.ISP_STEP_S
    const N = this.FORECAST_HORIZON_S / this.FORECAST_STEP_S // 4 hours
    const expectedPrices: number[] = []

    for (let i = 0; i < N; i++) {
      const tI = startUnixS + i * this.FORECAST_STEP_S
      const h = this.idxHour(input.pricesAnchorUnixS, tI)

      const daRef = input.daPriceEurPerMWh24[h] ?? 0

      // For forecast, assume no regulation (could be enhanced with system forecast)
      expectedPrices.push(daRef)
    }

    return {
      startUnixS,
      stepS: this.FORECAST_STEP_S,
      expectedSettlementPriceEurPerMWh: expectedPrices,
    }
  }

  private idxHour(anchorUnixS: number, tUnixS: number): number {
    return Math.max(0, Math.min(23, Math.floor((tUnixS - anchorUnixS) / 3600)))
  }
}
