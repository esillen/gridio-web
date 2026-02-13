import { reactive, markRaw } from 'vue'
import { WorldSimulation, type WeatherSnapshot, type ConsumptionSnapshot, type ProductionSnapshot, type FrequencySnapshot, type BalancingSnapshot } from './WorldSimulation'
import { RealDataWorld } from './RealDataWorld'
import type { GridSnapshot } from './PowerGrid'
import type { WeatherRegionsOutput, ForecastRegionalOutput, HeatingBreakdown, NonHeatingBreakdown, ServicesBreakdown, TransportBreakdown, NuclearBreakdown, HydroBreakdown, RoRBreakdown, WindFleetRegionalBreakdown, SolarFleetRegionalBreakdown, FrequencyBreakdown, FrequencyBand } from '../system_model'
import { BESSFleet, DEFAULT_BESS_FLEET, type BESSConfig, type BESSMode, type BESSMarket, ImbalanceSettlementModel, type ImbalanceSettlementOutput, type SettlementSnapshot } from '../system_model'
import { BESSPerformanceTracker } from './BESSPerformanceTracker'

export type GamePhase = 'start' | 'initializing' | 'day' | 'day_complete' | 'end'
export type SimulationSpeed = 1 | 10 | 50 | 1000 | 2000 | 3000 | 10000
export type { BESSMode, BESSMarket }

export const DAY_DURATION_SECONDS = 86400 // 24 hours

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

export interface GameConfig {
  startDayOfYear: number
  toggles: SimulationToggles
  useSimulation: boolean
  day: string
}

export interface HourlyBid {
  hour: number
  volumeMW: number
}

export interface PlayerBids {
  daBids: HourlyBid[]
  fcrBids: HourlyBid[]
}

export interface MarketPrices {
  daEurPerMWh: number[]
  fcrEurPerMWPerH: number[]
}

export interface HourlyFulfillment {
  hour: number
  bidMWh: number
  deliveredMWh: number
  fcrBidMW: number
  fcrDeliveredMWh: number
}

export interface BESSUIState {
  id: string
  name: string
  maxPowerMW: number
  capacityMWh: number
  soc01: number
  currentPowerMW: number
  mode: BESSMode | null
  market: BESSMarket
  autoEffectiveMarket: 'da' | 'fcr' | 'inactive' | null
}

class GameState {
  phase: GamePhase = 'start'
  private _world: WorldSimulation | RealDataWorld | null = null
  private _bessFleet: BESSFleet = new BESSFleet(DEFAULT_BESS_FLEET)
  private _bessPerformance: BESSPerformanceTracker = new BESSPerformanceTracker()
  private _imbalanceSettlement: ImbalanceSettlementModel = new ImbalanceSettlementModel()
  private _dayStartUnixS = 0
  
  config: GameConfig = {
    startDayOfYear: 15,
    toggles: {
      nuclear: true,
      hydroReservoir: true,
      hydroRoR: true,
      wind: true,
      solar: true,
      chp: true,
      peakers: true,
      interconnectors: true,
      demandResponse: true,
    },
    useSimulation: false,
    day: '2026-01-08',
  }
  speed: SimulationSpeed = 1
  paused = false

  playerBids: PlayerBids = {
    daBids: Array.from({ length: 24 }, (_, h) => ({ hour: h, volumeMW: 0 })),
    fcrBids: Array.from({ length: 24 }, (_, h) => ({ hour: h, volumeMW: 0 })),
  }

  marketPrices: MarketPrices = {
    daEurPerMWh: new Array(24).fill(40),
    fcrEurPerMWPerH: new Array(24).fill(25),
  }

  imbalancePrices = {
    upEurPerMWh24: new Array(24).fill(60),
    downEurPerMWh24: new Array(24).fill(30),
  }

  imbalanceSettlement: ImbalanceSettlementOutput | null = null

  hourlyFulfillment: HourlyFulfillment[] = Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    bidMWh: 0,
    deliveredMWh: 0,
    fcrBidMW: 0,
    fcrDeliveredMWh: 0,
  }))

  bessStates: BESSUIState[] = []
  totalBessPowerMW = 0
  private _lastDADeliveredMW = 0
  private _lastFCRRequiredMW = 0
  private _lastFCRDeliveredMW = 0
  private _autoEffectiveMarkets: Map<string, 'da' | 'fcr' | 'inactive'> = new Map()
  private _fcrDirectionSeconds = 0
  private _lastFcrDirection: -1 | 0 | 1 = 0
  private _fcrActiveDirection: -1 | 0 | 1 = 0

  // Reactive UI state - synced once per frame
  currentTime = 0
  currentSnapshot: GridSnapshot | null = null
  currentWeather: WeatherRegionsOutput | null = null
  heatingBreakdown: HeatingBreakdown | null = null
  nonHeatingBreakdown: NonHeatingBreakdown | null = null
  servicesBreakdown: ServicesBreakdown | null = null
  transportBreakdown: TransportBreakdown | null = null
  nuclearBreakdown: NuclearBreakdown | null = null
  hydroReservoirBreakdown: HydroBreakdown | null = null
  hydroRoRBreakdown: RoRBreakdown | null = null
  windBreakdown: WindFleetRegionalBreakdown | null = null
  solarBreakdown: SolarFleetRegionalBreakdown | null = null
  frequencyBreakdown: FrequencyBreakdown | null = null
  currentFrequencyHz = 50.0
  currentFrequencyBand: FrequencyBand = 'normal'
  historyVersion = 0
  weatherHistoryVersion = 0
  bessVersion = 0
  imbalanceSettlementVersion = 0

  private animationFrameId: number | null = null
  private lastFrameTime: number | null = null
  private accumulatedTime = 0
  private _lastTickHour = -1

  async startDay(): Promise<void> {
    this.phase = 'initializing'

    await new Promise(resolve => setTimeout(resolve, 50))

    if (this.config.useSimulation) {
      this._world = markRaw(new WorldSimulation(this.config))
      this._world.initialize()
      const warmupSeconds = 12 * 3600
      for (let i = 0; i < warmupSeconds; i++) {
        this._world.tick()
      }
      this._world.resetToStartOfDay()
    } else {
      this._world = markRaw(new RealDataWorld(this.config.day))
      this._world.initialize()
      const prices = this._world.marketPricesDay
      this.marketPrices.daEurPerMWh = [...prices.daEurPerMWh]
      this.marketPrices.fcrEurPerMWPerH = [...prices.fcrEurPerMWPerH]
      const imb = this._world.imbalancePricesDay
      this.imbalancePrices.upEurPerMWh24 = [...imb.upEurPerMWh24]
      this.imbalancePrices.downEurPerMWh24 = [...imb.downEurPerMWh24]
    }
    
    // Initialize BESS and settlement after warm-up
    this._bessFleet.reset()
    this._bessPerformance.reset()
    
    // Initialize day start time (unix timestamp)
    this._dayStartUnixS = Math.floor(Date.now() / 1000)
    this._imbalanceSettlement.reset(this._dayStartUnixS)
    
    const daBids = this.playerBids.daBids.map(b => b.volumeMW)
    const fcrBids = this.playerBids.fcrBids.map(b => b.volumeMW)
    this._bessPerformance.setBids(daBids, fcrBids)
    this._lastTickHour = -1
    this._fcrDirectionSeconds = 0
    this._lastFcrDirection = 0
    this._fcrActiveDirection = 0
    this.hourlyFulfillment = Array.from({ length: 24 }, (_, h) => ({
      hour: h,
      bidMWh: this.playerBids.daBids[h]?.volumeMW ?? 0,
      deliveredMWh: 0,
      fcrBidMW: this.playerBids.fcrBids[h]?.volumeMW ?? 0,
      fcrDeliveredMWh: 0,
    }))

    this.phase = 'day'
    this.paused = false
    this.speed = 1
    this.accumulatedTime = 0
    this.lastFrameTime = null
    this.syncUIState()
    this.syncBESSState()
    this.startSimulation()
  }

  startSimulation(): void {
    this.stopSimulation()
    this.lastFrameTime = performance.now()
    this.animationFrameId = requestAnimationFrame(this.simulationFrame.bind(this))
  }

  private simulationFrame(currentTime: number): void {
    if (this.paused || this.phase !== 'day' || !this._world) return

    if (this.lastFrameTime !== null) {
      const deltaMs = currentTime - this.lastFrameTime
      this.accumulatedTime += deltaMs * this.speed

      const ticksToRun = Math.floor(this.accumulatedTime / 1000)
      this.accumulatedTime -= ticksToRun * 1000

      for (let i = 0; i < ticksToRun; i++) {
        this._world.tick()
        this.tickBESS()
        this.tickImbalanceSettlement()
        if (this._world.currentTime >= DAY_DURATION_SECONDS) {
          this.syncUIState()
          this.syncBESSState()
          this.endDay()
          return
        }
      }

      if (ticksToRun > 0) {
        this.syncUIState()
        this.syncBESSState()
      }
    }

    this.lastFrameTime = currentTime
    this.animationFrameId = requestAnimationFrame(this.simulationFrame.bind(this))
  }

  private tickBESS(): void {
    if (!this._world || this._world.currentTime < 0) return // Skip BESS during warm-up
    
    const currentHour = Math.floor(this._world.currentTime / 3600)
    const secondInHour = this._world.currentTime % 3600
    
    if (currentHour !== this._lastTickHour) {
      this._lastTickHour = currentHour
    }

    const daBid = this.playerBids.daBids[currentHour]?.volumeMW ?? 0
    const fcrBid = this.playerBids.fcrBids[currentHour]?.volumeMW ?? 0

    // Separate units by market (excluding auto for now)
    const daUnits = this._bessFleet.units.filter(u => u.market === 'da' && !u.mode)
    const fcrUnits = this._bessFleet.units.filter(u => u.market === 'fcr' && !u.mode)
    const autoUnits = this._bessFleet.units.filter(u => u.market === 'auto' && !u.mode)
    
    let daCapacity = daUnits.reduce((sum, u) => sum + u.config.maxPowerMW, 0)
    let fcrCapacity = fcrUnits.reduce((sum, u) => sum + u.config.maxPowerMW, 0)

    // Auto-allocate units: prioritize FCR if there's a bid, then DA
    const autoDA: typeof autoUnits = []
    const autoFCR: typeof autoUnits = []
    const autoInactive: typeof autoUnits = []
    
    for (const unit of autoUnits) {
      // Prioritize FCR if there's an FCR bid and we haven't met capacity
      if (fcrBid > 0 && fcrCapacity < fcrBid) {
        autoFCR.push(unit)
        fcrCapacity += unit.config.maxPowerMW
        this._autoEffectiveMarkets.set(unit.config.id, 'fcr')
      } else if (daBid !== 0) {
        autoDA.push(unit)
        daCapacity += unit.config.maxPowerMW
        this._autoEffectiveMarkets.set(unit.config.id, 'da')
      } else {
        autoInactive.push(unit)
        this._autoEffectiveMarkets.set(unit.config.id, 'inactive')
      }
    }

    // Calculate DA target
    const remainingSecondsInHour = 3600 - secondInHour
    const deliveredSoFar = this._bessPerformance.daPerformance[currentHour]?.deliveredMWh ?? 0
    const remainingMWh = daBid - deliveredSoFar
    let daPower = 0
    if (remainingSecondsInHour > 0) {
      daPower = (remainingMWh / remainingSecondsInHour) * 3600
    }
    daPower = Math.max(-daCapacity, Math.min(daCapacity, daPower))

    // Calculate FCR-N target: activate after 3s of continuous deviation on one side of 50 Hz
    const freqHz = this._world.currentFrequencyHz
    const activeDirection = this.updateFcrDirection(freqHz)
    const fcrRequiredMW = activeDirection === 0 ? 0 : -activeDirection * fcrBid
    const fcrTargetMW = Math.max(-fcrCapacity, Math.min(fcrCapacity, fcrRequiredMW))

    let totalActualPower = 0
    let totalDADelivered = 0
    let totalFCRDelivered = 0

    // Tick each unit
    for (const unit of this._bessFleet.units) {
      let targetMW = 0
      const effectiveMarket = unit.market === 'auto' 
        ? this._autoEffectiveMarkets.get(unit.config.id) ?? 'inactive'
        : unit.market
      
      if (unit.mode === 'charge') {
        targetMW = -unit.config.maxPowerMW
      } else if (unit.mode === 'discharge') {
        targetMW = unit.config.maxPowerMW
      } else if (effectiveMarket === 'da') {
        const share = daCapacity > 0 ? unit.config.maxPowerMW / daCapacity : 0
        targetMW = daPower * share
      } else if (effectiveMarket === 'fcr') {
        const share = fcrCapacity > 0 ? unit.config.maxPowerMW / fcrCapacity : 0
        targetMW = fcrTargetMW * share
      }

      const result = unit.tick(1, { targetPowerMW: targetMW, source: 'da' })
      totalActualPower += result.actualPowerMW
      
      // Auto-stop manual mode when SoC limits reached
      if (unit.mode === 'charge' && result.soc01 >= 1) {
        unit.mode = null
      } else if (unit.mode === 'discharge' && result.soc01 <= 0) {
        unit.mode = null
      }
      
      if (effectiveMarket === 'da' && !unit.mode) {
        totalDADelivered += result.actualPowerMW
      } else if (effectiveMarket === 'fcr' && !unit.mode) {
        totalFCRDelivered += result.actualPowerMW
      }
    }

    this.totalBessPowerMW = totalActualPower
    this._lastDADeliveredMW = totalDADelivered
    this._lastFCRRequiredMW = fcrRequiredMW
    this._lastFCRDeliveredMW = totalFCRDelivered

    // Track performance
    this._bessPerformance.tickDA(currentHour, totalDADelivered, 1)
    // Always track FCR when there's a bid - the commitment exists regardless of unit allocation
    if (fcrBid > 0) {
      this._bessPerformance.tickFCR(currentHour, fcrRequiredMW, totalFCRDelivered, 1)
    }
  }

  private tickImbalanceSettlement(): void {
    if (!this._world || this._world.currentTime < 0) return // Skip settlement during warm-up

    const currentUnixS = this._dayStartUnixS + this._world.currentTime
    const daBidsArray = this.playerBids.daBids.map(b => b.volumeMW)
    const fcrBidsArray = this.playerBids.fcrBids.map(b => b.volumeMW)
    const systemImbalanceMW = this._world.frequencyBreakdown?.imbalanceRawMW ?? 0

    this.imbalanceSettlement = this._imbalanceSettlement.tick({
      timeNowUnixS: currentUnixS,
      playerDAScheduleMW24: daBidsArray,
      playerFCRScheduleMW24: fcrBidsArray,
      scheduleAnchorUnixS: this._dayStartUnixS,
      actualDADeliveredMW: this._lastDADeliveredMW,
      fcrRequiredMW: this._lastFCRRequiredMW,
      fcrDeliveredMW: this._lastFCRDeliveredMW,
      systemFrequencyHz: this._world.currentFrequencyHz,
      systemImbalanceMW,
      daPriceEurPerMWh24: this.marketPrices.daEurPerMWh,
      imbPriceUpEurPerMWh24: this.imbalancePrices.upEurPerMWh24,
      imbPriceDownEurPerMWh24: this.imbalancePrices.downEurPerMWh24,
      pricesAnchorUnixS: this._dayStartUnixS,
      feesEnabled: true,
    }, 1)
  }

  private syncBESSState(): void {
    this.bessStates = this._bessFleet.units.map(u => ({
      id: u.config.id,
      name: u.config.name,
      maxPowerMW: u.config.maxPowerMW,
      capacityMWh: u.config.capacityMWh,
      soc01: u.soc01,
      currentPowerMW: u.currentPowerMW,
      mode: u.mode,
      market: u.market,
      autoEffectiveMarket: u.market === 'auto' ? (this._autoEffectiveMarkets.get(u.config.id) ?? 'inactive') : null,
    }))
    this.bessVersion++
  }

  setUnitMode(unitId: string, mode: BESSMode | null): void {
    const unit = this._bessFleet.units.find(u => u.config.id === unitId)
    if (unit) {
      unit.mode = mode
      // Don't change market - preserve the market allocation while charging/discharging
      this.syncBESSState()
    }
  }

  cycleUnitMarket(unitId: string): void {
    const unit = this._bessFleet.units.find(u => u.config.id === unitId)
    if (unit) {
      if (unit.market === 'da') {
        unit.market = 'fcr'
      } else if (unit.market === 'fcr') {
        unit.market = 'auto'
      } else if (unit.market === 'auto') {
        unit.market = 'inactive'
      } else {
        unit.market = 'da'
      }
      if (unit.market !== 'inactive') {
        unit.mode = null
      }
      this.syncBESSState()
    }
  }

  setUnitMarket(unitId: string, market: BESSMarket): void {
    const unit = this._bessFleet.units.find(u => u.config.id === unitId)
    if (unit) {
      unit.market = market
      if (market !== 'inactive') {
        unit.mode = null
      }
      this.syncBESSState()
    }
  }

  clearBids(): void {
    this.playerBids = {
      daBids: Array.from({ length: 24 }, (_, h) => ({ hour: h, volumeMW: 0 })),
      fcrBids: Array.from({ length: 24 }, (_, h) => ({ hour: h, volumeMW: 0 })),
    }
  }

  resetBESS(): void {
    this._bessFleet.reset()
    this.clampBidsToFleetLimits()
    this._bessPerformance.setBids(
      this.playerBids.daBids.map(b => b.volumeMW),
      this.playerBids.fcrBids.map(b => b.volumeMW),
    )
    this.syncBESSState()
  }

  setBESSFleet(configs: BESSConfig[]): void {
    this._bessFleet = new BESSFleet(configs.map(c => ({ ...c })))
    this.clampBidsToFleetLimits()
    this._bessPerformance.setBids(
      this.playerBids.daBids.map(b => b.volumeMW),
      this.playerBids.fcrBids.map(b => b.volumeMW),
    )
    this.resetBESS()
  }

  resetToDefaultBESSFleet(): void {
    this.setBESSFleet(DEFAULT_BESS_FLEET)
  }

  get bessPerformance(): BESSPerformanceTracker {
    return this._bessPerformance
  }

  get bessFleet(): BESSFleet {
    return this._bessFleet
  }

  get totalBessCapacityMWh(): number {
    return this._bessFleet.totalCapacityMWh
  }

  get totalBessMaxPowerMW(): number {
    return this._bessFleet.totalMaxPowerMW
  }

  private syncUIState(): void {
    if (!this._world) return
    this.currentTime = this._world.currentTime
    this.currentSnapshot = this._world.latestGridSnapshot
    this.currentWeather = this._world.currentWeather
    this.heatingBreakdown = this._world.heatingBreakdown
    this.nonHeatingBreakdown = this._world.nonHeatingBreakdown
    this.servicesBreakdown = this._world.servicesBreakdown
    this.transportBreakdown = this._world.transportBreakdown
    this.nuclearBreakdown = this._world.nuclearBreakdown
    this.hydroReservoirBreakdown = this._world.hydroReservoirBreakdown
    this.hydroRoRBreakdown = this._world.hydroRoRBreakdown
    this.windBreakdown = this._world.windBreakdown
    this.solarBreakdown = this._world.solarBreakdown
    this.frequencyBreakdown = this._world.frequencyBreakdown
    this.currentFrequencyHz = this._world.currentFrequencyHz
    this.currentFrequencyBand = this._world.currentFrequencyBand
    this.historyVersion++
    this.weatherHistoryVersion++
    this.imbalanceSettlementVersion++
  }

  get gridHistory(): GridSnapshot[] {
    return this._world?.gridHistory ?? []
  }

  get weatherHistory(): WeatherSnapshot[] {
    return this._world?.weatherHistory ?? []
  }

  get consumptionHistory(): ConsumptionSnapshot[] {
    return this._world?.consumptionHistory ?? []
  }

  get productionHistory(): ProductionSnapshot[] {
    return this._world?.productionHistory ?? []
  }

  get frequencyHistory(): FrequencySnapshot[] {
    return this._world?.frequencyHistory ?? []
  }

  get balancingHistory(): BalancingSnapshot[] {
    return this._world?.balancingHistory ?? []
  }

  get imbalanceSettlementHistory(): SettlementSnapshot[] {
    return this._imbalanceSettlement.history
  }

  get forecastRegional(): ForecastRegionalOutput | null {
    return this._world?.forecastRegional ?? null
  }

  stopSimulation(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId)
      this.animationFrameId = null
    }
    this.lastFrameTime = null
  }

  setSpeed(speed: SimulationSpeed): void {
    this.speed = speed
  }

  private updateFcrDirection(freqHz: number): -1 | 0 | 1 {
    const direction: -1 | 0 | 1 = freqHz > 50 ? 1 : (freqHz < 50 ? -1 : 0)

    if (direction === 0) {
      this._fcrDirectionSeconds = 0
      this._fcrActiveDirection = 0
    } else if (direction !== this._lastFcrDirection) {
      this._fcrDirectionSeconds = 1
      this._fcrActiveDirection = 0
    } else {
      this._fcrDirectionSeconds += 1
      if (this._fcrDirectionSeconds >= 3) {
        this._fcrActiveDirection = direction
      }
    }

    this._lastFcrDirection = direction
    return this._fcrActiveDirection
  }

  togglePause(): void {
    this.paused = !this.paused
    if (!this.paused) {
      this.lastFrameTime = null
      this.accumulatedTime = 0
      this.startSimulation()
    } else {
      this.stopSimulation()
    }
  }

  endDay(): void {
    this.stopSimulation()
    this.phase = 'day_complete'
  }

  proceedToEndScreen(): void {
    if (this.phase === 'day_complete') {
      this.phase = 'end'
    }
  }

  restart(): void {
    this.stopSimulation()
    this._world?.reset()
    this._world = null
    this.currentTime = 0
    this.currentSnapshot = null
    this.currentWeather = null
    this.heatingBreakdown = null
    this.nonHeatingBreakdown = null
    this.servicesBreakdown = null
    this.transportBreakdown = null
    this.nuclearBreakdown = null
    this.hydroReservoirBreakdown = null
    this.hydroRoRBreakdown = null
    this.windBreakdown = null
    this.solarBreakdown = null
    this.frequencyBreakdown = null
    this.currentFrequencyHz = 50.0
    this.currentFrequencyBand = 'normal'
    this.historyVersion = 0
    this.weatherHistoryVersion = 0
    this.resetToDefaultBESSFleet()
    this.resetBids()
    this.phase = 'start'
  }

  private clampBidsToFleetLimits(): void {
    const maxVolume = this._bessFleet.totalMaxPowerMW
    for (const bid of this.playerBids.daBids) {
      bid.volumeMW = Math.max(-maxVolume, Math.min(maxVolume, bid.volumeMW))
    }
    for (const bid of this.playerBids.fcrBids) {
      bid.volumeMW = Math.max(0, Math.min(maxVolume, bid.volumeMW))
    }
  }

  resetBids(): void {
    this.playerBids = {
      daBids: Array.from({ length: 24 }, (_, h) => ({ hour: h, volumeMW: 0 })),
      fcrBids: Array.from({ length: 24 }, (_, h) => ({ hour: h, volumeMW: 0 })),
    }
  }

  generateMarketPrices(seed: number): void {
    const month = this.config.startDayOfYear < 32 ? 1 :
                  this.config.startDayOfYear < 60 ? 2 :
                  this.config.startDayOfYear < 91 ? 3 :
                  this.config.startDayOfYear < 121 ? 4 :
                  this.config.startDayOfYear < 152 ? 5 :
                  this.config.startDayOfYear < 182 ? 6 :
                  this.config.startDayOfYear < 213 ? 7 :
                  this.config.startDayOfYear < 244 ? 8 :
                  this.config.startDayOfYear < 274 ? 9 :
                  this.config.startDayOfYear < 305 ? 10 :
                  this.config.startDayOfYear < 335 ? 11 : 12

    const seasonMult = [1.35, 1.30, 1.10, 0.95, 0.85, 0.75, 0.70, 0.75, 0.90, 1.05, 1.20, 1.35][month - 1] ?? 1
    const fcrSeasonMult = [1.20, 1.15, 1.05, 0.95, 0.90, 0.85, 0.85, 0.90, 0.95, 1.00, 1.10, 1.20][month - 1] ?? 1
    const diurnal = [0.85, 0.82, 0.80, 0.80, 0.83, 0.90, 1.05, 1.18, 1.12, 1.05, 1.00, 0.98, 0.97, 0.98, 1.02, 1.08, 1.18, 1.25, 1.15, 1.05, 0.98, 0.92, 0.88, 0.86]
    const basePrice = 36.06
    const baseFcrPrice = 24

    for (let h = 0; h < 24; h++) {
      const x = ((seed ^ (h * 2654435761)) >>> 0)
      const noise = ((1664525 * x + 1013904223) >>> 0) / 4294967296 * 20 - 10
      this.marketPrices.daEurPerMWh[h] = Math.round(basePrice * seasonMult * (diurnal[h] ?? 1) + noise)

      const x2 = ((seed ^ ((h + 100) * 2654435761)) >>> 0)
      const fcrNoise = ((1664525 * x2 + 1013904223) >>> 0) / 4294967296 * 10 - 5
      this.marketPrices.fcrEurPerMWPerH[h] = Math.round(baseFcrPrice * fcrSeasonMult + fcrNoise)
    }

    // Generate 24 hourly imbalance prices (up-regulation and down-regulation)
    for (let h = 0; h < 24; h++) {
      const daPrice = this.marketPrices.daEurPerMWh[h] ?? basePrice
      
      const x3 = ((seed ^ (h * 2654435761)) >>> 0)
      const upNoise = ((1664525 * x3 + 1013904223) >>> 0) / 4294967296 * 30 - 15
      this.imbalancePrices.upEurPerMWh24[h] = Math.round(daPrice * 1.5 + upNoise) // ~50% premium for up-regulation
      
      const x4 = ((seed ^ ((h + 200) * 2654435761)) >>> 0)
      const downNoise = ((1664525 * x4 + 1013904223) >>> 0) / 4294967296 * 20 - 10
      this.imbalancePrices.downEurPerMWh24[h] = Math.round(daPrice * 0.8 + downNoise) // ~20% discount for down-regulation
    }
  }

  setDABid(hour: number, volumeMW: number): void {
    const maxVolume = this._bessFleet.totalMaxPowerMW
    const clamped = Math.max(-maxVolume, Math.min(maxVolume, volumeMW))
    const bid = this.playerBids.daBids.find(b => b.hour === hour)
    if (bid) bid.volumeMW = clamped
  }

  setFCRBid(hour: number, volumeMW: number): void {
    const maxVolume = this._bessFleet.totalMaxPowerMW
    const clamped = Math.max(0, Math.min(maxVolume, volumeMW))
    const bid = this.playerBids.fcrBids.find(b => b.hour === hour)
    if (bid) bid.volumeMW = clamped
  }
}

export const gameState = reactive(new GameState())
