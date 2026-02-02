export interface ForecastArrays {
  gridTimesS: number[]
  TMeanC: number[]
  windMps: number[]
  cloud01: number[]
  solarWm2: number[]
  snowMmph: number[]
  icing01: number[]
  sigmaTc: number[]
  sigmaWindMps: number[]
  sigmaCloud: number[]
}

export interface ForecastOutput {
  temperatureC: number
  windSpeedMps: number
  cloudCover01: number
  solarIrradianceWm2: number
  precipitationSnowMmph: number
  icingRisk01: number
  sigmaTc: number
  sigmaWindMps: number
  sigmaCloud: number
}

interface ClockInput {
  timeS: number
  localHour: number
  localMinute: number
  localSecond: number
  dayOfYear: number
}

interface WeatherInput {
  temperatureC: number
  frontOffsetC: number
  windSpeed100mMps: number
  cloudCover01: number
  precipitationSnowMmph: number
  icingRisk01: number
}

const CONSTANTS = {
  horizonS: 86400,
  resolutionS: 60,

  // Forecast error growth
  sigma0TC: 0.4,
  kTCPerSqrtH: 0.35,
  sigma0WindMps: 1.0,
  kWindMpsPerSqrtH: 0.9,
  sigma0Cloud: 0.10,
  kCloudPerSqrtH: 0.08,

  // Mean-reversion time constants
  tauTForecastS: 6.0e4,
  tauWindForecastS: 7.2e3,
  tauCloudForecastS: 1.44e4,
  tauSnowForecastS: 1.2e4,

  // Snow forecast
  pSnowNextHourBase: 0.12,
  snowTempBoostC: -1.0,
  snowProbBoost: 0.10,

  // Solar/geography
  latDeg: 60.0,
  solarConstantWm2: 1361.0,
  clearSkyTransmittance: 0.72,
  kCloud: 0.75,
  pCloud: 1.3,
}

function clamp(x: number, min: number, max: number): number {
  return Math.min(Math.max(x, min), max)
}

function clamp01(x: number): number {
  return clamp(x, 0, 1)
}

export class ForecastModel {
  private arrays: ForecastArrays
  private lastComputeTimeS: number = -Infinity
  private readonly numPoints: number

  constructor() {
    this.numPoints = Math.floor(CONSTANTS.horizonS / CONSTANTS.resolutionS) + 1
    this.arrays = this.createEmptyArrays()
  }

  private createEmptyArrays(): ForecastArrays {
    const n = this.numPoints
    return {
      gridTimesS: new Array(n).fill(0),
      TMeanC: new Array(n).fill(0),
      windMps: new Array(n).fill(0),
      cloud01: new Array(n).fill(0),
      solarWm2: new Array(n).fill(0),
      snowMmph: new Array(n).fill(0),
      icing01: new Array(n).fill(0),
      sigmaTc: new Array(n).fill(0),
      sigmaWindMps: new Array(n).fill(0),
      sigmaCloud: new Array(n).fill(0),
    }
  }

  tick(clock: ClockInput, weather: WeatherInput): void {
    // Only recompute every resolutionS seconds
    if (clock.timeS - this.lastComputeTimeS < CONSTANTS.resolutionS) {
      return
    }
    this.lastComputeTimeS = clock.timeS
    this.recompute(clock, weather)
  }

  private recompute(clock: ClockInput, weather: WeatherInput): void {
    const C = CONSTANTS
    const t0 = clock.timeS
    const doy = clock.dayOfYear
    const tDayS0 = clock.localHour * 3600 + clock.localMinute * 60 + clock.localSecond

    for (let i = 0; i < this.numPoints; i++) {
      const hS = i * C.resolutionS
      const tDayS = (tDayS0 + hS) % 86400

      // Seasonal targets
      const TSeasonC = 2.0 - 10.0 * Math.cos(2 * Math.PI * (doy - 20.0) / 365)
      const VSeasonTargetMps = 7.0 + 2.0 * Math.cos(2 * Math.PI * (doy - 10.0) / 365)
      const cloudTarget = 0.75 + 0.10 * Math.cos(2 * Math.PI * (doy - 5.0) / 365)

      // Diurnal temperature
      const TDiurnalC = 2.0 * Math.sin(2 * Math.PI * (tDayS - (5.0 * 3600 + 86400 / 4)) / 86400)
      const TTargetC = TSeasonC + TDiurnalC

      // Mean forecasts (exponential approach from current state)
      const THatC = TTargetC + (weather.temperatureC - TTargetC) * Math.exp(-hS / C.tauTForecastS)
      const windHatMps = VSeasonTargetMps + (weather.windSpeed100mMps - VSeasonTargetMps) * Math.exp(-hS / C.tauWindForecastS)
      const cloudHat = clamp01(cloudTarget + (weather.cloudCover01 - cloudTarget) * Math.exp(-hS / C.tauCloudForecastS))

      // Solar geometry at forecast time
      const declDeg = 23.44 * Math.sin(2 * Math.PI * (284 + doy) / 365)
      const declRad = declDeg * Math.PI / 180
      const latRad = C.latDeg * Math.PI / 180
      const tHours = tDayS / 3600
      const HRad = (tHours - 12.0) * 15.0 * Math.PI / 180
      const sinElev = Math.sin(latRad) * Math.sin(declRad) + Math.cos(latRad) * Math.cos(declRad) * Math.cos(HRad)
      const sinElevPos = Math.max(0.0, sinElev)
      const ghiClearWm2 = C.solarConstantWm2 * C.clearSkyTransmittance * sinElevPos
      const cloudFactor = clamp01(1.0 - C.kCloud * Math.pow(cloudHat, C.pCloud))
      const solarHatWm2 = ghiClearWm2 * cloudFactor

      // Snow forecast
      let pSnowNextHour = C.pSnowNextHourBase
      if (THatC < C.snowTempBoostC) {
        pSnowNextHour += C.snowProbBoost
      }
      pSnowNextHour += 0.10 * (cloudHat - 0.7)
      pSnowNextHour = clamp01(pSnowNextHour)

      const snowHatMmph = clamp(
        pSnowNextHour * (0.6 * Math.exp(-hS / C.tauSnowForecastS) + 0.2) * 1.2,
        0.0,
        2.0
      )

      // Icing forecast
      let icingHat01 = 0
      if (snowHatMmph > 0.05) {
        if (THatC <= 1.0 && THatC >= -6.0) {
          icingHat01 = 1.0
        } else if (THatC < -6.0) {
          icingHat01 = 0.4
        }
      }

      // Uncertainty
      const hHours = hS / 3600
      const sigmaT = C.sigma0TC + C.kTCPerSqrtH * Math.sqrt(hHours)
      const sigmaWind = C.sigma0WindMps + C.kWindMpsPerSqrtH * Math.sqrt(hHours)
      const sigmaCloud = C.sigma0Cloud + C.kCloudPerSqrtH * Math.sqrt(hHours)

      // Store in arrays
      this.arrays.gridTimesS[i] = t0 + hS
      this.arrays.TMeanC[i] = THatC
      this.arrays.windMps[i] = clamp(windHatMps, 0.0, 35.0)
      this.arrays.cloud01[i] = cloudHat
      this.arrays.solarWm2[i] = solarHatWm2
      this.arrays.snowMmph[i] = snowHatMmph
      this.arrays.icing01[i] = clamp01(icingHat01)
      this.arrays.sigmaTc[i] = sigmaT
      this.arrays.sigmaWindMps[i] = sigmaWind
      this.arrays.sigmaCloud[i] = sigmaCloud
    }
  }

  getForecast(deltaS: number): ForecastOutput {
    const C = CONSTANTS
    const i0 = Math.floor(deltaS / C.resolutionS)
    const i1 = Math.min(i0 + 1, this.numPoints - 1)
    const w = (deltaS - i0 * C.resolutionS) / C.resolutionS

    return {
      temperatureC: this.interpolate(this.arrays.TMeanC, i0, i1, w),
      windSpeedMps: this.interpolate(this.arrays.windMps, i0, i1, w),
      cloudCover01: this.interpolate(this.arrays.cloud01, i0, i1, w),
      solarIrradianceWm2: this.interpolate(this.arrays.solarWm2, i0, i1, w),
      precipitationSnowMmph: this.interpolate(this.arrays.snowMmph, i0, i1, w),
      icingRisk01: this.interpolate(this.arrays.icing01, i0, i1, w),
      sigmaTc: this.interpolate(this.arrays.sigmaTc, i0, i1, w),
      sigmaWindMps: this.interpolate(this.arrays.sigmaWindMps, i0, i1, w),
      sigmaCloud: this.interpolate(this.arrays.sigmaCloud, i0, i1, w),
    }
  }

  private interpolate(arr: number[], i0: number, i1: number, w: number): number {
    if (i0 < 0 || i0 >= arr.length) return 0
    const v0 = arr[i0] ?? 0
    const v1 = arr[i1] ?? v0
    return (1 - w) * v0 + w * v1
  }

  getArrays(): ForecastArrays {
    return this.arrays
  }

  reset(): void {
    this.arrays = this.createEmptyArrays()
    this.lastComputeTimeS = -Infinity
  }
}
