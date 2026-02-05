import { WorldSimulation } from '../src/game/WorldSimulation'
import * as fs from 'fs'
import * as path from 'path'

const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const RUN_DIR = `simulation_${timestamp}`
const OUTPUT_DIR = path.join(process.cwd(), 'model_output', RUN_DIR)

fs.mkdirSync(OUTPUT_DIR, { recursive: true })

console.log('Starting simulation...')
console.log('Output directory:', OUTPUT_DIR)

// Create simulation with all toggles except BESS (same config shape as game)
const simulation = new WorldSimulation({
  startDayOfYear: 15,
  toggles: {
    nuclear: true,
    hydroReservoir: true,
    hydroRoR: true,
    wind: true,
    solar: true,
    chp: true,
    peakers: true,
    interconnectors: true,
    demandResponse: false,
  },
})

simulation.initialize()

const WARMUP_HOURS = 12
const SIMULATION_HOURS = 24
const TOTAL_SECONDS = (WARMUP_HOURS + SIMULATION_HOURS) * 3600

// CSV writers
const csvWriters: { [key: string]: fs.WriteStream } = {}

function initCSV(name: string, headers: string[]) {
  const stream = fs.createWriteStream(path.join(OUTPUT_DIR, `${name}.csv`))
  stream.write(headers.join(',') + '\n')
  csvWriters[name] = stream
  return stream
}

function writeCSVRow(name: string, values: (string | number)[]) {
  if (csvWriters[name]) {
    csvWriters[name].write(values.join(',') + '\n')
  }
}

// Initialize CSV files
initCSV('weather_synoptic', ['time_s', 'temperature_C', 'wind_mps', 'cloud_cover_0_1', 'is_snowing', 'snow_intensity_mmph'])

initCSV('weather_wind_regions', [
  'time_s', 'region_id',
  'wind_speed_100m_mps', 'wind_gust_mps', 'temperature_C', 'icing_risk_0_1'
])

initCSV('weather_solar_sites', [
  'time_s', 'site_id',
  'solar_irradiance_Wm2', 'temperature_C', 'cloud_cover_0_1', 'precipitation_snow_mmph'
])

initCSV('production', [
  'time_s',
  'nuclear_MW', 'hydro_reservoir_MW', 'hydro_ror_MW', 'wind_MW', 'solar_MW',
  'chp_MW', 'industrial_chp_MW', 'peakers_MW', 'interconnector_MW', 'total_MW'
])

initCSV('production_wind_regions', ['time_s', 'region_id', 'production_MW', 'capacity_MW', 'power_frac_0_1'])
initCSV('production_solar_sites', ['time_s', 'site_id', 'production_MW', 'capacity_MW', 'power_frac_0_1'])

initCSV('consumption', [
  'time_s',
  'heating_MW', 'non_heating_MW', 'services_MW', 'transport_MW', 'industry_MW', 'grid_losses_MW', 'total_MW'
])

initCSV('frequency', [
  'time_s', 'frequency_Hz', 'rocof_Hz_per_s', 'imbalance_raw_MW', 'imbalance_damped_MW',
  'fcr_response_MW', 'band'
])

initCSV('reserves', [
  'time_s', 'fcr_MW', 'ffr_MW', 'afrr_MW', 'mfrr_MW', 'total_reserve_MW'
])

initCSV('debug_outputs', [
  'time_s',
  'capabilities_now_hydro_reservoir_reservoir_energy_MWh',
  'generation_hydro_reservoir_fleet_energy_budget_today_MWh',
  'generation_hydro_reservoir_fleet_reservoir_storage_MWh'
])

console.log('Running warm-up phase...')
let startTime = Date.now()

for (let t = 0; t < TOTAL_SECONDS; t++) {
  simulation.tick()

  // Only record data after warm-up
  if (t < WARMUP_HOURS * 3600) {
    if (t % 3600 === 0) {
      console.log(`Warm-up: ${t / 3600}/${WARMUP_HOURS} hours`)
    }
    continue
  }

  const simTime = t - WARMUP_HOURS * 3600

  if (simTime % 3600 === 0) {
    const elapsed = (Date.now() - startTime) / 1000
    console.log(`Simulation: ${simTime / 3600}/${SIMULATION_HOURS} hours (${elapsed.toFixed(1)}s elapsed)`)
  }

  // Weather data
  const weather = simulation.currentWeather
  if (weather) {
    writeCSVRow('weather_synoptic', [
      simTime,
      weather.synoptic.temperatureC,
      weather.synoptic.windMps,
      weather.synoptic.cloudCover01,
      weather.synoptic.isSnowing ? 1 : 0,
      weather.synoptic.snowIntensityMmph
    ])

    for (let r = 0; r < weather.windRegions.length; r++) {
      const region = weather.windRegions[r]
      writeCSVRow('weather_wind_regions', [
        simTime, r,
        region.windSpeed100mMps, region.windGustMps, region.temperatureC, region.icingRisk01
      ])
    }

    for (let s = 0; s < weather.solarSites.length; s++) {
      const site = weather.solarSites[s]
      writeCSVRow('weather_solar_sites', [
        simTime, s,
        site.solarIrradianceWm2, site.temperatureC, site.cloudCover01, site.precipitationSnowMmph
      ])
    }
  }

  // Production data
  const nuclear = simulation.nuclearBreakdown
  const hydroRes = simulation.hydroReservoirBreakdown
  const hydroRoR = simulation.hydroRoRBreakdown
  const wind = simulation.windBreakdown
  const solar = simulation.solarBreakdown
  const chp = simulation.chpBreakdown
  const industrialChp = simulation.industrialChpBreakdown
  const peakers = simulation.peakersBreakdown
  const interconnectors = simulation.interconnectorsBreakdown

  const totalProduction = 
    (nuclear?.productionMW ?? 0) +
    (hydroRes?.productionMW ?? 0) +
    (hydroRoR?.productionMW ?? 0) +
    (wind?.productionMW ?? 0) +
    (solar?.productionMW ?? 0) +
    (chp?.electricMW ?? 0) +
    (industrialChp?.electricMW ?? 0) +
    (peakers?.productionMW ?? 0) +
    (interconnectors?.netImportMW ?? 0)

  writeCSVRow('production', [
    simTime,
    nuclear?.productionMW ?? 0,
    hydroRes?.productionMW ?? 0,
    hydroRoR?.productionMW ?? 0,
    wind?.productionMW ?? 0,
    solar?.productionMW ?? 0,
    chp?.electricMW ?? 0,
    industrialChp?.electricMW ?? 0,
    peakers?.productionMW ?? 0,
    interconnectors?.netImportMW ?? 0,
    totalProduction
  ])

  if (wind?.regions) {
    for (let r = 0; r < wind.regions.length; r++) {
      const region = wind.regions[r]
      writeCSVRow('production_wind_regions', [
        simTime, r,
        region.productionMW, region.capacityMW, region.powerFrac01
      ])
    }
  }

  if (solar?.sites) {
    for (let s = 0; s < solar.sites.length; s++) {
      const site = solar.sites[s]
      writeCSVRow('production_solar_sites', [
        simTime, s,
        site.productionMW, site.capacityMW, site.powerFrac01
      ])
    }
  }

  // Consumption data (breakdowns use consumptionMW; heating has component fields only)
  const heating = simulation.heatingBreakdown
  const nonHeating = simulation.nonHeatingBreakdown
  const services = simulation.servicesBreakdown
  const transport = simulation.transportBreakdown
  const industry = simulation.industryBreakdown
  const gridLosses = simulation.gridLossesBreakdown

  const heatingMW = heating
    ? heating.hpCompressorElecMW + heating.hpAuxResistiveElecMW + heating.directSpaceheatElecMW + heating.hvacParasiticMW
    : 0
  const nonHeatingMW = nonHeating?.consumptionMW ?? 0
  const servicesMW = services?.consumptionMW ?? 0
  const transportMW = transport?.consumptionMW ?? 0
  const industryMW = industry?.consumptionMW ?? 0
  const gridLossesMW = gridLosses?.consumptionMW ?? 0
  const totalConsumption = heatingMW + nonHeatingMW + servicesMW + transportMW + industryMW + gridLossesMW

  writeCSVRow('consumption', [
    simTime,
    heatingMW,
    nonHeatingMW,
    servicesMW,
    transportMW,
    industryMW,
    gridLossesMW,
    totalConsumption
  ])

  // Frequency data
  const freq = simulation.frequencyBreakdown
  if (freq) {
    writeCSVRow('frequency', [
      simTime,
      freq.frequencyHz,
      freq.rocofHzPerS,
      freq.imbalanceRawMW,
      freq.imbalanceDampedMW,
      freq.fcrResponseMW,
      freq.band
    ])
  }

  // Reserves data
  const fcr = simulation.fcrBreakdown
  const ffr = simulation.ffrBreakdown
  const afrr = simulation.afrrBreakdown
  const mfrr = simulation.mfrrBreakdown

  const fcrMW = fcr?.activatedMW ?? 0
  const ffrMW = ffr?.activationMW ?? 0
  const afrrMW = afrr?.activatedMW ?? 0
  const mfrrMW = mfrr?.activatedMW ?? 0
  writeCSVRow('reserves', [
    simTime,
    fcrMW,
    ffrMW,
    afrrMW,
    mfrrMW,
    fcrMW + ffrMW + afrrMW + mfrrMW
  ])

  const capReservoirEnergyMWh = hydroRes?.energyBudgetTodayMWh ?? 300000
  writeCSVRow('debug_outputs', [
    simTime,
    capReservoirEnergyMWh,
    hydroRes?.energyBudgetTodayMWh ?? '',
    hydroRes?.reservoirStorageMWh ?? ''
  ])
}

// Close all CSV files
for (const name in csvWriters) {
  csvWriters[name].end()
}

const totalElapsed = (Date.now() - startTime) / 1000
console.log(`\nSimulation complete!`)
console.log(`Total time: ${totalElapsed.toFixed(1)}s`)
console.log(`Output written to: ${OUTPUT_DIR}`)
console.log(`Files created:`)
for (const name in csvWriters) {
  console.log(`  - ${name}.csv`)
}
