import { PowerGrid, type GridSnapshot } from './PowerGrid'
import { PowerPlant } from './PowerPlant'
import { Consumer } from './Consumer'
import { WeatherModel, ForecastModel, type WeatherOutput, type ForecastOutput } from '../system_model'

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

export interface WorldConfig {
  powerPlantCount: number
  consumerCount: number
  powerPlantMW: number
  consumerMW: number
  startDayOfYear: number
}

export class WorldSimulation {
  private _grid: PowerGrid
  private _weather: WeatherModel
  private _forecast: ForecastModel
  private _currentTime = 0
  private _weatherHistory: WeatherSnapshot[] = []
  private _config: WorldConfig

  constructor(config: WorldConfig) {
    this._config = config
    this._grid = new PowerGrid()
    this._weather = new WeatherModel()
    this._forecast = new ForecastModel()
  }

  initialize(): void {
    this._grid.reset()
    this._weather.reset()
    this._forecast.reset()
    this._currentTime = 0
    this._weatherHistory = []

    for (let i = 0; i < this._config.powerPlantCount; i++) {
      this._grid.connect(
        new PowerPlant(`plant-${i}`, `Power Plant ${i + 1}`, this._config.powerPlantMW)
      )
    }

    for (let i = 0; i < this._config.consumerCount; i++) {
      this._grid.connect(
        new Consumer(`consumer-${i}`, `Consumer ${i + 1}`, this._config.consumerMW)
      )
    }
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

    // Update grid (producers/consumers)
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

  get latestGridSnapshot(): GridSnapshot | null {
    return this._grid.latestSnapshot
  }

  get latestWeatherSnapshot(): WeatherSnapshot | null {
    return this._weatherHistory[this._weatherHistory.length - 1] ?? null
  }

  get currentWeather(): WeatherOutput | null {
    return this.latestWeatherSnapshot?.current ?? null
  }

  getForecast(deltaS: number): ForecastOutput {
    return this._forecast.getForecast(deltaS)
  }

  reset(): void {
    this._grid.reset()
    this._weather.reset()
    this._forecast.reset()
    this._currentTime = 0
    this._weatherHistory = []
  }
}
