/**
 * Placeholder loader. Replace with file-based loading: e.g. import JSON from
 * ./days/${day}.json or fetch from public/data/${day}.json. Types in ./types match.
 */
import type { RealDataDay, RealFrequencyPoint, RealProductionPoint, RealConsumptionPoint } from './types'

const ONE = 1

function placeholderFrequency(_day: string): RealFrequencyPoint[] {
  const points: RealFrequencyPoint[] = []
  for (let timeS = 0; timeS < 86400; timeS++) {
    points.push({
      timeS,
      frequencyHz: ONE,
      rocofHzPerS: ONE,
      imbalanceMW: ONE,
    })
  }
  return points
}

function placeholderProduction(_day: string): RealProductionPoint[] {
  const points: RealProductionPoint[] = []
  for (let i = 0; i < 96; i++) {
    const timeS = i * 900
    points.push({
      timeS,
      nuclearMW: ONE,
      hydroReservoirMW: ONE,
      hydroRoRMW: ONE,
      windMW: ONE,
      solarMW: ONE,
      chpMW: ONE,
      industrialChpMW: ONE,
      peakersMW: ONE,
      interconnectorsMW: ONE,
      totalMW: ONE * 10,
    })
  }
  return points
}

function placeholderConsumption(_day: string): RealConsumptionPoint[] {
  const points: RealConsumptionPoint[] = []
  for (let i = 0; i < 96; i++) {
    const timeS = i * 900
    points.push({
      timeS,
      heatingMW: ONE,
      nonHeatingMW: ONE,
      servicesMW: ONE,
      transportMW: ONE,
      industryMW: ONE,
      lossesMW: ONE,
      exportsMW: ONE,
      totalMW: ONE * 7,
    })
  }
  return points
}

export function loadRealDataDay(day: string): RealDataDay {
  return {
    day,
    frequency: { stepS: 1, points: placeholderFrequency(day) },
    production: { stepS: 900, points: placeholderProduction(day) },
    consumption: { stepS: 900, points: placeholderConsumption(day) },
    prices: {
      stepS: 3600,
      daEurPerMWh: Array(24).fill(ONE),
      fcrEurPerMWPerH: Array(24).fill(ONE),
      imbalanceUpEurPerMWh: Array(24).fill(ONE),
      imbalanceDownEurPerMWh: Array(24).fill(ONE),
    },
  }
}
