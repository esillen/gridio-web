export interface HourlyDAPerformance {
  hour: number
  bidMWh: number
  deliveredMWh: number
}

export interface HourlyFCRPerformance {
  hour: number
  allocatedMW: number
  requiredMWh: number
  deliveredMWh: number
  failedMWh: number
}

export class BESSPerformanceTracker {
  private _daPerformance: HourlyDAPerformance[] = []
  private _fcrPerformance: HourlyFCRPerformance[] = []
  private _currentHourDADelivered = 0
  private _currentHourFCRRequired = 0
  private _currentHourFCRDelivered = 0
  private _lastHourDA = -1
  private _lastHourFCR = -1

  reset(): void {
    this._daPerformance = Array.from({ length: 24 }, (_, h) => ({
      hour: h,
      bidMWh: 0,
      deliveredMWh: 0,
    }))
    this._fcrPerformance = Array.from({ length: 24 }, (_, h) => ({
      hour: h,
      allocatedMW: 0,
      requiredMWh: 0,
      deliveredMWh: 0,
      failedMWh: 0,
    }))
    this._currentHourDADelivered = 0
    this._currentHourFCRRequired = 0
    this._currentHourFCRDelivered = 0
    this._lastHourDA = -1
    this._lastHourFCR = -1
  }

  setBids(daBids: number[], fcrBids: number[]): void {
    for (let h = 0; h < 24; h++) {
      const daPerf = this._daPerformance[h]
      const fcrPerf = this._fcrPerformance[h]
      if (daPerf) daPerf.bidMWh = daBids[h] ?? 0
      if (fcrPerf) fcrPerf.allocatedMW = fcrBids[h] ?? 0
    }
  }

  tickDA(hour: number, deliveredMW: number, dtS: number): void {
    if (hour !== this._lastHourDA && this._lastHourDA >= 0 && this._lastHourDA < 24) {
      const prev = this._daPerformance[this._lastHourDA]
      if (prev) prev.deliveredMWh = this._currentHourDADelivered
      this._currentHourDADelivered = 0
    }
    this._lastHourDA = hour
    this._currentHourDADelivered += deliveredMW * (dtS / 3600)
    const current = this._daPerformance[hour]
    if (current) current.deliveredMWh = this._currentHourDADelivered
  }

  tickFCR(hour: number, requiredMW: number, deliveredMW: number, dtS: number): void {
    if (hour !== this._lastHourFCR && this._lastHourFCR >= 0 && this._lastHourFCR < 24) {
      this._currentHourFCRRequired = 0
      this._currentHourFCRDelivered = 0
    }
    this._lastHourFCR = hour

    const requiredMWh = Math.abs(requiredMW) * (dtS / 3600)
    const deliveredMWh = Math.abs(deliveredMW) * (dtS / 3600)
    
    this._currentHourFCRRequired += requiredMWh
    this._currentHourFCRDelivered += deliveredMWh
    
    const perf = this._fcrPerformance[hour]
    if (perf) {
      perf.requiredMWh = this._currentHourFCRRequired
      perf.deliveredMWh = this._currentHourFCRDelivered
      perf.failedMWh = Math.max(0, this._currentHourFCRRequired - this._currentHourFCRDelivered)
    }
  }

  get daPerformance(): HourlyDAPerformance[] {
    return this._daPerformance
  }

  get fcrPerformance(): HourlyFCRPerformance[] {
    return this._fcrPerformance
  }
}
