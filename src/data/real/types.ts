/** Real data series for one day. MTU = market time unit / resolution. */

export interface RealFrequencyPoint {
  timeS: number
  frequencyHz: number
  rocofHzPerS: number
}

/** 1s MTU → 86400 points per day */
export interface RealFrequencySeries {
  stepS: 1
  points: RealFrequencyPoint[]
}

export interface RealProductionPoint {
  timeS: number
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

/** 15 min MTU → 96 points per day */
export interface RealProductionSeries {
  stepS: 900
  points: RealProductionPoint[]
}

export interface RealConsumptionPoint {
  timeS: number
  heatingMW: number
  nonHeatingMW: number
  servicesMW: number
  transportMW: number
  industryMW: number
  lossesMW: number
  exportsMW: number
  totalMW: number
}

/** 15 min MTU → 96 points per day */
export interface RealConsumptionSeries {
  stepS: 900
  points: RealConsumptionPoint[]
}

/** 1h MTU → 24 points per day. Index = hour 0..23 */
export interface RealPriceSeriesHourly {
  stepS: 3600
  daEurPerMWh: number[]
  fcrEurPerMWPerH: number[]
  imbalanceUpEurPerMWh: number[]
  imbalanceDownEurPerMWh: number[]
}

export interface RealDataDay {
  day: string
  frequency: RealFrequencySeries
  production: RealProductionSeries
  consumption: RealConsumptionSeries
  prices: RealPriceSeriesHourly
}
