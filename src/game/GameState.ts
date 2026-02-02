import { reactive, markRaw } from 'vue'
import { PowerGrid, type GridSnapshot } from './PowerGrid'
import { PowerPlant } from './PowerPlant'
import { Consumer } from './Consumer'

export type GamePhase = 'start' | 'day' | 'end'
export type SimulationSpeed = 1 | 10 | 50 | 1000

export const DAY_DURATION_SECONDS = 86400 // 24 hours

export interface GameConfig {
  powerPlantCount: number
  consumerCount: number
  powerPlantMW: number
  consumerMW: number
}

class GameState {
  phase: GamePhase = 'start'
  private _grid = markRaw(new PowerGrid())
  config: GameConfig = {
    powerPlantCount: 3,
    consumerCount: 5,
    powerPlantMW: 100,
    consumerMW: 50
  }
  speed: SimulationSpeed = 1
  paused = false

  // Reactive UI state - synced once per frame
  currentTime = 0
  currentSnapshot: GridSnapshot | null = null
  historyVersion = 0

  private animationFrameId: number | null = null
  private lastFrameTime: number | null = null
  private accumulatedTime = 0

  startDay(): void {
    this._grid.reset()

    for (let i = 0; i < this.config.powerPlantCount; i++) {
      this._grid.connect(
        new PowerPlant(`plant-${i}`, `Power Plant ${i + 1}`, this.config.powerPlantMW)
      )
    }

    for (let i = 0; i < this.config.consumerCount; i++) {
      this._grid.connect(
        new Consumer(`consumer-${i}`, `Consumer ${i + 1}`, this.config.consumerMW)
      )
    }

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
    if (this.paused || this.phase !== 'day') return

    if (this.lastFrameTime !== null) {
      const deltaMs = currentTime - this.lastFrameTime
      this.accumulatedTime += deltaMs * this.speed

      const ticksToRun = Math.floor(this.accumulatedTime / 1000)
      this.accumulatedTime -= ticksToRun * 1000

      for (let i = 0; i < ticksToRun; i++) {
        this._grid.tick()
        if (this._grid.currentTime >= DAY_DURATION_SECONDS) {
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
    this.currentTime = this._grid.currentTime
    this.currentSnapshot = this._grid.latestSnapshot
    this.historyVersion++
  }

  get history(): GridSnapshot[] {
    return this._grid.history
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
    this._grid.reset()
    this.currentTime = 0
    this.currentSnapshot = null
    this.historyVersion = 0
    this.phase = 'start'
  }
}

export const gameState = reactive(new GameState())
