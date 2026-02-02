import type { Actor, PowerUpdate } from './Actor'

export class PowerPlant implements Actor {
  id: string
  name: string
  productionMW: number

  constructor(id: string, name: string, productionMW: number) {
    this.id = id
    this.name = name
    this.productionMW = productionMW
  }

  getUpdate(): PowerUpdate {
    return {
      production: this.productionMW,
      consumption: 0
    }
  }
}
