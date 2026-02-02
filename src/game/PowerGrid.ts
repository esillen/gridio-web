import type { Actor } from './Actor'

export interface GridSnapshot {
  time: number
  production: number
  consumption: number
  imbalance: number
}

export class PowerGrid {
  private actors: Actor[] = []
  private _currentTime = 0
  private _history: GridSnapshot[] = []

  connect(actor: Actor): void {
    this.actors.push(actor)
  }

  disconnect(actorId: string): void {
    const idx = this.actors.findIndex(a => a.id === actorId)
    if (idx === -1) {
      throw new Error(`Actor ${actorId} not found`)
    }
    this.actors.splice(idx, 1)
  }

  tick(): GridSnapshot {
    let totalProduction = 0
    let totalConsumption = 0

    for (const actor of this.actors) {
      const update = actor.getUpdate()
      totalProduction += update.production
      totalConsumption += update.consumption
    }

    const snapshot: GridSnapshot = {
      time: this._currentTime,
      production: totalProduction,
      consumption: totalConsumption,
      imbalance: totalProduction - totalConsumption
    }

    this._history.push(snapshot)
    this._currentTime++
    return snapshot
  }

  get currentTime(): number {
    return this._currentTime
  }

  get history(): GridSnapshot[] {
    return this._history
  }

  get latestSnapshot(): GridSnapshot | null {
    return this._history[this._history.length - 1] ?? null
  }

  reset(): void {
    this.actors = []
    this._currentTime = 0
    this._history = []
  }
}
