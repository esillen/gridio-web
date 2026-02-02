import { PowerGrid, type GridSnapshot } from './PowerGrid'
import { 
  WeatherModel, 
  ForecastModel, 
  ResidentialSpaceHeatingModel,
  ResidentialNonHeatingModel,
  ServicesCommercialModel,
  NuclearFleetModel,
  HydroReservoirFleetModel,
  type WeatherOutput, 
  type ForecastOutput, 
  type ForecastArrays,
  type HeatingBreakdown,
  type NonHeatingBreakdown,
  type ServicesBreakdown,
  type NuclearBreakdown,
  type HydroBreakdown
} from '../system_model'

export interface ClockState {
  timeS: number
  localHour: number
  localMinute: number
  localSecond: number
  dayOfYear: number
}

export interface WeatherSnapshot {
  time: number
  current: WeatherOutput
  forecast1h: ForecastOutput
  forecast6h: ForecastOutput
  forecast12h: ForecastOutput
  forecast24h: ForecastOutput
}

export interface ConsumptionSnapshot {
  time: number
  heatingMW: number
  nonHeatingMW: number
  servicesMW: number
  totalMW: number
}

export interface ProductionSnapshot {
  time: number
  nuclearMW: number
  hydroMW: number
  totalMW: number
}

export interface WorldConfig {
  startDayOfYear: number
}

export class WorldSimulation {
  private _grid: PowerGrid
  private _weather: WeatherModel
  private _forecast: ForecastModel
  private _heatingDemand: ResidentialSpaceHeatingModel
  private _nonHeatingDemand: ResidentialNonHeatingModel
  private _servicesDemand: ServicesCommercialModel
  private _nuclearFleet: NuclearFleetModel
  private _hydroFleet: HydroReservoirFleetModel
  private _currentTime = 0
  private _weatherHistory: WeatherSnapshot[] = []
  private _consumptionHistory: ConsumptionSnapshot[] = []
  private _productionHistory: ProductionSnapshot[] = []
  private _config: WorldConfig

  constructor(config: WorldConfig) {
    this._config = config
    this._grid = new PowerGrid()
    this._weather = new WeatherModel()
    this._forecast = new ForecastModel()
    this._heatingDemand = new ResidentialSpaceHeatingModel(
      'heating-residential',
      'Residential Space Heating'
    )
    this._nonHeatingDemand = new ResidentialNonHeatingModel(
      'non-heating-residential',
      'Residential Non-Heating'
    )
    this._servicesDemand = new ServicesCommercialModel(
      'services-commercial',
      'Services & Commercial'
    )
    this._nuclearFleet = new NuclearFleetModel()
    this._hydroFleet = new HydroReservoirFleetModel()
  }

  initialize(): void {
    this._grid.reset()
    this._weather.reset()
    this._forecast.reset()
    this._heatingDemand.reset(this._weather.state.temperatureC)
    this._nonHeatingDemand.reset()
    this._servicesDemand.reset()
    this._nuclearFleet.reset()
    this._hydroFleet.reset()
    this._currentTime = 0
    this._weatherHistory = []
    this._consumptionHistory = []
    this._productionHistory = []

    // Connect supply models
    this._grid.connect(this._nuclearFleet)
    this._grid.connect(this._hydroFleet)

    // Connect demand models
    this._grid.connect(this._heatingDemand)
    this._grid.connect(this._nonHeatingDemand)
    this._grid.connect(this._servicesDemand)
  }

  tick(): void {
    const clock = this.getClock()

    // Update weather
    const weatherOutput = this._weather.tick(clock)

    // Update forecast
    this._forecast.tick(clock, {
      temperatureC: weatherOutput.temperatureC,
      frontOffsetC: this._weather.state.frontOffsetC,
      windSpeed100mMps: weatherOutput.windSpeed100mMps,
      cloudCover01: weatherOutput.cloudCover01,
      precipitationSnowMmph: weatherOutput.precipitationSnowMmph,
      icingRisk01: weatherOutput.icingRisk01,
    })

    // Update nuclear fleet
    this._nuclearFleet.tick(this._currentTime)

    // Update hydro fleet
    this._hydroFleet.tick(this._currentTime)

    // Update heating demand model with current weather
    this._heatingDemand.tick({
      temperatureOutdoorC: weatherOutput.temperatureC,
      windSpeedMps: weatherOutput.windSpeed100mMps,
      localHour: clock.localHour,
    })

    // Update non-heating demand model
    this._nonHeatingDemand.tick({
      localHour: clock.localHour,
      localMinute: clock.localMinute,
      dayOfWeek: 0,
      temperatureOutdoorC: weatherOutput.temperatureC,
      cloudCover01: weatherOutput.cloudCover01,
      includeDHW: true,
      includeEV: false,
    })

    // Update services/commercial demand model
    this._servicesDemand.tick({
      localHour: clock.localHour,
      localMinute: clock.localMinute,
      dayOfWeek: 0,
      temperatureOutdoorC: weatherOutput.temperatureC,
      cloudCover01: weatherOutput.cloudCover01,
    })

    // Record weather snapshot
    const weatherSnapshot: WeatherSnapshot = {
      time: this._currentTime,
      current: weatherOutput,
      forecast1h: this._forecast.getForecast(3600),
      forecast6h: this._forecast.getForecast(6 * 3600),
      forecast12h: this._forecast.getForecast(12 * 3600),
      forecast24h: this._forecast.getForecast(24 * 3600),
    }
    this._weatherHistory.push(weatherSnapshot)

    // Record consumption breakdown
    const heatingMW = this._heatingDemand.consumptionMW
    const nonHeatingMW = this._nonHeatingDemand.consumptionMW
    const servicesMW = this._servicesDemand.consumptionMW
    this._consumptionHistory.push({
      time: this._currentTime,
      heatingMW,
      nonHeatingMW,
      servicesMW,
      totalMW: heatingMW + nonHeatingMW + servicesMW,
    })

    // Record production breakdown
    const nuclearMW = this._nuclearFleet.productionMW
    const hydroMW = this._hydroFleet.productionMW
    this._productionHistory.push({
      time: this._currentTime,
      nuclearMW,
      hydroMW,
      totalMW: nuclearMW + hydroMW,
    })

    // Update grid (collects updates from all connected actors)
    this._grid.tick()

    this._currentTime++
  }

  private getClock(): ClockState {
    const totalSeconds = this._currentTime
    const localHour = Math.floor(totalSeconds / 3600) % 24
    const localMinute = Math.floor((totalSeconds % 3600) / 60)
    const localSecond = totalSeconds % 60

    return {
      timeS: totalSeconds,
      localHour,
      localMinute,
      localSecond,
      dayOfYear: this._config.startDayOfYear,
    }
  }

  get currentTime(): number {
    return this._currentTime
  }

  get gridHistory(): GridSnapshot[] {
    return this._grid.history
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

  get latestGridSnapshot(): GridSnapshot | null {
    return this._grid.latestSnapshot
  }

  get latestWeatherSnapshot(): WeatherSnapshot | null {
    return this._weatherHistory[this._weatherHistory.length - 1] ?? null
  }

  get currentWeather(): WeatherOutput | null {
    return this.latestWeatherSnapshot?.current ?? null
  }

  get heatingBreakdown(): HeatingBreakdown | null {
    return this._heatingDemand.breakdown
  }

  get nonHeatingBreakdown(): NonHeatingBreakdown | null {
    return this._nonHeatingDemand.breakdown
  }

  get servicesBreakdown(): ServicesBreakdown | null {
    return this._servicesDemand.breakdown
  }

  get nuclearBreakdown(): NuclearBreakdown | null {
    return this._nuclearFleet.breakdown
  }

  get hydroBreakdown(): HydroBreakdown | null {
    return this._hydroFleet.breakdown
  }

  getForecast(deltaS: number): ForecastOutput {
    return this._forecast.getForecast(deltaS)
  }

  get forecastArrays(): ForecastArrays {
    return this._forecast.getArrays()
  }

  reset(): void {
    this._grid.reset()
    this._weather.reset()
    this._forecast.reset()
    this._heatingDemand.reset()
    this._nonHeatingDemand.reset()
    this._servicesDemand.reset()
    this._nuclearFleet.reset()
    this._hydroFleet.reset()
    this._currentTime = 0
    this._weatherHistory = []
    this._consumptionHistory = []
    this._productionHistory = []
  }
}
