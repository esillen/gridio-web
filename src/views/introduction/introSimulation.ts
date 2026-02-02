import { createSeededRandom, createSeededGaussian } from './seededRandom'

export interface HourlyData {
  hour: number
  heating: number
  nonHeating: number
  services: number
  transport: number
  industry: number
  losses: number
  nuclear: number
  hydroReservoir: number
  hydroRoR: number
  wind: number
  solar: number
  chp: number
}

export interface DemandCategory {
  key: keyof HourlyData
  label: string
  color: string
}

export interface ProductionCategory {
  key: keyof HourlyData
  label: string
  color: string
}

export const DEMAND_CATEGORIES: DemandCategory[] = [
  { key: 'heating', label: 'Space Heating', color: '#EF4444' },
  { key: 'industry', label: 'Industry', color: '#8B5CF6' },
  { key: 'services', label: 'Services & Commercial', color: '#F59E0B' },
  { key: 'nonHeating', label: 'Residential (non-heating)', color: '#EC4899' },
  { key: 'transport', label: 'Transport (Rail + EV)', color: '#06B6D4' },
  { key: 'losses', label: 'Grid Losses', color: '#6B7280' },
]

export const PRODUCTION_CATEGORIES: ProductionCategory[] = [
  { key: 'nuclear', label: 'Nuclear', color: '#F0A679' },
  { key: 'hydroReservoir', label: 'Hydro (Reservoir)', color: '#4467FE' },
  { key: 'hydroRoR', label: 'Hydro (Run-of-River)', color: '#7B9FFF' },
  { key: 'chp', label: 'CHP (Biofuel & Waste)', color: '#E879F9' },
  { key: 'wind', label: 'Wind', color: '#95957F' },
  { key: 'solar', label: 'Solar', color: '#FFC877' },
]

const INTRO_SEED = 12345

// Generate 24 hours of data using simplified model logic
export function generateIntroData(): HourlyData[] {
  const random = createSeededRandom(INTRO_SEED)
  const gaussian = createSeededGaussian(random)
  
  const data: HourlyData[] = []
  
  // Winter day (mid-January), temperature around -5°C
  const baseTemp = -5
  const tempVariation = gaussian(0, 2)
  
  // Wind varies through day
  const baseWind = 8 + gaussian(0, 2)
  
  for (let hour = 0; hour < 24; hour++) {
    // Temperature varies slightly through day
    const hourTemp = baseTemp + tempVariation + 2 * Math.sin((hour - 14) / 24 * 2 * Math.PI)
    
    // Heating demand (temperature-driven)
    const heatingBase = 4500
    const heatingTempFactor = Math.max(0, (15 - hourTemp) / 35) // heating degrees
    const heatingHourFactors = [0.85, 0.82, 0.80, 0.80, 0.82, 0.90, 1.05, 1.15, 1.10, 1.00, 0.95, 0.92,
                               0.90, 0.88, 0.88, 0.90, 0.95, 1.05, 1.12, 1.08, 1.00, 0.95, 0.90, 0.88]
    const heatingHourFactor = heatingHourFactors[hour] ?? 1.0
    const heating = heatingBase * heatingTempFactor * heatingHourFactor * (1 + gaussian(0, 0.02))
    
    // Non-heating residential (DHW, appliances, lighting)
    const nonHeatingBase = 1800
    const nonHeatingHourFactors = [0.55, 0.50, 0.48, 0.48, 0.50, 0.65, 0.90, 1.05, 0.95, 0.85, 0.80, 0.78,
                                   0.80, 0.82, 0.85, 0.90, 1.00, 1.15, 1.20, 1.15, 1.05, 0.95, 0.80, 0.65]
    const nonHeatingHourFactor = nonHeatingHourFactors[hour] ?? 1.0
    const nonHeating = nonHeatingBase * nonHeatingHourFactor * (1 + gaussian(0, 0.03))
    
    // Services/commercial
    const servicesBase = 2200
    const servicesHourFactors = [0.45, 0.42, 0.40, 0.40, 0.42, 0.50, 0.75, 0.95, 1.10, 1.15, 1.18, 1.18,
                                 1.15, 1.12, 1.10, 1.08, 1.05, 1.00, 0.90, 0.75, 0.60, 0.55, 0.50, 0.48]
    const servicesHourFactor = servicesHourFactors[hour] ?? 1.0
    const services = servicesBase * servicesHourFactor * (1 + gaussian(0, 0.02))
    
    // Transport (rail + EV charging)
    const transportBase = 800
    const transportHourFactors = [0.30, 0.25, 0.22, 0.20, 0.22, 0.35, 0.70, 1.00, 1.05, 0.95, 0.90, 0.88,
                                  0.90, 0.92, 0.95, 1.00, 1.10, 1.20, 1.25, 1.15, 1.00, 0.80, 0.55, 0.40]
    const transportHourFactor = transportHourFactors[hour] ?? 1.0
    const transport = transportBase * transportHourFactor * (1 + gaussian(0, 0.04))
    
    // Industry (fairly flat with weekday/weekend variation)
    const industryBase = 3500
    const industryHourFactors = [0.85, 0.82, 0.80, 0.80, 0.82, 0.90, 1.00, 1.08, 1.10, 1.10, 1.10, 1.08,
                                 1.05, 1.05, 1.05, 1.05, 1.02, 0.98, 0.95, 0.92, 0.90, 0.88, 0.87, 0.86]
    const industryHourFactor = industryHourFactors[hour] ?? 1.0
    const industry = industryBase * industryHourFactor * (1 + gaussian(0, 0.02))
    
    // Grid losses (proportional to total load)
    const baseDemand = heating + nonHeating + services + transport + industry
    const losses = baseDemand * 0.035 * (1 + gaussian(0, 0.01))
    
    const totalConsumption = heating + nonHeating + services + transport + industry + losses
    
    // Nuclear (baseload, nearly constant)
    const nuclear = 6800 * (1 + gaussian(0, 0.005))
    
    // Hydro reservoir (dispatchable, follows demand)
    const hydroNeed = Math.max(0, totalConsumption - nuclear - 2000) // rough target
    const hydroReservoir = Math.min(10000, Math.max(2000, hydroNeed * (0.7 + gaussian(0, 0.1))))
    
    // Hydro run-of-river (seasonal, relatively stable)
    const hydroRoR = 1200 * (1 + gaussian(0, 0.05))
    
    // Wind (variable, with some daily pattern)
    const windSpeed = baseWind + 3 * Math.sin((hour - 6) / 24 * 2 * Math.PI) + gaussian(0, 1.5)
    const windCapacity = 16000
    const windCurve = Math.pow(Math.max(0, Math.min(1, (windSpeed - 3) / 12)), 3)
    const wind = windCapacity * windCurve * 0.35 * (1 + gaussian(0, 0.05))
    
    // Solar (zero in winter morning/evening, peak midday)
    const solarHour = hour - 12
    const solarFactor = Math.max(0, Math.cos(solarHour / 12 * Math.PI) * 0.8)
    const solarCapacity = 4000
    const solar = solarCapacity * solarFactor * 0.15 * (1 + gaussian(0, 0.1)) // Low in winter
    
    // CHP (heat-led, higher when cold)
    const chpHeatDemand = heatingTempFactor * heatingHourFactor
    const chp = 2500 * chpHeatDemand * (1 + gaussian(0, 0.03))
    
    data.push({
      hour,
      heating: Math.round(heating),
      nonHeating: Math.round(nonHeating),
      services: Math.round(services),
      transport: Math.round(transport),
      industry: Math.round(industry),
      losses: Math.round(losses),
      nuclear: Math.round(nuclear),
      hydroReservoir: Math.round(hydroReservoir),
      hydroRoR: Math.round(hydroRoR),
      wind: Math.round(wind),
      solar: Math.round(solar),
      chp: Math.round(chp),
    })
  }
  
  return data
}

export function getTotalConsumption(data: HourlyData): number {
  return data.heating + data.nonHeating + data.services + data.transport + data.industry + data.losses
}

export function getTotalProduction(data: HourlyData): number {
  return data.nuclear + data.hydroReservoir + data.hydroRoR + data.wind + data.solar + data.chp
}
