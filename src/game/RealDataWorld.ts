import { HISTORY_SAMPLE_INTERVAL_S, type GridSnapshot } from './PowerGrid'
import { loadRealDataDay } from '../data/real'
import type { RealDataDay } from '../data/real'
import type { FrequencyBand } from '../system_model'
import type {
  WeatherSnapshot,
  ConsumptionSnapshot,
  ProductionSnapshot,
  FrequencySnapshot,
  BalancingSnapshot,
} from './WorldSimulation'
import type { WeatherRegionsOutput, ForecastRegionalOutput } from '../system_model'
import type {
  HeatingBreakdown,
  NonHeatingBreakdown,
  ServicesBreakdown,
  TransportBreakdown,
  IndustryBreakdown,
  GridLossesBreakdown,
  NuclearBreakdown,
  HydroBreakdown,
  RoRBreakdown,
  WindFleetRegionalBreakdown,
  SolarFleetRegionalBreakdown,
  CHPBreakdown,
  IndustrialCHPBreakdown,
  PeakersBreakdown,
  InterconnectorBreakdown,
  FrequencyBreakdown,
} from '../system_model'

function frequencyBandFromHz(frequencyHz: number): FrequencyBand {
  if (frequencyHz >= 49.9 && frequencyHz <= 50.1) return 'normal'
  if (frequencyHz >= 49.8 && frequencyHz <= 50.2) return 'off_normal'
  if (frequencyHz >= 49.5 && frequencyHz <= 50.5) return 'alert'
  if (frequencyHz >= 49.0 && frequencyHz <= 51.0) return 'emergency'
  return 'blackout'
}

function sampleProduction(data: RealDataDay, timeS: number): RealDataDay['production']['points'][0] {
  const idx = Math.min(95, Math.floor(timeS / 900))
  return data.production.points[idx] ?? data.production.points[0]!
}

function sampleConsumption(data: RealDataDay, timeS: number): RealDataDay['consumption']['points'][0] {
  const idx = Math.min(95, Math.floor(timeS / 900))
  return data.consumption.points[idx] ?? data.consumption.points[0]!
}

function sampleFrequency(data: RealDataDay, timeS: number): RealDataDay['frequency']['points'][0] {
  const idx = Math.min(86399, Math.max(0, Math.floor(timeS)))
  return data.frequency.points[idx] ?? data.frequency.points[0]!
}

export class RealDataWorld {
  private _data: RealDataDay
  private _currentTime = 0
  private _gridHistory: GridSnapshot[] = []
  private _consumptionHistory: ConsumptionSnapshot[] = []
  private _productionHistory: ProductionSnapshot[] = []
  private _frequencyHistory: FrequencySnapshot[] = []
  private _weatherHistory: WeatherSnapshot[] = []
  private _balancingHistory: BalancingSnapshot[] = []

  constructor(day: string) {
    this._data = loadRealDataDay(day)
  }

  initialize(): void {
    this._currentTime = 0
    this._gridHistory = []
    this._consumptionHistory = []
    this._productionHistory = []
    this._frequencyHistory = []
    this._weatherHistory = []
    this._balancingHistory = []
  }

  resetToStartOfDay(): void {
    this._currentTime = 0
    this._gridHistory = []
    this._consumptionHistory = []
    this._productionHistory = []
    this._frequencyHistory = []
    this._weatherHistory = []
    this._balancingHistory = []
  }

  tick(): void {
    const t = this._currentTime
    const freq = sampleFrequency(this._data, t)
    const prod = sampleProduction(this._data, t)
    const cons = sampleConsumption(this._data, t)
    const band = frequencyBandFromHz(freq.frequencyHz)

    if (t >= 0 && t % HISTORY_SAMPLE_INTERVAL_S === 0) {
      this._gridHistory.push({
        time: t,
        production: prod.totalMW,
        consumption: cons.totalMW,
        imbalance: prod.totalMW - cons.totalMW,
      })
      this._consumptionHistory.push({
        time: t,
        heatingMW: cons.heatingMW,
        nonHeatingMW: cons.nonHeatingMW,
        servicesMW: cons.servicesMW,
        transportMW: cons.transportMW,
        industryMW: cons.industryMW,
        lossesMW: cons.lossesMW,
        exportsMW: cons.exportsMW,
        totalMW: cons.totalMW,
      })
      this._productionHistory.push({
        time: t,
        nuclearMW: prod.nuclearMW,
        hydroReservoirMW: prod.hydroReservoirMW,
        hydroRoRMW: prod.hydroRoRMW,
        windMW: prod.windMW,
        solarMW: prod.solarMW,
        chpMW: prod.chpMW,
        industrialChpMW: prod.industrialChpMW,
        peakersMW: prod.peakersMW,
        interconnectorsMW: prod.interconnectorsMW,
        totalMW: prod.totalMW,
      })
      this._frequencyHistory.push({
        time: t,
        frequencyHz: freq.frequencyHz,
        rocofHzPerS: freq.rocofHzPerS,
        imbalanceMW: freq.imbalanceMW,
        band,
        hEquivS: 5,
        sBaseMW: 25000,
      })
    }

    this._currentTime++
  }

  get currentTime(): number {
    return this._currentTime
  }

  get gridHistory(): GridSnapshot[] {
    return this._gridHistory
  }

  get weatherHistory(): WeatherSnapshot[] {
    return this._weatherHistory
  }

  get consumptionHistory(): ConsumptionSnapshot[] {
    return this._consumptionHistory
  }

  get productionHistory(): ProductionSnapshot[] {
    return this._productionHistory
  }

  get frequencyHistory(): FrequencySnapshot[] {
    return this._frequencyHistory
  }

  get balancingHistory(): BalancingSnapshot[] {
    return this._balancingHistory
  }

  get latestGridSnapshot(): GridSnapshot | null {
    return this._gridHistory[this._gridHistory.length - 1] ?? null
  }

  get latestWeatherSnapshot(): WeatherSnapshot | null {
    return null
  }

  get currentWeather(): WeatherRegionsOutput | null {
    return null
  }

  get forecastRegional(): ForecastRegionalOutput | null {
    return null
  }

  get heatingBreakdown(): HeatingBreakdown | null {
    return null
  }
  get nonHeatingBreakdown(): NonHeatingBreakdown | null {
    return null
  }
  get servicesBreakdown(): ServicesBreakdown | null {
    return null
  }
  get transportBreakdown(): TransportBreakdown | null {
    return null
  }
  get industryBreakdown(): IndustryBreakdown | null {
    return null
  }
  get gridLossesBreakdown(): GridLossesBreakdown | null {
    return null
  }
  get nuclearBreakdown(): NuclearBreakdown | null {
    return null
  }
  get hydroReservoirBreakdown(): HydroBreakdown | null {
    return null
  }
  get hydroRoRBreakdown(): RoRBreakdown | null {
    return null
  }
  get windBreakdown(): WindFleetRegionalBreakdown | null {
    return null
  }
  get solarBreakdown(): SolarFleetRegionalBreakdown | null {
    return null
  }
  get chpBreakdown(): CHPBreakdown | null {
    return null
  }
  get industrialChpBreakdown(): IndustrialCHPBreakdown | null {
    return null
  }
  get peakersBreakdown(): PeakersBreakdown | null {
    return null
  }
  get interconnectorsBreakdown(): InterconnectorBreakdown | null {
    return null
  }
  get frequencyBreakdown(): FrequencyBreakdown | null {
    return null
  }
  get currentFrequencyHz(): number {
    const f = sampleFrequency(this._data, this._currentTime)
    return f.frequencyHz
  }
  get currentFrequencyBand(): FrequencyBand {
    return frequencyBandFromHz(this.currentFrequencyHz)
  }

  get marketPricesDay(): { daEurPerMWh: number[]; fcrEurPerMWPerH: number[] } {
    return {
      daEurPerMWh: this._data.prices.daEurPerMWh,
      fcrEurPerMWPerH: this._data.prices.fcrEurPerMWPerH,
    }
  }
  get imbalancePricesDay(): { upEurPerMWh24: number[]; downEurPerMWh24: number[] } {
    return {
      upEurPerMWh24: this._data.prices.imbalanceUpEurPerMWh,
      downEurPerMWh24: this._data.prices.imbalanceDownEurPerMWh,
    }
  }

  reset(): void {
    this.initialize()
  }
}
