import { PowerGrid, HISTORY_SAMPLE_INTERVAL_S, type GridSnapshot } from './PowerGrid'
import { 
  WeatherRegionsModel, 
  ForecastRegionalModel, 
  ResidentialSpaceHeatingModel,
  ResidentialNonHeatingModel,
  ServicesCommercialModel,
  TransportModel,
  IndustryProcessModel,
  GridLossesModel,
  NuclearFleetModel,
  HydroReservoirFleetModel,
  HydroRunOfRiverModel,
  WindFleetRegionalModel,
  SolarPVFleetRegionalModel,
  BiofuelWasteCHPModel,
  IndustrialCHPModel,
  GasOilPeakersModel,
  InterconnectorsModel,
  FrequencyModel,
  FCRModel,
  AFRRModel,
  MFRRModel,
  FFRModel,
  DispatcherModel,
  GameplayCorrectionModel,
  type WeatherRegionsOutput, 
  type ForecastRegionalOutput,
  type HeatingBreakdown,
  type NonHeatingBreakdown,
  type ServicesBreakdown,
  type TransportBreakdown,
  type IndustryBreakdown,
  type GridLossesBreakdown,
  type NuclearBreakdown,
  type HydroBreakdown,
  type RoRBreakdown,
  type WindFleetRegionalBreakdown,
  type SolarFleetRegionalBreakdown,
  type CHPBreakdown,
  type IndustrialCHPBreakdown,
  type PeakersBreakdown,
  type InterconnectorBreakdown,
  type FrequencyBreakdown,
  type FrequencyBand,
  type FCRBreakdown,
  type AFRRBreakdown,
  type MFRRBreakdown,
  type FFRBreakdown,
  type DispatcherBreakdown,
  type DispatcherInput
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
  current: WeatherRegionsOutput
}

export interface ConsumptionSnapshot {
  time: number
  heatingMW: number
  nonHeatingMW: number
  servicesMW: number
  transportMW: number
  industryMW: number
  lossesMW: number
  exportsMW: number
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
  industrialChpMW: number
  peakersMW: number
  interconnectorsMW: number
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

export interface BalancingSnapshot {
  time: number
  fcrMW: number
  ffrMW: number
  afrrMW: number
  mfrrMW: number
  totalReserveMW: number
  frequencyHz: number
}

export interface SimulationToggles {
  nuclear: boolean
  hydroReservoir: boolean
  hydroRoR: boolean
  wind: boolean
  solar: boolean
  chp: boolean
  peakers: boolean
  interconnectors: boolean
  demandResponse: boolean
}

export interface WorldConfig {
  startDayOfYear: number
  toggles: SimulationToggles
}

export class WorldSimulation {
  private _grid: PowerGrid
  private _weather: WeatherRegionsModel
  private _forecast: ForecastRegionalModel
  private _heatingDemand: ResidentialSpaceHeatingModel
  private _nonHeatingDemand: ResidentialNonHeatingModel
  private _servicesDemand: ServicesCommercialModel
  private _transportDemand: TransportModel
  private _industryDemand: IndustryProcessModel
  private _gridLosses: GridLossesModel
  private _nuclearFleet: NuclearFleetModel
  private _hydroReservoir: HydroReservoirFleetModel
  private _hydroRoR: HydroRunOfRiverModel
  private _windFleet: WindFleetRegionalModel
  private _solarFleet: SolarPVFleetRegionalModel
  private _chpFleet: BiofuelWasteCHPModel
  private _industrialChp: IndustrialCHPModel
  private _peakers: GasOilPeakersModel
  private _interconnectors: InterconnectorsModel
  private _frequencyModel: FrequencyModel
  private _fcrModel: FCRModel
  private _afrrModel: AFRRModel
  private _mfrrModel: MFRRModel
  private _ffrModel: FFRModel
  private _dispatcher: DispatcherModel
  private _gameplayCorrection: GameplayCorrectionModel
  private _currentTime = 0
  private _latestForecastOutput: ForecastRegionalOutput | null = null
  private _weatherHistory: WeatherSnapshot[] = []
  private _consumptionHistory: ConsumptionSnapshot[] = []
  private _productionHistory: ProductionSnapshot[] = []
  private _frequencyHistory: FrequencySnapshot[] = []
  private _balancingHistory: BalancingSnapshot[] = []
  private _config: WorldConfig

  constructor(config: WorldConfig) {
    this._config = config
    this._grid = new PowerGrid()
    this._weather = new WeatherRegionsModel()
    this._forecast = new ForecastRegionalModel()
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
    this._windFleet = new WindFleetRegionalModel()
    this._solarFleet = new SolarPVFleetRegionalModel()
    this._chpFleet = new BiofuelWasteCHPModel()
    this._industrialChp = new IndustrialCHPModel()
    this._peakers = new GasOilPeakersModel()
    this._interconnectors = new InterconnectorsModel()
    this._frequencyModel = new FrequencyModel()
    this._fcrModel = new FCRModel()
    this._afrrModel = new AFRRModel()
    this._mfrrModel = new MFRRModel()
    this._ffrModel = new FFRModel()
    this._dispatcher = new DispatcherModel()
    this._gameplayCorrection = new GameplayCorrectionModel()
  }

  initialize(): void {
    this._grid.reset()
    this._weather.reset()
    this._forecast.reset()
    
    // Initialize heating demand with actual weather temperature for better warm-up
    const initialTemp = this._weather.synopticTemperatureC
    this._heatingDemand.reset(initialTemp)
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
    this._industrialChp.reset()
    this._peakers.reset()
    this._interconnectors.reset()
    this._frequencyModel.reset()
    this._fcrModel.reset()
    this._afrrModel.reset()
    this._mfrrModel.reset()
    this._ffrModel.reset()
    this._dispatcher.reset()
    this._gameplayCorrection.reset()
    this._currentTime = -12 * 3600 // Start 12 hours before day 0 for better settling
    this._weatherHistory = []
    this._consumptionHistory = []
    this._productionHistory = []
    this._frequencyHistory = []
    this._balancingHistory = []

    // Connect supply models
    this._grid.connect(this._nuclearFleet)
    this._grid.connect(this._hydroReservoir)
    this._grid.connect(this._hydroRoR)
    this._grid.connect(this._windFleet)
    this._grid.connect(this._solarFleet)
    this._grid.connect(this._chpFleet)
    this._grid.connect(this._industrialChp)
    this._grid.connect(this._peakers)
    this._grid.connect(this._interconnectors)

    // Connect demand models
    this._grid.connect(this._heatingDemand)
    this._grid.connect(this._nonHeatingDemand)
    this._grid.connect(this._servicesDemand)
    this._grid.connect(this._transportDemand)
    this._grid.connect(this._industryDemand)
    this._grid.connect(this._gridLosses)
  }

  resetToStartOfDay(): void {
    this._currentTime = 0
    this._grid.resetTime()
    this._weatherHistory = []
    this._consumptionHistory = []
    this._productionHistory = []
    this._frequencyHistory = []
    this._balancingHistory = []
  }

  tick(): void {
    const clock = this.getClock()

    // Update weather
    const weatherOutput = this._weather.tick(clock)

    // Update forecast
    this._latestForecastOutput = this._forecast.tick(clock, weatherOutput)

    // Get previous frequency state (or default)
    const prevFreqHz = this._frequencyModel.currentFrequencyHz
    const prevRocof = this._frequencyModel.breakdown?.rocofHzPerS ?? 0
    const prevFcrBreakdown = this._fcrModel.breakdown
    const prevAfrrBreakdown = this._afrrModel.breakdown
    
    // Update dispatcher to get setpoints
    const dispatcherInput = this.buildDispatcherInput(
      clock,
      weatherOutput,
      prevFreqHz,
      prevRocof,
      { up: prevFcrBreakdown?.upUsedMW ?? 0, down: prevFcrBreakdown?.downUsedMW ?? 0 },
      { up: prevAfrrBreakdown?.upUsedMW ?? 0, down: prevAfrrBreakdown?.downUsedMW ?? 0 }
    )
    const dispatcherBreakdown = this._dispatcher.tick(dispatcherInput)
    
    const toggles = this._config.toggles

    // Update nuclear fleet
    if (toggles.nuclear) {
      this._nuclearFleet.tick(this._currentTime)
    }

    // Update hydro reservoir with dispatcher setpoint
    if (toggles.hydroReservoir) {
      this._hydroReservoir.setDispatch({
        targetProductionMW: dispatcherBreakdown.setpoints.hydroReservoirMW,
        mode: 'follow_target',
      })
      this._hydroReservoir.tick(this._currentTime)
    }

    // Update hydro run-of-river with inflow proxy
    if (toggles.hydroRoR) {
      const inflowMW = this.computeRoRInflow(clock, weatherOutput)
      this._hydroRoR.tick({ inflowMWEquiv: inflowMW })
    }

    // Update wind fleet
    if (toggles.wind) {
      this._windFleet.tick({
        windRegions: weatherOutput.windRegions,
      })
    }

    // Update solar fleet
    if (toggles.solar) {
      this._solarFleet.tick({
        solarSites: weatherOutput.solarSites,
      })
    }

    // Update CHP fleet (heat-led, using temperature-based district heat demand proxy)
    if (toggles.chp) {
      const districtHeatDemandMWth = this.computeDistrictHeatDemand(weatherOutput.synoptic.temperatureC, clock.localHour)
      this._chpFleet.tick({
        heatDemandMWth: districtHeatDemandMWth,
        nonChpHeatSupplyMWth: districtHeatDemandMWth * 0.45,
      })
      this._industrialChp.tick({
        industrialActivity01: 1.0,
        dispatchMode: 'must_run',
      })
    }

    // Update peakers (dispatched by dispatcher when needed)
    if (toggles.peakers) {
      this._peakers.tick({
        dispatchMode: dispatcherBreakdown.setpoints.peakersMW > 0 ? 'follow_target' : 'off',
        targetProductionMW: dispatcherBreakdown.setpoints.peakersMW,
      })
    }

    // Calculate demand response curtailment fraction from dispatcher
    const drShedMW = dispatcherBreakdown.setpoints.drShedMW
    const estimatedDemandMW = 15000 // rough estimate for fraction calculation
    const drCurtailmentFrac = toggles.demandResponse ? Math.min(0.3, drShedMW / estimatedDemandMW) : 0

    // Update heating demand model with current weather
    this._heatingDemand.tick({
      temperatureOutdoorC: weatherOutput.synoptic.temperatureC,
      windSpeedMps: weatherOutput.synoptic.windMps,
      localHour: clock.localHour,
      curtailmentFrac01: drCurtailmentFrac,
    })

    // Update non-heating demand model
    this._nonHeatingDemand.tick({
      localHour: clock.localHour,
      localMinute: clock.localMinute,
      dayOfWeek: 0,
      temperatureOutdoorC: weatherOutput.synoptic.temperatureC,
      cloudCover01: weatherOutput.synoptic.cloudCover01,
      includeDHW: true,
      includeEV: false,
      curtailmentFrac01: drCurtailmentFrac,
    })

    // Update services/commercial demand model
    this._servicesDemand.tick({
      localHour: clock.localHour,
      localMinute: clock.localMinute,
      dayOfWeek: 0,
      temperatureOutdoorC: weatherOutput.synoptic.temperatureC,
      cloudCover01: weatherOutput.synoptic.cloudCover01,
      curtailmentFrac01: drCurtailmentFrac,
    })

    // Update transport demand model
    this._transportDemand.tick({
      localHour: clock.localHour,
      localMinute: clock.localMinute,
      dayOfWeek: 0,
      temperatureC: weatherOutput.synoptic.temperatureC,
    })

    // Update industry demand model
    this._industryDemand.tick({
      localHour: clock.localHour,
      dayOfWeek: 0,
      manualCurtailmentFrac01: drCurtailmentFrac,
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

    // Gather current values for frequency calculation and history
    const heatingMW = this._heatingDemand.consumptionMW
    const nonHeatingMW = this._nonHeatingDemand.consumptionMW
    const servicesMW = this._servicesDemand.consumptionMW
    const transportMW = this._transportDemand.consumptionMW
    const industryMW = this._industryDemand.consumptionMW
    const lossesMW = this._gridLosses.consumptionMW

    const nuclearMW = toggles.nuclear ? this._nuclearFleet.productionMW : 0
    const hydroReservoirMW = toggles.hydroReservoir ? this._hydroReservoir.productionMW : 0
    const hydroRoRMW = toggles.hydroRoR ? this._hydroRoR.productionMW : 0
    const windMW = toggles.wind ? this._windFleet.productionMW : 0
    const solarMW = toggles.solar ? this._solarFleet.productionMW : 0
    const chpMW = toggles.chp ? this._chpFleet.productionMW : 0
    const industrialChpMW = toggles.chp ? this._industrialChp.productionMW : 0
    const peakersMW = toggles.peakers ? this._peakers.productionMW : 0
    const domesticProductionMW = nuclearMW + hydroReservoirMW + hydroRoRMW + windMW + solarMW + chpMW + industrialChpMW + peakersMW
    const totalConsumptionMWForInterconnectors = heatingMW + nonHeatingMW + servicesMW + transportMW + industryMW + lossesMW

    // Update interconnectors (auto-balances based on domestic imbalance)
    if (toggles.interconnectors) {
      this._interconnectors.tick({
        localHour: clock.localHour,
        totalGenerationMW: domesticProductionMW,
        totalConsumptionMW: totalConsumptionMWForInterconnectors,
        frequencyHz: this._frequencyModel.currentFrequencyHz,
        rocofHzPerS: this._frequencyModel.breakdown?.rocofHzPerS ?? 0,
        dispatchMode: 'auto_balance',
      })
    }

    const interconnectorsMW = toggles.interconnectors ? this._interconnectors.netImportMW : 0
    const exportsMW = Math.max(0, -interconnectorsMW)
    // Total supply = domestic generation + net import (import > 0, export < 0). Balance: totalProductionMW = totalConsumptionMW.
    const totalProductionMW = domesticProductionMW + interconnectorsMW

    // Record history snapshots at sample interval (not every tick) and only after warm-up
    const shouldRecordHistory = this._currentTime >= 0 && this._currentTime % HISTORY_SAMPLE_INTERVAL_S === 0

    if (shouldRecordHistory) {
      this._weatherHistory.push({
        time: this._currentTime,
        current: weatherOutput,
      })

      this._consumptionHistory.push({
        time: this._currentTime,
        heatingMW,
        nonHeatingMW,
        servicesMW,
        transportMW,
        industryMW,
        lossesMW,
        exportsMW,
        totalMW: heatingMW + nonHeatingMW + servicesMW + transportMW + industryMW + lossesMW,
      })

      this._productionHistory.push({
        time: this._currentTime,
        nuclearMW,
        hydroReservoirMW,
        hydroRoRMW,
        windMW,
        solarMW,
        chpMW,
        industrialChpMW,
        peakersMW,
        interconnectorsMW,
        totalMW: totalProductionMW,
      })
    }

    // Total consumption = domestic load only (heating + ... + losses). Exports are not part of consumption; balance: totalProductionMW = totalConsumptionMW.
    const totalConsumptionMW = heatingMW + nonHeatingMW + servicesMW + transportMW + industryMW + lossesMW
    const motorLoadMW = industryMW * 0.6 + transportMW * 0.3 // rough motor load estimate
    const rawImbalanceMW = totalProductionMW - totalConsumptionMW
    
    // Get reserve capacities from dispatcher
    const reserveAvail = dispatcherBreakdown.reserveAvailability
    
    // Total FCR capacity (symmetric - use min of up/down for simplicity)
    const fcrCapacityMW = Math.min(reserveAvail.fcr.upCapacityMW, reserveAvail.fcr.downCapacityMW)
    
    // Current frequency for reserve controllers
    const currentFreqHz = this._frequencyModel.currentFrequencyHz
    
    // Run reserve controllers based on current frequency
    // FFR: Ultra-fast response from BESS and fast-acting resources (activates in ~1s on severe frequency drops)
    // For now, use a conservative estimate based on interconnector and peaker capacity
    // TODO: Make this configurable and connected to actual BESS capacity
    const ffrCapacityMW = 500.0  // FFR capacity estimate (increased for better response)
    const ffrEnergyBudgetMWh = 2.0 // ~15 seconds at full power
    
    const ffrBreakdown = this._ffrModel.tick({
      frequencyHz: currentFreqHz,
      rocofHzPerS: prevRocof,
      availableCapacityMW: ffrCapacityMW,
      energyBudgetMWh: ffrEnergyBudgetMWh,
      enabled: true,  // FFR is always enabled as part of grid balancing
    })
    
    // aFRR and mFRR
    const afrrBreakdown = this._afrrModel.tick({
      frequencyHz: currentFreqHz,
      netImbalanceMW: rawImbalanceMW,
      upCapacityMW: reserveAvail.afrr.upCapacityMW,
      downCapacityMW: reserveAvail.afrr.downCapacityMW,
    })
    
    const mfrrBreakdown = this._mfrrModel.tick({
      frequencyHz: currentFreqHz,
      netImbalanceMW: rawImbalanceMW,
      afrrActivatedMW: afrrBreakdown.activatedMW,
      afrrUpCapacityMW: afrrBreakdown.availableUpMW,
      afrrDownCapacityMW: afrrBreakdown.availableDownMW,
      upCapacityMW: reserveAvail.mfrr.upCapacityMW,
      downCapacityMW: reserveAvail.mfrr.downCapacityMW,
    })
    
    // All frequency restoration reserves (FFR + aFRR + mFRR)
    const allReservesMW = ffrBreakdown.activationMW + afrrBreakdown.activatedMW + mfrrBreakdown.activatedMW
    
    // Hidden gameplay correction (PID controller for stability)
    const gameplayCorrection = this._gameplayCorrection.tick({
      frequencyHz: currentFreqHz,
      imbalanceMW: rawImbalanceMW,
    })
    
    // Single frequency tick with internal FCR droop + external reserves + correction
    const finalFreqBreakdown = this._frequencyModel.tick({
      totalGenerationMW: totalProductionMW,
      totalConsumptionMW,
      ffrMW: allReservesMW + gameplayCorrection.correctionMW,  // FFR + aFRR + mFRR + hidden correction
      fcrCapacityMW,            // FCR handled internally with droop
      inertia: {
        nuclearMW,
        hydroReservoirMW,
        hydroRoRMW,
        bioWasteChpMW: chpMW,
        industrialChpMW,
        motorLoadMW,
      },
    })
    
    // Update external FCR model for tracking/reporting (uses new frequency)
    this._fcrModel.tick({
      frequencyHz: finalFreqBreakdown.frequencyHz,
      rocofHzPerS: finalFreqBreakdown.rocofHzPerS,
      upCapacityMW: reserveAvail.fcr.upCapacityMW,
      downCapacityMW: reserveAvail.fcr.downCapacityMW,
    })
    
    if (shouldRecordHistory) {
      this._frequencyHistory.push({
        time: this._currentTime,
        frequencyHz: finalFreqBreakdown.frequencyHz,
        rocofHzPerS: finalFreqBreakdown.rocofHzPerS,
        imbalanceMW: finalFreqBreakdown.imbalanceRawMW,
        band: finalFreqBreakdown.band,
        hEquivS: finalFreqBreakdown.hEquivS,
        sBaseMW: finalFreqBreakdown.sBaseMW,
      })

      // Total reserve = internal FCR response + all other reserves (FFR + aFRR + mFRR)
      const totalReserveMW = finalFreqBreakdown.fcrResponseMW + allReservesMW
      
      this._balancingHistory.push({
        time: this._currentTime,
        fcrMW: finalFreqBreakdown.fcrResponseMW,  // Use internal FCR response
        ffrMW: ffrBreakdown.activationMW,
        afrrMW: afrrBreakdown.activatedMW,
        mfrrMW: mfrrBreakdown.activatedMW,
        totalReserveMW,
        frequencyHz: finalFreqBreakdown.frequencyHz,
      })
    }

    // Update grid (collects updates from all connected actors)
    this._grid.tick()

    this._currentTime++
  }

  private computeRoRInflow(clock: ClockState, weather: WeatherRegionsOutput): number {
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
    const precipBoost = 1.0 + Math.min(0.3, weather.synoptic.snowIntensityMmph * 0.1)

    // Temperature effect: warmer = more melt = more flow (in spring/summer)
    const tempEffect = weather.synoptic.temperatureC > 0 
      ? 1.0 + Math.min(0.2, weather.synoptic.temperatureC * 0.01) 
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

  private buildDispatcherInput(
    clock: ClockState,
    weatherOutput: WeatherRegionsOutput,
    freqHz: number,
    rocofHz: number,
    fcrUsed: { up: number; down: number },
    afrrUsed: { up: number; down: number }
  ): DispatcherInput {
    const heatingMW = this._heatingDemand.consumptionMW
    const nonHeatingMW = this._nonHeatingDemand.consumptionMW
    const servicesMW = this._servicesDemand.consumptionMW
    const transportMW = this._transportDemand.consumptionMW
    const industryMW = this._industryDemand.consumptionMW
    const lossesMW = this._gridLosses.consumptionMW
    const forecast24h = this.build24hForecast(clock, weatherOutput, {
      heatingMW,
      nonHeatingMW,
      servicesMW,
      transportMW,
      industryMW,
      lossesMW,
    })

    const hydroBreakdown = this._hydroReservoir.breakdown
    
    return {
      time: {
        unixS: this._currentTime,
        localHour: clock.localHour,
        localMinute: clock.localMinute,
        localSecond: clock.localSecond,
        dayOfWeek: 0,
      },
      sandbox: {
        enableNuclear: this._config.toggles.nuclear,
        enableHydroReservoir: this._config.toggles.hydroReservoir,
        enableHydroRunOfRiver: this._config.toggles.hydroRoR,
        enableWind: this._config.toggles.wind,
        enableSolar: this._config.toggles.solar,
        enableBioWasteCHP: this._config.toggles.chp,
        enableGasOilPeakers: this._config.toggles.peakers,
        enableInterconnectors: this._config.toggles.interconnectors,
        enableDemandResponse: this._config.toggles.demandResponse,
      },
      frequencyState: {
        frequencyHz: freqHz,
        rocofHzPerS: rocofHz,
      },
      reservesState: {
        fcrActivatedMW: 0,
        afrrActivatedMW: 0,
        mfrrActivatedMW: 0,
        fcrUpUsedMW: fcrUsed.up,
        fcrDownUsedMW: fcrUsed.down,
        afrrUpUsedMW: afrrUsed.up,
        afrrDownUsedMW: afrrUsed.down,
      },
      forecast24h,
      capabilities: {
        nuclear: {
          onlinePlantsMW: this._nuclearFleet.productionMW,
          minMW: 5000,
          maxMW: 7000,
          rampUpMWPerS: 5,
          rampDownMWPerS: 10,
        },
        hydroReservoir: {
          minMW: 500,
          maxMW: hydroBreakdown?.maxProductionMW ?? 14580,
          rampUpMWPerS: 20,
          rampDownMWPerS: 40,
          reservoirEnergyMWh: hydroBreakdown?.reservoirStorageMWh ?? 0,
          reservoirEnergyMinMWh: 0,
          reservoirEnergyMaxMWh: 34_000_000,
          maxDailyEnergyDrawMWh: hydroBreakdown?.dailyEnergyBudgetMaxMWh,
        },
        hydroRunOfRiver: {
          minMW: 0,
          maxMW: 2500,
        },
        gasOilPeakers: {
          minMW: 0,
          maxMW: 2000,
          rampUpMWPerS: 50,
          rampDownMWPerS: 50,
          startDelayS: 300,
        },
        interconnectors: {
          netImportMinMW: -7000,
          netImportMaxMW: 7000,
          rampMWPerS: 100,
        },
        demandResponse: {
          maxShedMW: 500,
          maxShedRampMWPerS: 100,
        },
      },
      policy: {
        hydroPeakShaping01: 0.7,
        preferImports01: 0.5,
        preferDR01: 0.5,
      },
    }
  }

  private build24hForecast(
    clock: ClockState,
    weather: WeatherRegionsOutput,
    demandNow: {
      heatingMW: number
      nonHeatingMW: number
      servicesMW: number
      transportMW: number
      industryMW: number
      lossesMW: number
    }
  ): {
    stepS: number
    demandTotalMW: number[]
    windGenerationMW: number[]
    solarGenerationMW: number[]
    runOfRiverGenerationMW: number[]
    bioWasteChpGenerationMW: number[]
    industrialChpGenerationMW: number[]
  } {
    const demandHourlyPattern = [0.75, 0.72, 0.70, 0.70, 0.72, 0.80, 0.95, 1.05, 1.02, 0.98, 0.95, 0.93,
                                  0.92, 0.91, 0.92, 0.95, 1.00, 1.08, 1.10, 1.05, 0.98, 0.92, 0.85, 0.80]

    const baseOnlyMW = demandNow.heatingMW + demandNow.nonHeatingMW + demandNow.servicesMW + demandNow.transportMW
    const patternAtNow = demandHourlyPattern[clock.localHour % 24] ?? 1.0
    const baseDemandMW = patternAtNow > 0 ? baseOnlyMW / patternAtNow : baseOnlyMW
    const industryMW = demandNow.industryMW
    const lossesMW = demandNow.lossesMW

    // Wind: estimate from weather, not current production
    const windCapacity = 16000
    const windSpeedMps = weather.synoptic.windMps
    // Simple wind power curve: cut-in 3 m/s, rated 12 m/s
    const windCF = Math.pow(Math.max(0, Math.min(1, (windSpeedMps - 3) / 9)), 2) * 0.35
    const baseWindMW = windCapacity * windCF
    
    // Solar: estimate from weather
    const solarCapacity = 4000
    const cloudFactor = 1 - weather.synoptic.cloudCover01 * 0.3
    
    // RoR: seasonal estimate
    const dayOfYear = clock.dayOfYear
    const seasonalPhase = (dayOfYear - 140) / 365 * 2 * Math.PI
    const rorSeasonalFactor = 0.5 + 0.4 * Math.cos(seasonalPhase)
    const baseRoRMW = 2400 * rorSeasonalFactor
    
    // Bio/Waste CHP: estimate from temperature (heat-led)
    const heatingDegrees = Math.max(0, 15 - weather.synoptic.temperatureC)
    const chpHeatFactor = Math.min(1, heatingDegrees / 35)
    const baseBioWasteChpMW = 2500 * (0.3 + 0.7 * chpHeatFactor) // Base + heating component
    
    // Industrial CHP: ~742 MW average, relatively flat profile
    const baseIndustrialChpMW = 742
    
    const demandTotalMW: number[] = []
    const windGenerationMW: number[] = []
    const solarGenerationMW: number[] = []
    const runOfRiverGenerationMW: number[] = []
    const bioWasteChpGenerationMW: number[] = []
    const industrialChpGenerationMW: number[] = []
    
    for (let i = 0; i < 24; i++) {
      const h = (clock.localHour + i) % 24
      const pattern = demandHourlyPattern[h] ?? 1.0

      demandTotalMW.push(baseDemandMW * pattern + industryMW + lossesMW)
      
      // Wind varies ±30% over day
      const windVariation = 1.0 + 0.3 * Math.sin((h - 6) / 24 * 2 * Math.PI)
      windGenerationMW.push(baseWindMW * windVariation)
      
      // Solar follows sun
      const solarHour = h - 12
      const solarFactor = Math.max(0, Math.cos(solarHour / 12 * Math.PI) * 0.8)
      const winterFactor = 0.15 * cloudFactor
      solarGenerationMW.push(solarCapacity * solarFactor * winterFactor)
      
      // RoR with daily variation
      const rorHourFactor = 0.95 + 0.1 * Math.sin((h - 6) / 24 * 2 * Math.PI)
      runOfRiverGenerationMW.push(baseRoRMW * rorHourFactor)
      
      // Bio/Waste CHP follows heating pattern
      const chpHourFactor = demandHourlyPattern[h] ?? 1.0
      bioWasteChpGenerationMW.push(baseBioWasteChpMW * chpHourFactor)
      
      // Industrial CHP is relatively flat (process-driven)
      const industrialHourFactor = h >= 6 && h < 22 ? 1.0 : 0.85 // Slight reduction at night
      industrialChpGenerationMW.push(baseIndustrialChpMW * industrialHourFactor)
    }
    
    return {
      stepS: 3600,
      demandTotalMW,
      windGenerationMW,
      solarGenerationMW,
      runOfRiverGenerationMW,
      bioWasteChpGenerationMW,
      industrialChpGenerationMW,
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

  get balancingHistory(): BalancingSnapshot[] {
    return this._balancingHistory
  }

  get latestGridSnapshot(): GridSnapshot | null {
    return this._grid.latestSnapshot
  }

  get latestWeatherSnapshot(): WeatherSnapshot | null {
    return this._weatherHistory[this._weatherHistory.length - 1] ?? null
  }

  get currentWeather(): WeatherRegionsOutput | null {
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

  get windBreakdown(): WindFleetRegionalBreakdown | null {
    return this._windFleet.breakdown
  }

  get solarBreakdown(): SolarFleetRegionalBreakdown | null {
    return this._solarFleet.breakdown
  }

  get chpBreakdown(): CHPBreakdown | null {
    return this._chpFleet.breakdown
  }

  get industrialChpBreakdown(): IndustrialCHPBreakdown | null {
    return this._industrialChp.breakdown
  }

  get peakersBreakdown(): PeakersBreakdown | null {
    return this._peakers.breakdown
  }

  get interconnectorsBreakdown(): InterconnectorBreakdown | null {
    return this._interconnectors.breakdown
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

  get fcrBreakdown(): FCRBreakdown | null {
    return this._fcrModel.breakdown
  }

  get afrrBreakdown(): AFRRBreakdown | null {
    return this._afrrModel.breakdown
  }

  get mfrrBreakdown(): MFRRBreakdown | null {
    return this._mfrrModel.breakdown
  }

  get ffrBreakdown(): FFRBreakdown | null {
    return this._ffrModel.breakdown
  }

  get dispatcherBreakdown(): DispatcherBreakdown | null {
    return this._dispatcher.breakdown
  }

  get dispatcherHourlyPlan() {
    return this._dispatcher.hourlyPlan
  }

  get forecastRegional(): ForecastRegionalOutput | null {
    return this._latestForecastOutput
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
    this._industrialChp.reset()
    this._peakers.reset()
    this._interconnectors.reset()
    this._frequencyModel.reset()
    this._fcrModel.reset()
    this._afrrModel.reset()
    this._mfrrModel.reset()
    this._ffrModel.reset()
    this._dispatcher.reset()
    this._gameplayCorrection.reset()
    this._currentTime = 0
    this._weatherHistory = []
    this._consumptionHistory = []
    this._productionHistory = []
    this._frequencyHistory = []
    this._balancingHistory = []
  }
}
