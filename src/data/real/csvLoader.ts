/**
 * Real-data loader backed by CSV files in public/data/{day}/*.csv.
 */
import type { RealDataDay, RealFrequencyPoint, RealProductionPoint, RealConsumptionPoint } from './types'

const SECONDS_PER_DAY = 24 * 60 * 60
const REAL_FREQUENCY_CSV_BY_DAY: Record<string, string> = (() => {
  const modules = import.meta.glob('../../../public/data/*/frequency.csv', {
    query: '?raw',
    import: 'default',
    eager: true,
  }) as Record<string, string>
  const out: Record<string, string> = {}
  for (const [path, content] of Object.entries(modules)) {
    const m = path.match(/\/public\/data\/(\d{4}-\d{2}-\d{2})\/frequency\.csv$/)
    const day = m?.[1]
    if (!day) continue
    out[day] = content
  }
  return out
})()
const REAL_PRODUCTION_CSV_BY_DAY: Record<string, string> = (() => {
  const modules = import.meta.glob('../../../public/data/*/production.csv', {
    query: '?raw',
    import: 'default',
    eager: true,
  }) as Record<string, string>
  const out: Record<string, string> = {}
  for (const [path, content] of Object.entries(modules)) {
    const m = path.match(/\/public\/data\/(\d{4}-\d{2}-\d{2})\/production\.csv$/)
    const day = m?.[1]
    if (!day) continue
    out[day] = content
  }
  return out
})()
const REAL_CONSUMPTION_CSV_BY_DAY: Record<string, string> = (() => {
  const modules = import.meta.glob('../../../public/data/*/consumption.csv', {
    query: '?raw',
    import: 'default',
    eager: true,
  }) as Record<string, string>
  const out: Record<string, string> = {}
  for (const [path, content] of Object.entries(modules)) {
    const m = path.match(/\/public\/data\/(\d{4}-\d{2}-\d{2})\/consumption\.csv$/)
    const day = m?.[1]
    if (!day) continue
    out[day] = content
  }
  return out
})()
const REAL_PRICES_CSV_BY_DAY: Record<string, string> = (() => {
  const modules = import.meta.glob('../../../public/data/*/prices.csv', {
    query: '?raw',
    import: 'default',
    eager: true,
  }) as Record<string, string>
  const out: Record<string, string> = {}
  for (const [path, content] of Object.entries(modules)) {
    const m = path.match(/\/public\/data\/(\d{4}-\d{2}-\d{2})\/prices\.csv$/)
    const day = m?.[1]
    if (!day) continue
    out[day] = content
  }
  return out
})()

function parseTimeToSeconds(value: string): number | null {
  const match = value.trim().match(/^(\d{2}):(\d{2}):(\d{2})$/)
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  const seconds = Number(match[3])
  if (
    Number.isNaN(hours) || Number.isNaN(minutes) || Number.isNaN(seconds) ||
    hours < 0 || hours > 23 || minutes < 0 || minutes > 59 || seconds < 0 || seconds > 59
  ) {
    return null
  }
  return hours * 3600 + minutes * 60 + seconds
}

function parseFrequencyCsv(csv: string): RealFrequencyPoint[] {
  const bySecond = new Array<number>(SECONDS_PER_DAY).fill(Number.NaN)
  const lines = csv.split(/\r?\n/).filter(Boolean)

  for (const line of lines.slice(1)) {
    const [timeRaw, frequencyRaw] = line.split(',').map(v => v.trim())
    if (!timeRaw || !frequencyRaw) continue
    const timeS = parseTimeToSeconds(timeRaw)
    const frequencyHz = Number(frequencyRaw)
    if (timeS === null || Number.isNaN(frequencyHz)) continue
    bySecond[timeS] = frequencyHz
  }

  const points: RealFrequencyPoint[] = []
  let previousFrequencyHz = 50.0
  for (let timeS = 0; timeS < SECONDS_PER_DAY; timeS++) {
    const sampledFrequency = bySecond[timeS]
    const hasValue = sampledFrequency !== undefined && !Number.isNaN(sampledFrequency)
    const frequencyHz = hasValue ? sampledFrequency : previousFrequencyHz
    const rocofHzPerS = timeS === 0 ? 0 : frequencyHz - previousFrequencyHz
    points.push({
      timeS,
      frequencyHz,
      rocofHzPerS,
    })
    previousFrequencyHz = frequencyHz
  }

  return points
}

function parseRowsByTime(csv: string, requiredColumns: string[]): Map<number, Record<string, number>> {
  const lines = csv.split(/\r?\n/).filter(Boolean)
  if (lines.length === 0) {
    throw new Error('CSV is empty')
  }
  const headers = lines[0]?.split(',').map(v => v.trim().toLowerCase()) ?? []
  const timeIdx = headers.indexOf('time')
  if (timeIdx < 0) {
    throw new Error("CSV is missing required 'time' column")
  }
  for (const col of requiredColumns) {
    if (!headers.includes(col)) {
      throw new Error(`CSV is missing required '${col}' column`)
    }
  }

  const rowsByTime = new Map<number, Record<string, number>>()
  for (const line of lines.slice(1)) {
    const cols = line.split(',').map(v => v.trim())
    const timeRaw = cols[timeIdx]
    if (!timeRaw) continue
    const timeS = parseTimeToSeconds(timeRaw)
    if (timeS === null) continue

    const values: Record<string, number> = {}
    for (let i = 0; i < headers.length; i++) {
      if (i === timeIdx) continue
      const key = headers[i]
      if (!key) continue
      const raw = cols[i]
      if (!raw) continue
      const value = Number(raw)
      if (!Number.isNaN(value)) values[key] = value
    }

    for (const col of requiredColumns) {
      if (!(col in values)) {
        throw new Error(`CSV row at ${timeRaw} is missing required '${col}' value`)
      }
    }
    rowsByTime.set(timeS, values)
  }

  return rowsByTime
}

function parsePricesCsv(csv: string, day: string): { da: number[]; fcr: number[]; up: number[]; down: number[] } {
  const lines = csv.split(/\r?\n/).filter(Boolean)
  if (lines.length === 0) {
    throw new Error(`Prices CSV is empty for ${day}`)
  }
  const headers = lines[0]?.split(',').map(v => v.trim().toLowerCase()) ?? []
  const timeIdx = headers.indexOf('time')
  const daIdx = headers.indexOf('day_ahead')
  const fcrIdx = headers.indexOf('fcrn')
  const upIdx = headers.indexOf('imbalance_up')
  const downIdx = headers.indexOf('imbalance_down')
  if (timeIdx < 0 || daIdx < 0 || fcrIdx < 0 || upIdx < 0 || downIdx < 0) {
    throw new Error(`Prices CSV is missing required columns for ${day}`)
  }

  const rowsByTime = new Map<number, Record<string, number>>()
  for (const line of lines.slice(1)) {
    const cols = line.split(',').map(v => v.trim())
    const timeRaw = cols[timeIdx]
    if (!timeRaw) continue
    const timeS = parseTimeToSeconds(timeRaw)
    if (timeS === null) continue
    const row: Record<string, number> = {}
    const daRaw = cols[daIdx]
    const fcrRaw = cols[fcrIdx]
    const upRaw = cols[upIdx]
    const downRaw = cols[downIdx]
    const da = Number(daRaw)
    const fcr = Number(fcrRaw)
    const up = Number(upRaw)
    const down = Number(downRaw)
    if (daRaw && !Number.isNaN(da)) row.day_ahead = da
    if (fcrRaw && !Number.isNaN(fcr)) row.fcrn = fcr
    if (upRaw && !Number.isNaN(up)) row.imbalance_up = up
    if (downRaw && !Number.isNaN(down)) row.imbalance_down = down
    rowsByTime.set(timeS, row)
  }

  const da = new Array<number>(24)
  const fcr = new Array<number>(24)
  const up = new Array<number>(24)
  const down = new Array<number>(24)

  for (let h = 0; h < 24; h++) {
    const timeS = h * 3600
    const row = rowsByTime.get(timeS)
    if (!row) throw new Error(`Missing prices row for ${day} at ${timeS}s`)
    da[h] = readRequired(row, 'day_ahead', day, timeS)
    fcr[h] = readRequired(row, 'fcrn', day, timeS)
    up[h] = readRequired(row, 'imbalance_up', day, timeS)
    down[h] = readRequired(row, 'imbalance_down', day, timeS)
  }

  return { da, fcr, up, down }
}

function readRequired(row: Record<string, number>, key: string, day: string, timeS: number): number {
  const value = row[key]
  if (value === undefined || Number.isNaN(value)) {
    throw new Error(`Missing required '${key}' value for ${day} at ${timeS}s`)
  }
  return value
}

function loadFrequency(_day: string): RealFrequencyPoint[] {
  const realCsv = REAL_FREQUENCY_CSV_BY_DAY[_day]
  if (!realCsv) {
    throw new Error(`Missing frequency.csv for ${_day} in public/data/${_day}`)
  }
  return parseFrequencyCsv(realCsv)
}

function loadProduction(_day: string): RealProductionPoint[] {
  const realCsv = REAL_PRODUCTION_CSV_BY_DAY[_day]
  if (!realCsv) {
    throw new Error(`Missing production.csv for ${_day} in public/data/${_day}`)
  }

  const rowsByTime = parseRowsByTime(realCsv, [
    'hydro',
    'nuclear',
    'solar',
    'thermal',
    'wind',
    'wind_offshore',
    'energy_storage',
    'other',
    'total',
  ])
  const points: RealProductionPoint[] = []
  for (let i = 0; i < 96; i++) {
    const timeS = i * 900
    const row = rowsByTime.get(timeS)
    if (!row) throw new Error(`Missing production row for ${_day} at ${timeS}s`)
    const nuclearMW = readRequired(row, 'nuclear', _day, timeS)
    const hydroReservoirMW = readRequired(row, 'hydro', _day, timeS)
    const hydroRoRMW = 0
    const windMW = readRequired(row, 'wind', _day, timeS) + readRequired(row, 'wind_offshore', _day, timeS)
    const solarMW = readRequired(row, 'solar', _day, timeS)
    const chpMW = readRequired(row, 'thermal', _day, timeS)
    const industrialChpMW = readRequired(row, 'energy_storage', _day, timeS)
    const peakersMW = readRequired(row, 'other', _day, timeS)
    const interconnectorsMW = 0
    const totalMW = readRequired(row, 'total', _day, timeS)
    points.push({
      timeS,
      nuclearMW,
      hydroReservoirMW,
      hydroRoRMW,
      windMW,
      solarMW,
      chpMW,
      industrialChpMW,
      peakersMW,
      interconnectorsMW,
      totalMW,
    })
  }
  return points
}

function loadConsumption(_day: string): RealConsumptionPoint[] {
  const realCsv = REAL_CONSUMPTION_CSV_BY_DAY[_day]
  if (!realCsv) {
    throw new Error(`Missing consumption.csv for ${_day} in public/data/${_day}`)
  }

  const rowsByTime = parseRowsByTime(realCsv, ['flex', 'metered', 'profiled', 'total'])
  const points: RealConsumptionPoint[] = []
  for (let i = 0; i < 96; i++) {
    const timeS = i * 900
    const row = rowsByTime.get(timeS)
    if (!row) throw new Error(`Missing consumption row for ${_day} at ${timeS}s`)
    points.push({
      timeS,
      heatingMW: 0,
      nonHeatingMW: Math.abs(readRequired(row, 'profiled', _day, timeS)),
      servicesMW: 0,
      transportMW: Math.abs(readRequired(row, 'flex', _day, timeS)),
      industryMW: Math.abs(readRequired(row, 'metered', _day, timeS)),
      lossesMW: 0,
      exportsMW: 0,
      totalMW: Math.abs(readRequired(row, 'total', _day, timeS)),
    })
  }
  return points
}

export function loadRealDataDay(day: string): RealDataDay {
  const realPricesCsv = REAL_PRICES_CSV_BY_DAY[day]
  if (!realPricesCsv) {
    throw new Error(`Missing prices.csv for ${day} in public/data/${day}`)
  }
  const parsedPrices = parsePricesCsv(realPricesCsv, day)

  return {
    day,
    frequency: { stepS: 1, points: loadFrequency(day) },
    production: { stepS: 900, points: loadProduction(day) },
    consumption: { stepS: 900, points: loadConsumption(day) },
    prices: {
      stepS: 3600,
      daEurPerMWh: parsedPrices.da,
      fcrEurPerMWPerH: parsedPrices.fcr,
      imbalanceUpEurPerMWh: parsedPrices.up,
      imbalanceDownEurPerMWh: parsedPrices.down,
    },
  }
}
