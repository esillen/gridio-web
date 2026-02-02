export interface PowerUpdate {
  production: number
  consumption: number
}

export interface Actor {
  id: string
  name: string
  getUpdate(): PowerUpdate
}
