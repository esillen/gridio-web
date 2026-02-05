import type { WeatherRegionsOutput } from './WeatherRegionsModel'

interface ClockInput {
  timeS: number
  localHour: number
  localMinute: number
  localSecond: number
  dayOfYear: number
}

export interface ForecastRegionalOutput {
  stepS: number
  windSiteIds: string[]
  solarSiteIds: string[]
  
  // Wind regions: [region][horizon_index]
  forecastWindSpeed100mMpsByRegion: number[][]
  forecastWindGustMpsByRegion: number[][]
  forecastTemperatureCByWindRegion: number[][]
  forecastIcingRisk01ByWindRegion: number[][]
  
  // Solar sites: [site][horizon_index]
  forecastSolarIrradianceWm2BySite: number[][]
  forecastCloudCover01BySite: number[][]
  forecastTemperatureCBySolarSite: number[][]
  forecastPrecipitationSnowMmphBySite: number[][]
  
  // Uncertainty (scalar over horizon)
  forecastTemperatureSigmaC: number[]
  forecastWindSigmaMps: number[]
  forecastCloudSigma: number[]
}

const HORIZON_S = 86400
const RESOLUTION_S = 60
const N_POINTS = HORIZON_S / RESOLUTION_S

const WIND_N = 8
const SOLAR_N = 2

const WIND_SITE_IDS = ['FarNorth_inland', 'FarNorth_coast', 'North_inland', 'North_coast', 'Central_inland', 'Central_coast_east', 'South_west', 'Offshore']
const SOLAR_SITE_IDS = ['South', 'North']
const SOLAR_LAT_DEG = [56.5, 64.0]

const C = {
  // Uncertainty growth
  sigma0TC: 0.4,
  kTCPerSqrtH: 0.35,
  sigma0WindMps: 1.0,
  kWindMpsPerSqrtH: 0.9,
  sigma0Cloud: 0.10,
  kCloudPerSqrtH: 0.08,

  // Forecast mean-reversion
  tauTForecastS: 6.0e4,
  tauWindForecastS: 7.2e3,
  tauCloudForecastS: 1.44e4,

  // Regional deviation decay
  tauWindDevForecastS: 1800.0,
  tauTempDevForecastS: 7200.0,
  tauCloudDevForecastS: 3600.0,
  tauSnowDevForecastS: 3600.0,

  // Snow forecast
  pSnowNextHourBase: 0.12,
  snowTempBoostC: -1.0,
  snowProbBoost: 0.10,
  tauSnowForecastS: 1.2e4,

  // Solar
  solarConstantWm2: 1361.0,
  clearSkyTransmittance: 0.72,
  kCloud: 0.75,
  pCloud: 1.3,
  minSinElevation: 0.0,

  // Gust
  gustBaseMps: 1.0,
  gustFactor: 0.35,

  // Region definitions
  windMultiplierBySite: [0.95, 1.05, 0.95, 1.05, 0.95, 1.05, 1.02, 1.15],
  tempOffsetCByWindSite: [-6.5, -6.5, -4.5, -4.5, -1.5, -1.5, 1.0, 1.5],
  cloudOffsetBySolarSite: [0.00, 0.05],
  tempOffsetCBySolarSite: [2.0, -3.5],

  // Seasonal constants
  TAnnualMeanC: 2.0,
  TSeasonAmpC: 10.0,
  TSeasonPhaseDoy: 20.0,
  TDiurnalAmpC: 2.0,
  TDiurnalMinHour: 5.0,
  VSeasonMeanMps: 7.0,
  VSeasonAmpMps: 2.0,
  VSeasonPhaseDoy: 10.0,
  cloudSeasonMean: 0.75,
  cloudSeasonAmp: 0.10,
  cloudSeasonPhaseDoy: 5.0,

  // Icing
  icingTHiC: 1.0,
  icingTLoC: -6.0,
}

function clamp(x: number, min: number, max: number): number {
  return Math.min(Math.max(x, min), max)
}

function clamp01(x: number): number {
  return clamp(x, 0, 1)
}

export class ForecastRegionalModel {
  private lastRecomputeTimeS = -1000
  private forecastWindSpeed100mMpsByRegion: number[][] = []
  private forecastWindGustMpsByRegion: number[][] = []
  private forecastTemperatureCByWindRegion: number[][] = []
  private forecastIcingRisk01ByWindRegion: number[][] = []
  private forecastSolarIrradianceWm2BySite: number[][] = []
  private forecastCloudCover01BySite: number[][] = []
  private forecastTemperatureCBySolarSite: number[][] = []
  private forecastPrecipitationSnowMmphBySite: number[][] = []
  private forecastTemperatureSigmaC: number[] = []
  private forecastWindSigmaMps: number[] = []
  private forecastCloudSigma: number[] = []

  constructor() {
    this.reset()
  }

  tick(clock: ClockInput, weather: WeatherRegionsOutput): ForecastRegionalOutput {
    const shouldRecompute = clock.timeS - this.lastRecomputeTimeS >= RESOLUTION_S

    if (shouldRecompute) {
      this.recomputeForecast(clock, weather)
      this.lastRecomputeTimeS = clock.timeS
    }

    return {
      stepS: RESOLUTION_S,
      windSiteIds: WIND_SITE_IDS,
      solarSiteIds: SOLAR_SITE_IDS,
      forecastWindSpeed100mMpsByRegion: this.forecastWindSpeed100mMpsByRegion,
      forecastWindGustMpsByRegion: this.forecastWindGustMpsByRegion,
      forecastTemperatureCByWindRegion: this.forecastTemperatureCByWindRegion,
      forecastIcingRisk01ByWindRegion: this.forecastIcingRisk01ByWindRegion,
      forecastSolarIrradianceWm2BySite: this.forecastSolarIrradianceWm2BySite,
      forecastCloudCover01BySite: this.forecastCloudCover01BySite,
      forecastTemperatureCBySolarSite: this.forecastTemperatureCBySolarSite,
      forecastPrecipitationSnowMmphBySite: this.forecastPrecipitationSnowMmphBySite,
      forecastTemperatureSigmaC: this.forecastTemperatureSigmaC,
      forecastWindSigmaMps: this.forecastWindSigmaMps,
      forecastCloudSigma: this.forecastCloudSigma,
    }
  }

  private recomputeForecast(clock: ClockInput, weather: WeatherRegionsOutput): void {
    const pi = Math.PI
    const doy = clock.dayOfYear
    const tDayS0 = clock.localHour * 3600 + clock.localMinute * 60 + clock.localSecond

    const TSynNow = weather.synoptic.temperatureC
    const VSynNow = weather.synoptic.windMps
    const cloudSynNow = weather.synoptic.cloudCover01
    const snowSynNowMmph = weather.synoptic.snowIntensityMmph

    // Compute current deviations
    const windDevNowByR: number[] = []
    const tempDevNowByR: number[] = []
    for (let r = 0; r < WIND_N; r++) {
      const wr = weather.windRegions[r]!
      const mult = C.windMultiplierBySite[r]!
      const toff = C.tempOffsetCByWindSite[r]!
      windDevNowByR[r] = wr.windSpeed100mMps - VSynNow * mult
      tempDevNowByR[r] = wr.temperatureC - (TSynNow + toff)
    }

    const cloudDevNowByS: number[] = []
    const snowDevFracNowByS: number[] = []
    for (let s = 0; s < SOLAR_N; s++) {
      const ss = weather.solarSites[s]!
      const coff = C.cloudOffsetBySolarSite[s]!
      cloudDevNowByS[s] = ss.cloudCover01 - (cloudSynNow + coff)
      const base = Math.max(0.01, snowSynNowMmph)
      snowDevFracNowByS[s] = ss.precipitationSnowMmph / base - 1.0
    }

    // Initialize arrays
    this.forecastWindSpeed100mMpsByRegion = Array(WIND_N)
      .fill(0)
      .map(() => Array(N_POINTS).fill(0))
    this.forecastWindGustMpsByRegion = Array(WIND_N)
      .fill(0)
      .map(() => Array(N_POINTS).fill(0))
    this.forecastTemperatureCByWindRegion = Array(WIND_N)
      .fill(0)
      .map(() => Array(N_POINTS).fill(0))
    this.forecastIcingRisk01ByWindRegion = Array(WIND_N)
      .fill(0)
      .map(() => Array(N_POINTS).fill(0))
    this.forecastSolarIrradianceWm2BySite = Array(SOLAR_N)
      .fill(0)
      .map(() => Array(N_POINTS).fill(0))
    this.forecastCloudCover01BySite = Array(SOLAR_N)
      .fill(0)
      .map(() => Array(N_POINTS).fill(0))
    this.forecastTemperatureCBySolarSite = Array(SOLAR_N)
      .fill(0)
      .map(() => Array(N_POINTS).fill(0))
    this.forecastPrecipitationSnowMmphBySite = Array(SOLAR_N)
      .fill(0)
      .map(() => Array(N_POINTS).fill(0))
    this.forecastTemperatureSigmaC = Array(N_POINTS).fill(0)
    this.forecastWindSigmaMps = Array(N_POINTS).fill(0)
    this.forecastCloudSigma = Array(N_POINTS).fill(0)

    // Loop over horizon
    for (let i = 0; i < N_POINTS; i++) {
      const hS = i * RESOLUTION_S
      const tDayS = (tDayS0 + hS) % 86400

      // Seasonal targets
      const TSeasonC = C.TAnnualMeanC - C.TSeasonAmpC * Math.cos((2 * pi * (doy - C.TSeasonPhaseDoy)) / 365)
      const VSeasonTargetMps = C.VSeasonMeanMps + C.VSeasonAmpMps * Math.cos((2 * pi * (doy - C.VSeasonPhaseDoy)) / 365)
      const cloudTarget = C.cloudSeasonMean + C.cloudSeasonAmp * Math.cos((2 * pi * (doy - C.cloudSeasonPhaseDoy)) / 365)

      // Diurnal temp
      const TDiurnalC = C.TDiurnalAmpC * Math.sin((2 * pi * (tDayS - (C.TDiurnalMinHour * 3600 + 86400 / 4))) / 86400)
      const TTargetC = TSeasonC + TDiurnalC

      // Synoptic forecasts
      const TSynHatC = TTargetC + (TSynNow - TTargetC) * Math.exp(-hS / C.tauTForecastS)
      const VSynHatMps = VSeasonTargetMps + (VSynNow - VSeasonTargetMps) * Math.exp(-hS / C.tauWindForecastS)
      const cloudSynHat = clamp01(cloudTarget + (cloudSynNow - cloudTarget) * Math.exp(-hS / C.tauCloudForecastS))

      // Snow forecast
      const pSnowNextHour = clamp01(C.pSnowNextHourBase + (TSynHatC < C.snowTempBoostC ? C.snowProbBoost : 0.0) + 0.10 * (cloudSynHat - 0.7))
      const snowSynHatMmph = clamp(pSnowNextHour * (0.6 * Math.exp(-hS / C.tauSnowForecastS) + 0.2) * 1.2, 0.0, 2.0)

      // Uncertainty
      const hHours = hS / 3600
      this.forecastTemperatureSigmaC[i] = C.sigma0TC + C.kTCPerSqrtH * Math.sqrt(hHours)
      this.forecastWindSigmaMps[i] = C.sigma0WindMps + C.kWindMpsPerSqrtH * Math.sqrt(hHours)
      this.forecastCloudSigma[i] = C.sigma0Cloud + C.kCloudPerSqrtH * Math.sqrt(hHours)

      // Wind regions
      for (let r = 0; r < WIND_N; r++) {
        const devHat = (windDevNowByR[r] ?? 0) * Math.exp(-hS / C.tauWindDevForecastS)
        const vHat = VSynHatMps * (C.windMultiplierBySite[r] ?? 1) + devHat
        this.forecastWindSpeed100mMpsByRegion[r]![i] = clamp(vHat, 0.0, 35.0)

        const vVal = this.forecastWindSpeed100mMpsByRegion[r]![i]!
        const gHat = vVal + C.gustBaseMps + C.gustFactor * vVal
        this.forecastWindGustMpsByRegion[r]![i] = clamp(gHat, vVal, 45.0)

        const tempDevHat = (tempDevNowByR[r] ?? 0) * Math.exp(-hS / C.tauTempDevForecastS)
        const toff = C.tempOffsetCByWindSite[r] ?? 0
        this.forecastTemperatureCByWindRegion[r]![i] = TSynHatC + toff + tempDevHat

        const THat = this.forecastTemperatureCByWindRegion[r]![i] ?? 0
        const snowOn = snowSynHatMmph > 0.05 ? 1.0 : 0.0
        this.forecastIcingRisk01ByWindRegion[r]![i] = clamp01(snowOn * ((THat <= C.icingTHiC && THat >= C.icingTLoC ? 1.0 : 0.0) + (THat < C.icingTLoC ? 0.4 : 0.0)))
      }

      // Solar sites
      const declDeg = 23.44 * Math.sin((2 * pi * (284 + doy)) / 365)
      const declRad = declDeg * (pi / 180)
      const tHours = tDayS / 3600
      const HRad = (tHours - 12.0) * 15.0 * (pi / 180)

      for (let s = 0; s < SOLAR_N; s++) {
        const cloudDevHat = (cloudDevNowByS[s] ?? 0) * Math.exp(-hS / C.tauCloudDevForecastS)
        const coff = C.cloudOffsetBySolarSite[s] ?? 0
        this.forecastCloudCover01BySite[s]![i] = clamp01(cloudSynHat + coff + cloudDevHat)

        const tOff = C.tempOffsetCBySolarSite[s] ?? 0
        this.forecastTemperatureCBySolarSite[s]![i] = TSynHatC + tOff

        // Solar irradiance
        const latRad = (SOLAR_LAT_DEG[s] ?? 0) * (pi / 180)
        const sinElev = Math.sin(latRad) * Math.sin(declRad) + Math.cos(latRad) * Math.cos(declRad) * Math.cos(HRad)
        const sinElevPos = Math.max(C.minSinElevation, sinElev)
        const ghiClear = C.solarConstantWm2 * C.clearSkyTransmittance * sinElevPos

        const cloudHat = this.forecastCloudCover01BySite[s]![i] ?? 0
        const cloudFactor = clamp01(1.0 - C.kCloud * Math.pow(cloudHat, C.pCloud))
        this.forecastSolarIrradianceWm2BySite[s]![i] = ghiClear * cloudFactor

        // Snow precipitation
        const snowDevHat = (snowDevFracNowByS[s] ?? 0) * Math.exp(-hS / C.tauSnowDevForecastS)
        const mult = clamp(1.0 + snowDevHat, 0.7, 1.3)
        this.forecastPrecipitationSnowMmphBySite[s]![i] = snowSynHatMmph * mult
      }
    }
  }

  reset(): void {
    this.lastRecomputeTimeS = -1000
    this.forecastWindSpeed100mMpsByRegion = Array(WIND_N)
      .fill(0)
      .map(() => Array(N_POINTS).fill(0))
    this.forecastWindGustMpsByRegion = Array(WIND_N)
      .fill(0)
      .map(() => Array(N_POINTS).fill(0))
    this.forecastTemperatureCByWindRegion = Array(WIND_N)
      .fill(0)
      .map(() => Array(N_POINTS).fill(0))
    this.forecastIcingRisk01ByWindRegion = Array(WIND_N)
      .fill(0)
      .map(() => Array(N_POINTS).fill(0))
    this.forecastSolarIrradianceWm2BySite = Array(SOLAR_N)
      .fill(0)
      .map(() => Array(N_POINTS).fill(0))
    this.forecastCloudCover01BySite = Array(SOLAR_N)
      .fill(0)
      .map(() => Array(N_POINTS).fill(0))
    this.forecastTemperatureCBySolarSite = Array(SOLAR_N)
      .fill(0)
      .map(() => Array(N_POINTS).fill(0))
    this.forecastPrecipitationSnowMmphBySite = Array(SOLAR_N)
      .fill(0)
      .map(() => Array(N_POINTS).fill(0))
    this.forecastTemperatureSigmaC = Array(N_POINTS).fill(0)
    this.forecastWindSigmaMps = Array(N_POINTS).fill(0)
    this.forecastCloudSigma = Array(N_POINTS).fill(0)
  }
}
