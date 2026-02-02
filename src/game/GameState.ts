import { reactive, markRaw } from 'vue'
import { WorldSimulation, type WeatherSnapshot } from './WorldSimulation'
import type { GridSnapshot } from './PowerGrid'
import type { WeatherOutput } from '../system_model'

export type GamePhase = 'start' | 'day' | 'end'
export type SimulationSpeed = 1 | 10 | 50 | 1000

export const DAY_DURATION_SECONDS = 86400 // 24 hours

export interface GameConfig {
  powerPlantCount: number
  consumerCount: number
  powerPlantMW: number
  consumerMW: number
  startDayOfYear: number
}

class GameState {
  phase: GamePhase = 'start'
  private _world: WorldSimulation | null = null
  config: GameConfig = {
    powerPlantCount: 3,
    consumerCount: 5,
    powerPlantMW: 100,
    consumerMW: 50,
    startDayOfYear: 15, // Mid-January
  }
  speed: SimulationSpeed = 1
  paused = false

  // Reactive UI state - synced once per frame
  currentTime = 0
  currentSnapshot: GridSnapshot | null = null
  currentWeather: WeatherOutput | null = null
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
    this.historyVersion++
    this.weatherHistoryVersion++
  }

  get gridHistory(): GridSnapshot[] {
    return this._world?.gridHistory ?? []
  }

  get weatherHistory(): WeatherSnapshot[] {
    return this._world?.weatherHistory ?? []
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
    this.historyVersion = 0
    this.weatherHistoryVersion = 0
    this.phase = 'start'
  }
}

export const gameState = reactive(new GameState())
