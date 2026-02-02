import { reactive, markRaw } from 'vue'
import { WorldSimulation, type WeatherSnapshot, type ConsumptionSnapshot, type ProductionSnapshot, type FrequencySnapshot, type BalancingSnapshot } from './WorldSimulation'
import type { GridSnapshot } from './PowerGrid'
import type { WeatherOutput, ForecastArrays, HeatingBreakdown, NonHeatingBreakdown, ServicesBreakdown, TransportBreakdown, NuclearBreakdown, HydroBreakdown, RoRBreakdown, WindBreakdown, SolarBreakdown, FrequencyBreakdown, FrequencyBand } from '../system_model'

export type GamePhase = 'start' | 'day' | 'end'
export type SimulationSpeed = 1 | 10 | 50 | 1000 | 2000 | 3000

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
}

export interface BESSConfig {
  capacityMWh: number
  maxPowerMW: number
  roundTripEfficiency: number
  initialSoC01: number
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

class GameState {
  phase: GamePhase = 'start'
  private _world: WorldSimulation | null = null
  config: GameConfig = {
    startDayOfYear: 15, // Mid-January
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
  }
  speed: SimulationSpeed = 1
  paused = false

  bess: BESSConfig = {
    capacityMWh: 100,
    maxPowerMW: 50,
    roundTripEfficiency: 0.90,
    initialSoC01: 0.5,
  }

  playerBids: PlayerBids = {
    daBids: Array.from({ length: 24 }, (_, h) => ({ hour: h, volumeMW: 0 })),
    fcrBids: Array.from({ length: 24 }, (_, h) => ({ hour: h, volumeMW: 0 })),
  }

  marketPrices: MarketPrices = {
    daEurPerMWh: new Array(24).fill(40),
    fcrEurPerMWPerH: new Array(24).fill(25),
  }

  // Reactive UI state - synced once per frame
  currentTime = 0
  currentSnapshot: GridSnapshot | null = null
  currentWeather: WeatherOutput | null = null
  heatingBreakdown: HeatingBreakdown | null = null
  nonHeatingBreakdown: NonHeatingBreakdown | null = null
  servicesBreakdown: ServicesBreakdown | null = null
  transportBreakdown: TransportBreakdown | null = null
  nuclearBreakdown: NuclearBreakdown | null = null
  hydroReservoirBreakdown: HydroBreakdown | null = null
  hydroRoRBreakdown: RoRBreakdown | null = null
  windBreakdown: WindBreakdown | null = null
  solarBreakdown: SolarBreakdown | null = null
  frequencyBreakdown: FrequencyBreakdown | null = null
  currentFrequencyHz = 50.0
  currentFrequencyBand: FrequencyBand = 'normal'
  historyVersion = 0
  weatherHistoryVersion = 0

  private animationFrameId: number | null = null
  private lastFrameTime: number | null = null
  private accumulatedTime = 0

  startDay(): void {
    this._world = markRaw(new WorldSimulation(this.config))
    this._world.initialize()

    this.phase = 'day'
    this.paused = false
    this.speed = 1
    this.accumulatedTime = 0
    this.lastFrameTime = null
    this.syncUIState()
    this.startSimulation()
  }

  private startSimulation(): void {
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
        if (this._world.currentTime >= DAY_DURATION_SECONDS) {
          this.syncUIState()
          this.endDay()
          return
        }
      }

      if (ticksToRun > 0) {
        this.syncUIState()
      }
    }

    this.lastFrameTime = currentTime
    this.animationFrameId = requestAnimationFrame(this.simulationFrame.bind(this))
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

  get forecastArrays(): ForecastArrays | null {
    return this._world?.forecastArrays ?? null
  }

  private stopSimulation(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId)
      this.animationFrameId = null
    }
    this.lastFrameTime = null
  }

  setSpeed(speed: SimulationSpeed): void {
    this.speed = speed
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
    this.phase = 'end'
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
    this.resetBids()
    this.phase = 'start'
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
  }

  setDABid(hour: number, volumeMW: number): void {
    const maxVolume = this.bess.maxPowerMW
    const clamped = Math.max(-maxVolume, Math.min(maxVolume, volumeMW))
    const bid = this.playerBids.daBids.find(b => b.hour === hour)
    if (bid) bid.volumeMW = clamped
  }

  setFCRBid(hour: number, volumeMW: number): void {
    const maxVolume = this.bess.maxPowerMW
    const clamped = Math.max(0, Math.min(maxVolume, volumeMW))
    const bid = this.playerBids.fcrBids.find(b => b.hour === hour)
    if (bid) bid.volumeMW = clamped
  }
}

export const gameState = reactive(new GameState())
