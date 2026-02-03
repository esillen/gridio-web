export interface ImbalanceSettlementInput {
  timeNowUnixS: number
  playerDAScheduleMW24: number[]
  scheduleAnchorUnixS: number
  actualNetPowerMW: number
  systemFrequencyHz: number
  systemImbalanceMW: number
  daPriceEurPerMWh24: number[]
  imbPriceUpEurPerMWh96: number[]
  imbPriceDownEurPerMWh96: number[]
  pricesAnchorUnixS: number
  feesEnabled: boolean
}

export type SystemDirection = 'up_regulating' | 'down_regulating' | 'no_regulation'

export interface LastSettlement {
  ispStartUnixS: number
  ispEndUnixS: number
  systemDirection: SystemDirection
  settlementPriceEurPerMWh: number
  deviationMWh: number
  imbalanceCashflowEur: number
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
  cumulativeNetCashEur: number
  forecast4h: SettlementForecastOutput
}

export interface SettlementSnapshot {
  time: number
  settlementPriceEurPerMWh: number
}

export class ImbalanceSettlementModel {
  private readonly ISP_STEP_S = 900 // 15 minutes
  private readonly SYSTEM_REGULATION_DEADBAND_MW = 150.0
  private readonly FREQ_NOM_HZ = 50.0
  private readonly FREQ_DEADBAND_HZ = 0.01
  private readonly ESETT_VOLUME_FEE_EUR_PER_MWH = 2.0
  private readonly ESETT_IMBALANCE_FEE_EUR_PER_MWH = 1.15
  private readonly ESETT_WEEKLY_FEE_EUR = 30.0
  private readonly FORECAST_HORIZON_S = 14400 // 4 hours
  private readonly FORECAST_STEP_S = 900 // 15 minutes
  private readonly HISTORY_SAMPLE_INTERVAL_S = 10

  private currentIspStartUnixS = 0
  private accActualMWh = 0
  private accScheduledMWh = 0
  private accSystemImbalanceMWh = 0

  private lastSettlement: LastSettlement = {
    ispStartUnixS: 0,
    ispEndUnixS: 0,
    systemDirection: 'no_regulation',
    settlementPriceEurPerMWh: 0,
    deviationMWh: 0,
    imbalanceCashflowEur: 0,
    feeVolumeEur: 0,
    feeImbalanceEur: 0,
    feeWeeklyAllocEur: 0,
    netCashflowEur: 0,
  }

  private cumulativeDeviationMWh = 0
  private cumulativeNetCashEur = 0
  private _history: SettlementSnapshot[] = []

  get history(): SettlementSnapshot[] {
    return this._history
  }

  reset(startUnixS: number): void {
    this.currentIspStartUnixS = Math.floor(startUnixS / this.ISP_STEP_S) * this.ISP_STEP_S
    this.accActualMWh = 0
    this.accScheduledMWh = 0
    this.accSystemImbalanceMWh = 0
    this.cumulativeDeviationMWh = 0
    this.cumulativeNetCashEur = 0
    this._history = []
    this.lastSettlement = {
      ispStartUnixS: 0,
      ispEndUnixS: 0,
      systemDirection: 'no_regulation',
      settlementPriceEurPerMWh: 0,
      deviationMWh: 0,
      imbalanceCashflowEur: 0,
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
      const avgSysImbalanceMW = this.accSystemImbalanceMWh * (3600.0 / this.ISP_STEP_S)
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

      // Look up prices
      const kPrice = this.idxQh(input.pricesAnchorUnixS, ispStart)
      const hPrice = this.idxHour(input.pricesAnchorUnixS, ispStart)

      const daRefPrice = input.daPriceEurPerMWh24[hPrice] ?? 0
      const upPrice = input.imbPriceUpEurPerMWh96[kPrice] ?? 0
      const downPrice = input.imbPriceDownEurPerMWh96[kPrice] ?? 0

      const settlementPrice =
        systemDirection === 'up_regulating'
          ? upPrice
          : systemDirection === 'down_regulating'
          ? downPrice
          : daRefPrice

      // Deviation vs DA schedule
      const deviationMWh = this.accActualMWh - this.accScheduledMWh

      // One-price cashflow
      const imbalanceCashflowEur = deviationMWh * settlementPrice

      // Fees
      const feeVolumeEur = input.feesEnabled ? Math.abs(this.accActualMWh) * this.ESETT_VOLUME_FEE_EUR_PER_MWH : 0
      const feeImbalanceEur = input.feesEnabled ? Math.abs(deviationMWh) * this.ESETT_IMBALANCE_FEE_EUR_PER_MWH : 0
      const feeWeeklyAllocEur = input.feesEnabled
        ? this.ESETT_WEEKLY_FEE_EUR / (7.0 * 24.0 * (3600.0 / this.ISP_STEP_S))
        : 0

      const netCashflowEur = imbalanceCashflowEur - feeVolumeEur - feeImbalanceEur - feeWeeklyAllocEur

      // Store last settlement
      this.lastSettlement = {
        ispStartUnixS: ispStart,
        ispEndUnixS: ispEnd,
        systemDirection,
        settlementPriceEurPerMWh: settlementPrice,
        deviationMWh,
        imbalanceCashflowEur,
        feeVolumeEur,
        feeImbalanceEur,
        feeWeeklyAllocEur,
        netCashflowEur,
      }

      // Update totals
      this.cumulativeDeviationMWh += deviationMWh
      this.cumulativeNetCashEur += netCashflowEur

      // Reset accumulators and advance to new ISP
      this.currentIspStartUnixS = ispStartNow
      this.accActualMWh = 0
      this.accScheduledMWh = 0
      this.accSystemImbalanceMWh = 0
    }

    // Accumulate within current ISP
    const dtH = dtS / 3600.0

    // Scheduled MW for this second
    const hSched = this.idxHour(input.scheduleAnchorUnixS, input.timeNowUnixS)
    const scheduledMWNow = input.playerDAScheduleMW24[hSched] ?? 0

    this.accScheduledMWh += scheduledMWNow * dtH
    this.accActualMWh += input.actualNetPowerMW * dtH
    this.accSystemImbalanceMWh += input.systemImbalanceMW * dtH

    // Update current time and record history
    const relativeTimeS = input.timeNowUnixS - input.scheduleAnchorUnixS
    if (relativeTimeS >= 0 && relativeTimeS % this.HISTORY_SAMPLE_INTERVAL_S === 0) {
      // Calculate current expected settlement price based on system state
      const kPrice = this.idxQh(input.pricesAnchorUnixS, input.timeNowUnixS)
      const hPrice = this.idxHour(input.pricesAnchorUnixS, input.timeNowUnixS)
      
      const daRefPrice = input.daPriceEurPerMWh24[hPrice] ?? 0
      const upPrice = input.imbPriceUpEurPerMWh96[kPrice] ?? 0
      const downPrice = input.imbPriceDownEurPerMWh96[kPrice] ?? 0
      
      // Determine current system direction
      const dfHz = this.FREQ_NOM_HZ - input.systemFrequencyHz
      let currentPrice = daRefPrice
      
      if (input.systemImbalanceMW <= -this.SYSTEM_REGULATION_DEADBAND_MW || dfHz > this.FREQ_DEADBAND_HZ) {
        currentPrice = upPrice
      } else if (input.systemImbalanceMW >= this.SYSTEM_REGULATION_DEADBAND_MW || dfHz < -this.FREQ_DEADBAND_HZ) {
        currentPrice = downPrice
      }
      
      this._history.push({
        time: relativeTimeS,
        settlementPriceEurPerMWh: currentPrice,
      })
    }

    // Generate forecast
    const forecast4h = this.generateForecast(input)

    return {
      currentIspStartUnixS: this.currentIspStartUnixS,
      currentIspEndUnixS: this.currentIspStartUnixS + this.ISP_STEP_S,
      secondsIntoIsp: input.timeNowUnixS - this.currentIspStartUnixS,
      scheduledMWhSoFar: this.accScheduledMWh,
      actualMWhSoFar: this.accActualMWh,
      deviationMWhSoFar: this.accActualMWh - this.accScheduledMWh,
      lastSettlement: { ...this.lastSettlement },
      cumulativeDeviationMWh: this.cumulativeDeviationMWh,
      cumulativeNetCashEur: this.cumulativeNetCashEur,
      forecast4h,
    }
  }

  private generateForecast(input: ImbalanceSettlementInput): SettlementForecastOutput {
    const startUnixS = Math.floor(input.timeNowUnixS / this.ISP_STEP_S) * this.ISP_STEP_S
    const N = this.FORECAST_HORIZON_S / this.FORECAST_STEP_S
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

  private idxQh(anchorUnixS: number, tUnixS: number): number {
    return Math.max(0, Math.min(95, Math.floor((tUnixS - anchorUnixS) / 900)))
  }
}
