import { PowerGrid, type GridSnapshot } from './PowerGrid'
import { 
  WeatherModel, 
  ForecastModel, 
  ResidentialSpaceHeatingModel,
  ResidentialNonHeatingModel,
  ServicesCommercialModel,
  TransportModel,
  IndustryProcessModel,
  GridLossesModel,
  NuclearFleetModel,
  HydroReservoirFleetModel,
  HydroRunOfRiverModel,
  WindFleetModel,
  SolarPVFleetModel,
  BiofuelWasteCHPModel,
  FrequencyModel,
  type WeatherOutput, 
  type ForecastOutput, 
  type ForecastArrays,
  type HeatingBreakdown,
  type NonHeatingBreakdown,
  type ServicesBreakdown,
  type TransportBreakdown,
  type IndustryBreakdown,
  type GridLossesBreakdown,
  type NuclearBreakdown,
  type HydroBreakdown,
  type RoRBreakdown,
  type WindBreakdown,
  type SolarBreakdown,
  type CHPBreakdown,
  type FrequencyBreakdown,
  type FrequencyBand
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
  transportMW: number
  industryMW: number
  lossesMW: number
  totalMW: number
}

export interface ProductionSnapshot {
  time: number
  nuclearMW: number
  hydroReservoirMW: number
  hydroRoRMW: number
  windMW: number
  solarMW: number
  chpMW: number
  totalMW: number
}

export interface FrequencySnapshot {
  time: number
  frequencyHz: number
  rocofHzPerS: number
  imbalanceMW: number
  band: FrequencyBand
  hEquivS: number
  sBaseMW: number
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
  private _transportDemand: TransportModel
  private _industryDemand: IndustryProcessModel
  private _gridLosses: GridLossesModel
  private _nuclearFleet: NuclearFleetModel
  private _hydroReservoir: HydroReservoirFleetModel
  private _hydroRoR: HydroRunOfRiverModel
  private _windFleet: WindFleetModel
  private _solarFleet: SolarPVFleetModel
  private _chpFleet: BiofuelWasteCHPModel
  private _frequencyModel: FrequencyModel
  private _currentTime = 0
  private _weatherHistory: WeatherSnapshot[] = []
  private _consumptionHistory: ConsumptionSnapshot[] = []
  private _productionHistory: ProductionSnapshot[] = []
  private _frequencyHistory: FrequencySnapshot[] = []
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
    this._transportDemand = new TransportModel(
      'transport',
      'Transport (Rail + EV)'
    )
    this._industryDemand = new IndustryProcessModel(
      'industry-process',
      'Industrial Process'
    )
    this._gridLosses = new GridLossesModel(
      'grid-losses',
      'Grid Losses'
    )
    this._nuclearFleet = new NuclearFleetModel()
    this._hydroReservoir = new HydroReservoirFleetModel()
    this._hydroRoR = new HydroRunOfRiverModel()
    this._windFleet = new WindFleetModel()
    this._solarFleet = new SolarPVFleetModel()
    this._chpFleet = new BiofuelWasteCHPModel()
    this._frequencyModel = new FrequencyModel()
  }

  initialize(): void {
    this._grid.reset()
    this._weather.reset()
    this._forecast.reset()
    this._heatingDemand.reset(this._weather.state.temperatureC)
    this._nonHeatingDemand.reset()
    this._servicesDemand.reset()
    this._transportDemand.reset()
    this._industryDemand.reset()
    this._gridLosses.reset()
    this._nuclearFleet.reset()
    this._hydroReservoir.reset()
    this._hydroRoR.reset()
    this._windFleet.reset()
    this._solarFleet.reset()
    this._chpFleet.reset()
    this._frequencyModel.reset()
    this._currentTime = 0
    this._weatherHistory = []
    this._consumptionHistory = []
    this._productionHistory = []
    this._frequencyHistory = []

    // Connect supply models
    this._grid.connect(this._nuclearFleet)
    this._grid.connect(this._hydroReservoir)
    this._grid.connect(this._hydroRoR)
    this._grid.connect(this._windFleet)
    this._grid.connect(this._solarFleet)
    this._grid.connect(this._chpFleet)

    // Connect demand models
    this._grid.connect(this._heatingDemand)
    this._grid.connect(this._nonHeatingDemand)
    this._grid.connect(this._servicesDemand)
    this._grid.connect(this._transportDemand)
    this._grid.connect(this._industryDemand)
    this._grid.connect(this._gridLosses)
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

    // Update hydro reservoir
    this._hydroReservoir.tick(this._currentTime)

    // Update hydro run-of-river with inflow proxy
    const inflowMW = this.computeRoRInflow(clock, weatherOutput)
    this._hydroRoR.tick({ inflowMWEquiv: inflowMW })

    // Update wind fleet
    this._windFleet.tick({
      windSpeed100mMps: weatherOutput.windSpeed100mMps,
      windGustMps: weatherOutput.windSpeed100mMps * 1.3,
      temperatureC: weatherOutput.temperatureC,
      icingRisk01: weatherOutput.icingRisk01,
    })

    // Update solar fleet
    this._solarFleet.tick({
      solarIrradianceWm2: weatherOutput.solarIrradianceWm2,
      temperatureC: weatherOutput.temperatureC,
      precipitationSnowMmph: weatherOutput.precipitationSnowMmph,
    })

    // Update CHP fleet (heat-led, using temperature-based district heat demand proxy)
    const districtHeatDemandMWth = this.computeDistrictHeatDemand(weatherOutput.temperatureC, clock.localHour)
    this._chpFleet.tick({
      heatDemandMWth: districtHeatDemandMWth,
      nonChpHeatSupplyMWth: districtHeatDemandMWth * 0.45, // ~45% from heat-only boilers/heat pumps
    })

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

    // Update transport demand model
    this._transportDemand.tick({
      localHour: clock.localHour,
      localMinute: clock.localMinute,
      dayOfWeek: 0,
      temperatureC: weatherOutput.temperatureC,
    })

    // Update industry demand model
    this._industryDemand.tick({
      localHour: clock.localHour,
      dayOfWeek: 0,
    })

    // Update grid losses (based on total consumption from all other demand models)
    const baseConsumptionMW = this._heatingDemand.consumptionMW
      + this._nonHeatingDemand.consumptionMW
      + this._servicesDemand.consumptionMW
      + this._transportDemand.consumptionMW
      + this._industryDemand.consumptionMW
    this._gridLosses.tick({
      totalConsumptionMW: baseConsumptionMW,
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
    const transportMW = this._transportDemand.consumptionMW
    const industryMW = this._industryDemand.consumptionMW
    const lossesMW = this._gridLosses.consumptionMW
    this._consumptionHistory.push({
      time: this._currentTime,
      heatingMW,
      nonHeatingMW,
      servicesMW,
      transportMW,
      industryMW,
      lossesMW,
      totalMW: heatingMW + nonHeatingMW + servicesMW + transportMW + industryMW + lossesMW,
    })

    // Record production breakdown
    const nuclearMW = this._nuclearFleet.productionMW
    const hydroReservoirMW = this._hydroReservoir.productionMW
    const hydroRoRMW = this._hydroRoR.productionMW
    const windMW = this._windFleet.productionMW
    const solarMW = this._solarFleet.productionMW
    const chpMW = this._chpFleet.productionMW
    const totalProductionMW = nuclearMW + hydroReservoirMW + hydroRoRMW + windMW + solarMW + chpMW
    this._productionHistory.push({
      time: this._currentTime,
      nuclearMW,
      hydroReservoirMW,
      hydroRoRMW,
      windMW,
      solarMW,
      chpMW,
      totalMW: totalProductionMW,
    })

    // Update frequency model
    const totalConsumptionMW = heatingMW + nonHeatingMW + servicesMW + transportMW + industryMW + lossesMW
    const motorLoadMW = industryMW * 0.6 + transportMW * 0.3 // rough motor load estimate
    const freqBreakdown = this._frequencyModel.tick({
      totalGenerationMW: totalProductionMW,
      totalConsumptionMW,
      inertia: {
        nuclearMW,
        hydroReservoirMW,
        hydroRoRMW,
        bioWasteChpMW: chpMW,
        motorLoadMW,
      },
    })
    this._frequencyHistory.push({
      time: this._currentTime,
      frequencyHz: freqBreakdown.frequencyHz,
      rocofHzPerS: freqBreakdown.rocofHzPerS,
      imbalanceMW: freqBreakdown.imbalanceRawMW,
      band: freqBreakdown.band,
      hEquivS: freqBreakdown.hEquivS,
      sBaseMW: freqBreakdown.sBaseMW,
    })

    // Update grid (collects updates from all connected actors)
    this._grid.tick()

    this._currentTime++
  }

  private computeRoRInflow(clock: ClockState, weather: WeatherOutput): number {
    // Simple inflow model for run-of-river:
    // Base inflow varies by season (higher in spring/summer due to snowmelt and rain)
    // Plus some contribution from recent precipitation
    const dayOfYear = clock.dayOfYear
    const baseCapacity = 2500 * 0.98 * 0.97 // effective capacity

    // Seasonal pattern: peak in late spring (day ~140), low in winter
    const seasonalPhase = (dayOfYear - 140) / 365 * 2 * Math.PI
    const seasonalFactor = 0.5 + 0.4 * Math.cos(seasonalPhase)

    // Daily variation: slightly higher during day due to glacier/snow melt
    const hourFactor = 0.95 + 0.1 * Math.sin((clock.localHour - 6) / 24 * 2 * Math.PI)

    // Precipitation boost (rain adds to river flow with delay, simplified here)
    const precipBoost = 1.0 + Math.min(0.3, weather.precipitationSnowMmph * 0.1)

    // Temperature effect: warmer = more melt = more flow (in spring/summer)
    const tempEffect = weather.temperatureC > 0 
      ? 1.0 + Math.min(0.2, weather.temperatureC * 0.01) 
      : 0.8

    const inflowFraction = seasonalFactor * hourFactor * precipBoost * tempEffect
    return baseCapacity * Math.min(1.2, inflowFraction)
  }

  private computeDistrictHeatDemand(temperatureC: number, localHour: number): number {
    // Simple district heat demand model based on outdoor temperature
    // Swedish district heat is ~50 TWh/year, roughly 5700 MW average
    // Peak in winter can be 2-3x average
    const baseLoadMWth = 3000 // Base load (hot water, process heat)
    const heatingBalanceC = 15
    const designTempC = -20

    // Temperature-driven heating demand
    const heatingDegrees = Math.max(0, heatingBalanceC - temperatureC)
    const designDegrees = heatingBalanceC - designTempC
    const tempFactor = Math.min(1, heatingDegrees / designDegrees)
    const heatingLoadMWth = 8000 * tempFactor // Up to 8000 MWth heating

    // Daily pattern: higher in morning and evening
    const hourlyFactors = [0.85, 0.82, 0.80, 0.80, 0.82, 0.90, 1.05, 1.15, 1.10, 1.00, 0.95, 0.92,
                          0.90, 0.88, 0.88, 0.90, 0.95, 1.05, 1.12, 1.08, 1.00, 0.95, 0.90, 0.88]
    const hourFactor = hourlyFactors[localHour] ?? 1.0

    return (baseLoadMWth + heatingLoadMWth) * hourFactor
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

  get frequencyHistory(): FrequencySnapshot[] {
    return this._frequencyHistory
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

  get transportBreakdown(): TransportBreakdown | null {
    return this._transportDemand.breakdown
  }

  get industryBreakdown(): IndustryBreakdown | null {
    return this._industryDemand.breakdown
  }

  get gridLossesBreakdown(): GridLossesBreakdown | null {
    return this._gridLosses.breakdown
  }

  get nuclearBreakdown(): NuclearBreakdown | null {
    return this._nuclearFleet.breakdown
  }

  get hydroReservoirBreakdown(): HydroBreakdown | null {
    return this._hydroReservoir.breakdown
  }

  get hydroRoRBreakdown(): RoRBreakdown | null {
    return this._hydroRoR.breakdown
  }

  get windBreakdown(): WindBreakdown | null {
    return this._windFleet.breakdown
  }

  get solarBreakdown(): SolarBreakdown | null {
    return this._solarFleet.breakdown
  }

  get chpBreakdown(): CHPBreakdown | null {
    return this._chpFleet.breakdown
  }

  get frequencyBreakdown(): FrequencyBreakdown | null {
    return this._frequencyModel.breakdown
  }

  get currentFrequencyHz(): number {
    return this._frequencyModel.currentFrequencyHz
  }

  get currentFrequencyBand(): FrequencyBand {
    return this._frequencyModel.currentBand
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
    this._transportDemand.reset()
    this._industryDemand.reset()
    this._gridLosses.reset()
    this._nuclearFleet.reset()
    this._hydroReservoir.reset()
    this._hydroRoR.reset()
    this._windFleet.reset()
    this._solarFleet.reset()
    this._chpFleet.reset()
    this._frequencyModel.reset()
    this._currentTime = 0
    this._weatherHistory = []
    this._consumptionHistory = []
    this._productionHistory = []
    this._frequencyHistory = []
  }
}
