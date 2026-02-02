import type { Actor, PowerUpdate } from './Actor'

export class Consumer implements Actor {
  id: string
  name: string
  consumptionMW: number

  constructor(id: string, name: string, consumptionMW: number) {
    this.id = id
    this.name = name
    this.consumptionMW = consumptionMW
  }

  getUpdate(): PowerUpdate {
    return {
      production: 0,
      consumption: this.consumptionMW
    }
  }
}
