export interface WeatherState {
  temperatureC: number
  frontOffsetC: number
  windSpeed100mMps: number
  cloudCover01: number
  isSnowing: boolean
  snowIntensityMmph: number
}

export interface WeatherOutput {
  temperatureC: number
  windSpeed100mMps: number
  windGustMps: number
  cloudCover01: number
  solarIrradianceWm2: number
  precipitationSnowMmph: number
  icingRisk01: number
}

interface ClockInput {
  timeS: number
  localHour: number
  localMinute: number
  localSecond: number
  dayOfYear: number
}

const CONSTANTS = {
  latDeg: 60.0,
  lonDeg: 15.0,
  dtS: 1.0,
  dayS: 86400.0,

  // Temperature
  TAnnualMeanC: 2.0,
  TSeasonAmpC: 10.0,
  TSeasonPhaseDoy: 20.0,
  TDiurnalAmpC: 2.0,
  TDiurnalMinHour: 5.0,
  tauTMeanS: 6.0e4,
  sigmaTCPerSqrtS: 0.010,
  tauFrontS: 2.0e5,
  sigmaFrontCPerSqrtS: 0.004,

  // Wind
  VSeasonMeanMps: 7.0,
  VSeasonAmpMps: 2.0,
  VSeasonPhaseDoy: 10.0,
  tauWindS: 7.2e3,
  sigmaWindMpsPerSqrtS: 0.050,
  gustBaseMps: 1.0,
  gustFactor: 0.35,
  sigmaGustMps: 0.7,

  // Cloud
  cloudSeasonMean: 0.75,
  cloudSeasonAmp: 0.10,
  cloudSeasonPhaseDoy: 5.0,
  tauCloudS: 1.44e4,
  sigmaCloudPerSqrtS: 0.0015,

  // Snow
  pStartSnowPerS: 2.0e-5,
  pStopSnowPerS: 2.0e-4,
  snowIntensityMinMmph: 0.1,
  snowIntensityMaxMmph: 2.0,
  tauSnowIntensityS: 1800.0,
  sigmaSnowIntensityMmphPerSqrtS: 0.02,

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

export class WeatherModel {
  state: WeatherState

  constructor(initialState?: Partial<WeatherState>) {
    this.state = {
      temperatureC: initialState?.temperatureC ?? -8.0,
      frontOffsetC: initialState?.frontOffsetC ?? 0.0,
      windSpeed100mMps: initialState?.windSpeed100mMps ?? 8.0,
      cloudCover01: initialState?.cloudCover01 ?? 0.8,
      isSnowing: initialState?.isSnowing ?? false,
      snowIntensityMmph: initialState?.snowIntensityMmph ?? 0.0,
    }
  }

  tick(clock: ClockInput): WeatherOutput {
    const C = CONSTANTS
    const dt = C.dtS
    const sqrtDt = Math.sqrt(dt)

    // Helper time scalars
    const tDayS = clock.localHour * 3600 + clock.localMinute * 60 + clock.localSecond
    const doy = clock.dayOfYear

    // Seasonal baselines
    const TSeasonC = C.TAnnualMeanC - C.TSeasonAmpC * Math.cos(2 * Math.PI * (doy - C.TSeasonPhaseDoy) / 365)
    const VSeasonTargetMps = C.VSeasonMeanMps + C.VSeasonAmpMps * Math.cos(2 * Math.PI * (doy - C.VSeasonPhaseDoy) / 365)
    const cloudTarget = C.cloudSeasonMean + C.cloudSeasonAmp * Math.cos(2 * Math.PI * (doy - C.cloudSeasonPhaseDoy) / 365)

    // Diurnal temperature swing
    const TDiurnalC = C.TDiurnalAmpC * Math.sin(2 * Math.PI * (tDayS - (C.TDiurnalMinHour * 3600 + C.dayS / 4)) / C.dayS)

    // Update front offset
    this.state.frontOffsetC += (0.0 - this.state.frontOffsetC) * (dt / C.tauFrontS)
      + C.sigmaFrontCPerSqrtS * sqrtDt * randomNormal()

    // Update temperature
    const TTargetC = TSeasonC + this.state.frontOffsetC + TDiurnalC
    this.state.temperatureC += (TTargetC - this.state.temperatureC) * (dt / C.tauTMeanS)
      + C.sigmaTCPerSqrtS * sqrtDt * randomNormal()

    // Update wind speed
    this.state.windSpeed100mMps = clamp(
      this.state.windSpeed100mMps
        + (VSeasonTargetMps - this.state.windSpeed100mMps) * (dt / C.tauWindS)
        + C.sigmaWindMpsPerSqrtS * sqrtDt * randomNormal(),
      0.0,
      35.0
    )

    // Update cloud cover
    this.state.cloudCover01 = clamp01(
      this.state.cloudCover01
        + (cloudTarget - this.state.cloudCover01) * (dt / C.tauCloudS)
        + C.sigmaCloudPerSqrtS * sqrtDt * randomNormal()
    )

    // Update snow (Markov on/off)
    if (!this.state.isSnowing) {
      this.state.isSnowing = Math.random() < C.pStartSnowPerS
    } else {
      this.state.isSnowing = !(Math.random() < C.pStopSnowPerS)
    }

    // Update snow intensity
    if (this.state.isSnowing) {
      this.state.snowIntensityMmph = clamp(
        this.state.snowIntensityMmph
          + (0.7 - this.state.snowIntensityMmph) * (dt / C.tauSnowIntensityS)
          + C.sigmaSnowIntensityMmphPerSqrtS * sqrtDt * randomNormal(),
        C.snowIntensityMinMmph,
        C.snowIntensityMaxMmph
      )
    } else {
      this.state.snowIntensityMmph = 0.0
    }

    // Solar geometry
    const declDeg = 23.44 * Math.sin(2 * Math.PI * (284 + doy) / 365)
    const declRad = declDeg * Math.PI / 180
    const latRad = C.latDeg * Math.PI / 180
    const tHours = tDayS / 3600
    const HRad = (tHours - 12.0) * 15.0 * Math.PI / 180
    const sinElev = Math.sin(latRad) * Math.sin(declRad) + Math.cos(latRad) * Math.cos(declRad) * Math.cos(HRad)
    const sinElevPos = Math.max(C.minSinElevation, sinElev)

    // Clear-sky GHI and cloud attenuation
    const ghiClearWm2 = C.solarConstantWm2 * C.clearSkyTransmittance * sinElevPos
    const cloudFactor = clamp01(1.0 - C.kCloud * Math.pow(this.state.cloudCover01, C.pCloud))
    const solarIrradianceWm2 = ghiClearWm2 * cloudFactor

    // Wind gust
    const windGustMps = clamp(
      this.state.windSpeed100mMps + C.gustBaseMps + C.gustFactor * this.state.windSpeed100mMps + C.sigmaGustMps * randomNormal(),
      this.state.windSpeed100mMps,
      45.0
    )

    // Icing risk
    let icingRisk01 = 0
    if (this.state.isSnowing) {
      if (this.state.temperatureC <= 1.0 && this.state.temperatureC >= -6.0) {
        icingRisk01 = 1.0
      } else if (this.state.temperatureC < -6.0) {
        icingRisk01 = 0.4
      }
    }

    return {
      temperatureC: this.state.temperatureC,
      windSpeed100mMps: this.state.windSpeed100mMps,
      windGustMps,
      cloudCover01: this.state.cloudCover01,
      solarIrradianceWm2,
      precipitationSnowMmph: this.state.snowIntensityMmph,
      icingRisk01: clamp01(icingRisk01),
    }
  }

  reset(initialState?: Partial<WeatherState>): void {
    this.state = {
      temperatureC: initialState?.temperatureC ?? -8.0,
      frontOffsetC: initialState?.frontOffsetC ?? 0.0,
      windSpeed100mMps: initialState?.windSpeed100mMps ?? 8.0,
      cloudCover01: initialState?.cloudCover01 ?? 0.8,
      isSnowing: initialState?.isSnowing ?? false,
      snowIntensityMmph: initialState?.snowIntensityMmph ?? 0.0,
    }
  }
}
