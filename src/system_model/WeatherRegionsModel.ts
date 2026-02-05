export interface WindRegionWeather {
  windSpeed100mMps: number
  windGustMps: number
  temperatureC: number
  icingRisk01: number
}

export interface SolarSiteWeather {
  solarIrradianceWm2: number
  temperatureC: number
  cloudCover01: number
  precipitationSnowMmph: number
}

export interface SynopticWeather {
  temperatureC: number
  windMps: number
  cloudCover01: number
  isSnowing: boolean
  snowIntensityMmph: number
}

export interface WeatherRegionsOutput {
  windRegions: WindRegionWeather[]
  solarSites: SolarSiteWeather[]
  synoptic: SynopticWeather
}

interface ClockInput {
  timeS: number
  localHour: number
  localMinute: number
  localSecond: number
  dayOfYear: number
}

const WIND_N = 8
const SOLAR_N = 2

const SOLAR_LAT_DEG = [56.5, 64.0]

const CONSTANTS = {
  dtS: 1.0,
  dayS: 86400.0,

  // Seasonal
  TAnnualMeanC: 2.0,
  TSeasonAmpC: 10.0,
  TSeasonPhaseDoy: 20.0,
  VSeasonMeanMps: 7.0,
  VSeasonAmpMps: 2.0,
  VSeasonPhaseDoy: 10.0,
  cloudSeasonMean: 0.75,
  cloudSeasonAmp: 0.10,
  cloudSeasonPhaseDoy: 5.0,

  // Diurnal
  TDiurnalAmpC: 2.0,
  TDiurnalMinHour: 5.0,

  // Synoptic (shared)
  tauTMeanS: 6.0e4,
  sigmaTCPerSqrtS: 0.010,
  tauFrontS: 2.0e5,
  sigmaFrontCPerSqrtS: 0.004,
  tauWindSynS: 7.2e3,
  sigmaWindSynMpsPerSqrtS: 0.030,
  tauCloudSynS: 1.44e4,
  sigmaCloudSynPerSqrtS: 0.0012,

  // Snow
  pStartSnowPerS: 2.0e-5,
  pStopSnowPerS: 2.0e-4,
  snowIntensityMinMmph: 0.1,
  snowIntensityMaxMmph: 2.0,
  tauSnowIntensityS: 1800.0,
  sigmaSnowIntensityMmphPerSqrtS: 0.02,

  // Regional deviations
  tauWindRegS: 1800.0,
  sigmaWindRegMpsPerSqrtS: 0.015,
  tauTempRegS: 7200.0,
  sigmaTempRegCPerSqrtS: 0.003,
  tauCloudRegS: 3600.0,
  sigmaCloudRegPerSqrtS: 0.0009,
  tauSnowRegS: 3600.0,
  sigmaSnowRegPerSqrtS: 0.002,

  // Regional multipliers/offsets
  windMultiplierBySite: [0.95, 1.05, 0.95, 1.05, 0.95, 1.05, 1.02, 1.15],
  tempOffsetCByWindSite: [-6.5, -6.5, -4.5, -4.5, -1.5, -1.5, 1.0, 1.5],
  tempOffsetCBySolarSite: [2.0, -3.5],
  cloudOffsetBySolarSite: [0.00, 0.05],

  // Gust
  gustBaseMps: 1.0,
  gustFactor: 0.35,
  sigmaGustMps: 0.7,

  // Solar
  solarConstantWm2: 1361.0,
  clearSkyTransmittance: 0.72,
  kCloud: 0.75,
  pCloud: 1.3,
  minSinElevation: 0.0,
}

function clamp(x: number, min: number, max: number): number {
  return Math.min(Math.max(x, min), max)
}

function clamp01(x: number): number {
  return clamp(x, 0, 1)
}

function randomNormal(): number {
  const u1 = Math.random()
  const u2 = Math.random()
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
}

export class WeatherRegionsModel {
  private synTemperatureC = -8.0
  private frontOffsetC = 0.0
  private synWindMps = 8.0
  private synCloudCover01 = 0.8
  private synIsSnowing = false
  private synSnowIntensityMmph = 0.0

  private windDevMpsBySite: number[] = Array(WIND_N).fill(0)
  private tempDevCBySite: number[] = Array(WIND_N).fill(0)
  private cloudDev01BySolarSite: number[] = Array(SOLAR_N).fill(0)
  private snowDevFracBySolarSite: number[] = Array(SOLAR_N).fill(0)

  tick(clock: ClockInput): WeatherRegionsOutput {
    const C = CONSTANTS
    const dt = C.dtS
    const tDayS = clock.localHour * 3600 + clock.localMinute * 60 + clock.localSecond
    const doy = clock.dayOfYear
    const pi = Math.PI

    // Seasonal targets
    const TSeasonC = C.TAnnualMeanC - C.TSeasonAmpC * Math.cos(2 * pi * (doy - C.TSeasonPhaseDoy) / 365)
    const VSeasonTargetMps = C.VSeasonMeanMps + C.VSeasonAmpMps * Math.cos(2 * pi * (doy - C.VSeasonPhaseDoy) / 365)
    const cloudTarget = C.cloudSeasonMean + C.cloudSeasonAmp * Math.cos(2 * pi * (doy - C.cloudSeasonPhaseDoy) / 365)

    // Diurnal temperature
    const TDiurnalC = C.TDiurnalAmpC * Math.sin(2 * pi * (tDayS - (C.TDiurnalMinHour * 3600 + C.dayS / 4)) / C.dayS)

    // Front offset
    this.frontOffsetC += (0.0 - this.frontOffsetC) * (dt / C.tauFrontS) + C.sigmaFrontCPerSqrtS * Math.sqrt(dt) * randomNormal()

    // Synoptic temperature
    const TTargetC = TSeasonC + this.frontOffsetC + TDiurnalC
    this.synTemperatureC += (TTargetC - this.synTemperatureC) * (dt / C.tauTMeanS) + C.sigmaTCPerSqrtS * Math.sqrt(dt) * randomNormal()

    // Synoptic wind
    this.synWindMps = clamp(
      this.synWindMps + (VSeasonTargetMps - this.synWindMps) * (dt / C.tauWindSynS) + C.sigmaWindSynMpsPerSqrtS * Math.sqrt(dt) * randomNormal(),
      0.0,
      35.0
    )

    // Synoptic cloud
    this.synCloudCover01 = clamp01(
      this.synCloudCover01 + (cloudTarget - this.synCloudCover01) * (dt / C.tauCloudSynS) + C.sigmaCloudSynPerSqrtS * Math.sqrt(dt) * randomNormal()
    )

    // Snow on/off
    if (!this.synIsSnowing) {
      if (Math.random() < C.pStartSnowPerS) {
        this.synIsSnowing = true
      }
    } else {
      if (Math.random() < C.pStopSnowPerS) {
        this.synIsSnowing = false
      }
    }

    // Snow intensity
    if (this.synIsSnowing) {
      this.synSnowIntensityMmph = clamp(
        this.synSnowIntensityMmph +
          (0.7 - this.synSnowIntensityMmph) * (dt / C.tauSnowIntensityS) +
          C.sigmaSnowIntensityMmphPerSqrtS * Math.sqrt(dt) * randomNormal(),
        C.snowIntensityMinMmph,
        C.snowIntensityMaxMmph
      )
    } else {
      this.synSnowIntensityMmph = 0.0
    }

    // Regional wind deviations
    for (let r = 0; r < WIND_N; r++) {
      this.windDevMpsBySite[r]! += (0.0 - (this.windDevMpsBySite[r] ?? 0)) * (dt / C.tauWindRegS) + C.sigmaWindRegMpsPerSqrtS * Math.sqrt(dt) * randomNormal()
    }

    // Regional temp deviations
    for (let r = 0; r < WIND_N; r++) {
      this.tempDevCBySite[r]! += (0.0 - (this.tempDevCBySite[r] ?? 0)) * (dt / C.tauTempRegS) + C.sigmaTempRegCPerSqrtS * Math.sqrt(dt) * randomNormal()
    }

    // Solar-site cloud deviations
    for (let s = 0; s < SOLAR_N; s++) {
      this.cloudDev01BySolarSite[s]! += (0.0 - (this.cloudDev01BySolarSite[s] ?? 0)) * (dt / C.tauCloudRegS) + C.sigmaCloudRegPerSqrtS * Math.sqrt(dt) * randomNormal()
    }

    // Solar-site snow deviations
    for (let s = 0; s < SOLAR_N; s++) {
      this.snowDevFracBySolarSite[s]! += (0.0 - (this.snowDevFracBySolarSite[s] ?? 0)) * (dt / C.tauSnowRegS) + C.sigmaSnowRegPerSqrtS * Math.sqrt(dt) * randomNormal()
    }

    // Derive wind-site fields
    const windRegions: WindRegionWeather[] = []
    for (let r = 0; r < WIND_N; r++) {
      const v = this.synWindMps * (C.windMultiplierBySite[r] ?? 1) + (this.windDevMpsBySite[r] ?? 0)
      const windSpeed100mMps = clamp(v, 0.0, 35.0)

      const g = windSpeed100mMps + C.gustBaseMps + C.gustFactor * windSpeed100mMps + C.sigmaGustMps * randomNormal()
      const windGustMps = clamp(g, windSpeed100mMps, 45.0)

      const temperatureC = this.synTemperatureC + (C.tempOffsetCByWindSite[r] ?? 0) + (this.tempDevCBySite[r] ?? 0)

      const T = temperatureC
      const icingRisk01 = clamp01(
        (this.synIsSnowing ? 1.0 : 0.0) *
          ((T <= 1.0 && T >= -6.0 ? 1.0 : 0.0) + (T < -6.0 ? 0.4 : 0.0))
      )

      windRegions.push({ windSpeed100mMps, windGustMps, temperatureC, icingRisk01 })
    }

    // Derive solar-site fields
    const solarSites: SolarSiteWeather[] = []
    for (let s = 0; s < SOLAR_N; s++) {
      const temperatureC = this.synTemperatureC + (C.tempOffsetCBySolarSite[s] ?? 0)
      const cloudCover01 = clamp01(this.synCloudCover01 + (C.cloudOffsetBySolarSite[s] ?? 0) + (this.cloudDev01BySolarSite[s] ?? 0))

      // Solar irradiance
      const latRad = (SOLAR_LAT_DEG[s] ?? 0) * (pi / 180)
      const declDeg = 23.44 * Math.sin((2 * pi * (284 + doy)) / 365)
      const declRad = declDeg * (pi / 180)
      const tHours = tDayS / 3600
      const HRad = (tHours - 12.0) * 15.0 * (pi / 180)

      const sinElev = Math.sin(latRad) * Math.sin(declRad) + Math.cos(latRad) * Math.cos(declRad) * Math.cos(HRad)
      const sinElevPos = Math.max(C.minSinElevation, sinElev)

      const ghiClear = C.solarConstantWm2 * C.clearSkyTransmittance * sinElevPos
      const cloudFactor = clamp01(1.0 - C.kCloud * Math.pow(cloudCover01, C.pCloud))
      const solarIrradianceWm2 = ghiClear * cloudFactor

      // Snow precipitation
      let precipitationSnowMmph = 0.0
      if (this.synIsSnowing) {
        const mult = clamp(1.0 + (this.snowDevFracBySolarSite[s] ?? 0), 0.7, 1.3)
        precipitationSnowMmph = this.synSnowIntensityMmph * mult
      }

      solarSites.push({ solarIrradianceWm2, temperatureC, cloudCover01, precipitationSnowMmph })
    }

    return {
      windRegions,
      solarSites,
      synoptic: {
        temperatureC: this.synTemperatureC,
        windMps: this.synWindMps,
        cloudCover01: this.synCloudCover01,
        isSnowing: this.synIsSnowing,
        snowIntensityMmph: this.synSnowIntensityMmph,
      },
    }
  }

  get synopticTemperatureC(): number {
    return this.synTemperatureC
  }

  reset(): void {
    this.synTemperatureC = -8.0
    this.frontOffsetC = 0.0
    this.synWindMps = 8.0
    this.synCloudCover01 = 0.8
    this.synIsSnowing = false
    this.synSnowIntensityMmph = 0.0
    this.windDevMpsBySite = Array(WIND_N).fill(0)
    this.tempDevCBySite = Array(WIND_N).fill(0)
    this.cloudDev01BySolarSite = Array(SOLAR_N).fill(0)
    this.snowDevFracBySolarSite = Array(SOLAR_N).fill(0)
  }
}
