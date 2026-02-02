export type BiddingZone = 'SE1' | 'SE2' | 'SE3' | 'SE4' | 'SYS'

export interface MarketPricesInput {
  unixS: number
  localMonth: number
  localHour: number
  localMinute: number
  localSecond: number
  biddingZone: BiddingZone
  stressLevel: 0 | 1 | 2
  seed: number
  forecast24h: {
    demandMW: number[]
    windMW: number[]
    solarMW: number[]
    hydroRoRMW: number[]
    bioWasteChpMW: number[]
    industrialChpMW: number[]
    nuclearMW: number[]
  }
  capabilities: {
    hydroReservoir: { maxMW: number; minMW: number; energyMWh: number; energyMaxMWh: number }
    peakers: { maxMW: number }
    interconnectors: { importMaxMW: number; exportMaxMW: number }
  }
}

export interface MarketPricesOutput {
  nextDeliveryHourUnixS: number
  nextDeliveryHourLocal: number
  daPriceEurPerMWh: number[]
  fcrPriceEurPerMWPerH: number[]
  imbPriceUpEurPerMWh: number[]
  imbPriceDownEurPerMWh: number[]
}

const CONSTANTS = {
  daPriceMin: -500,
  daPriceMax: 4000,
  imbPriceMin: -1000,
  imbPriceMax: 6000,
  nordicAvgPrice: 36.06,
  seasonMultByMonth: [1.35, 1.30, 1.10, 0.95, 0.85, 0.75, 0.70, 0.75, 0.90, 1.05, 1.20, 1.35],
  diurnalMultByHour: [0.85, 0.82, 0.80, 0.80, 0.83, 0.90, 1.05, 1.18, 1.12, 1.05, 1.00, 0.98, 0.97, 0.98, 1.02, 1.08, 1.18, 1.25, 1.15, 1.05, 0.98, 0.92, 0.88, 0.86],
  zonePremium: { SE1: -2, SE2: -1, SE3: 2, SE4: 6, SYS: 0 } as Record<BiddingZone, number>,
  lowPrice: 10,
  peakerMarginalCost: 180,
  voll: 3000,
  scarcityAlpha: 3.0,
  fcrBasePrice: 24,
  fcrSeasonMultByMonth: [1.20, 1.15, 1.05, 0.95, 0.90, 0.85, 0.85, 0.90, 0.95, 1.00, 1.10, 1.20],
  fcrVolatilitySensitivity: 0.35,
  fcrScarcitySensitivity: 0.60,
  fcrPriceMin: 1,
  fcrPriceMax: 250,
  imbBaseSpread: 12,
  imbSpreadScarcityCoeff: 90,
  imbSpreadVolCoeff: 0.020,
  imbStressMult: [0.8, 1.0, 1.35],
}

function clamp(x: number, min: number, max: number): number {
  return Math.min(Math.max(x, min), max)
}

function clamp01(x: number): number {
  return clamp(x, 0, 1)
}

function lerp(a: number, b: number, u: number): number {
  return a + (b - a) * clamp01(u)
}

function prnUnit(seed: number, k: number): number {
  let x = (seed ^ (k * 2654435761)) >>> 0
  x = ((1664525 * x + 1013904223) >>> 0)
  const u = x / 4294967296
  return 2 * u - 1
}

function windVariabilityMW(wind24: number[]): number {
  let s = 0
  for (let h = 1; h < 24; h++) {
    s += Math.abs((wind24[h] ?? 0) - (wind24[h - 1] ?? 0))
  }
  return s / 23
}

function scarcityIndex(residualMW: number, flexMW: number, peakerCapMW: number): number {
  const needPeaker = Math.max(0, residualMW - flexMW)
  return clamp01(needPeaker / Math.max(1, peakerCapMW))
}

function scarcityPremiumU(scarcity01: number, alpha: number): number {
  return 1 - Math.exp(-alpha * clamp01(scarcity01))
}

export class MarketPricesModel {
  private _lastAnchorUnixS = -1
  private _output: MarketPricesOutput = {
    nextDeliveryHourUnixS: 0,
    nextDeliveryHourLocal: 0,
    daPriceEurPerMWh: new Array(24).fill(0),
    fcrPriceEurPerMWPerH: new Array(24).fill(0),
    imbPriceUpEurPerMWh: new Array(96).fill(0),
    imbPriceDownEurPerMWh: new Array(96).fill(0),
  }

  tick(input: MarketPricesInput): MarketPricesOutput {
    const tInHourS = input.localMinute * 60 + input.localSecond
    const secsToNextHour = tInHourS === 0 ? 0 : 3600 - tInHourS
    const anchorUnixS = input.unixS + secsToNextHour
    const anchorLocalHour = (input.localHour + (tInHourS === 0 ? 0 : 1)) % 24

    if (this._lastAnchorUnixS === anchorUnixS) {
      return this._output
    }

    this._lastAnchorUnixS = anchorUnixS
    this._output.nextDeliveryHourUnixS = anchorUnixS
    this._output.nextDeliveryHourLocal = anchorLocalHour

    const month = input.localMonth
    const seasonMult = CONSTANTS.seasonMultByMonth[month - 1] ?? 1
    const fcrSeasonMult = CONSTANTS.fcrSeasonMultByMonth[month - 1] ?? 1
    const stressMult = CONSTANTS.imbStressMult[input.stressLevel] ?? 1
    const zonePremium = CONSTANTS.zonePremium[input.biddingZone] ?? 0
    const windVarMW = windVariabilityMW(input.forecast24h.windMW)

    const resEFrac = clamp01(
      input.capabilities.hydroReservoir.energyMWh /
        Math.max(1, input.capabilities.hydroReservoir.energyMaxMWh)
    )
    const reservoirTight01 = clamp01(1 - resEFrac)

    const hydroFlexMW = Math.max(
      0,
      input.capabilities.hydroReservoir.maxMW - input.capabilities.hydroReservoir.minMW
    )
    const importFlexMW = Math.max(0, input.capabilities.interconnectors.importMaxMW)
    const flexHoldbackFrac = clamp(0.1 + 0.05 * input.stressLevel, 0.1, 0.25)
    const flexMW = (hydroFlexMW + importFlexMW) * (1 - flexHoldbackFrac)

    // DA prices
    for (let h = 0; h < 24; h++) {
      const demandH = input.forecast24h.demandMW[h] ?? 0
      const windH = input.forecast24h.windMW[h] ?? 0
      const solarH = input.forecast24h.solarMW[h] ?? 0
      const rorH = input.forecast24h.hydroRoRMW[h] ?? 0
      const chpBioH = input.forecast24h.bioWasteChpMW[h] ?? 0
      const chpIndH = input.forecast24h.industrialChpMW[h] ?? 0
      const nuclearH = input.forecast24h.nuclearMW[h] ?? 0

      const mustTakeH = windH + solarH + rorH + chpBioH + chpIndH + nuclearH
      const residualH = demandH - mustTakeH
      const surplusH = Math.max(0, -residualH)

      const exportCap = Math.max(1, input.capabilities.interconnectors.exportMaxMW)
      const congestion01H = clamp01(surplusH / exportCap)
      const scarcity01H = residualH <= 0 ? 0 : scarcityIndex(residualH, flexMW, Math.max(1, input.capabilities.peakers.maxMW))
      const scarcityUH = scarcityPremiumU(scarcity01H, CONSTANTS.scarcityAlpha)

      const deliveryHourLocal = (anchorLocalHour + h) % 24
      const diurnalMult = CONSTANTS.diurnalMultByHour[deliveryHourLocal] ?? 1
      const baseLevelH = CONSTANTS.nordicAvgPrice * seasonMult * diurnalMult

      const scarcityPriceH = lerp(CONSTANTS.lowPrice, CONSTANTS.peakerMarginalCost, scarcityUH)
      const extremeSpikeH =
        input.stressLevel === 2
          ? scarcityUH * scarcityUH * 0.15 * (CONSTANTS.voll - CONSTANTS.peakerMarginalCost)
          : 0

      const surplusRatioH = demandH > 1 ? clamp01(surplusH / demandH) : 0
      const surplusDiscountH = 220 * surplusRatioH
      const surplusFloorH = -60 * clamp01(2 * surplusRatioH)

      const congestionPremiumH = residualH > 0 ? congestion01H * 18 : -congestion01H * 25
      const reservoirPremiumH = reservoirTight01 * (15 + 10 * input.stressLevel)

      const noiseAmpH = 2.5 + 0.002 * windVarMW + 3 * input.stressLevel
      const noiseH = noiseAmpH * prnUnit(input.seed, 1000 + h)

      let daHRaw: number
      if (residualH <= 0) {
        daHRaw =
          baseLevelH +
          zonePremium +
          congestionPremiumH +
          reservoirPremiumH -
          surplusDiscountH +
          noiseH
      } else {
        daHRaw =
          baseLevelH +
          zonePremium +
          congestionPremiumH +
          reservoirPremiumH +
          (scarcityPriceH - CONSTANTS.lowPrice) +
          extremeSpikeH +
          noiseH
      }

      daHRaw = Math.max(daHRaw, surplusFloorH)
      this._output.daPriceEurPerMWh[h] = clamp(daHRaw, CONSTANTS.daPriceMin, CONSTANTS.daPriceMax)
    }

    // FCR prices
    for (let h = 0; h < 24; h++) {
      const demandH = input.forecast24h.demandMW[h] ?? 0
      const windH = input.forecast24h.windMW[h] ?? 0
      const solarH = input.forecast24h.solarMW[h] ?? 0
      const rorH = input.forecast24h.hydroRoRMW[h] ?? 0
      const chpBioH = input.forecast24h.bioWasteChpMW[h] ?? 0
      const chpIndH = input.forecast24h.industrialChpMW[h] ?? 0
      const nuclearH = input.forecast24h.nuclearMW[h] ?? 0

      const mustTakeH = windH + solarH + rorH + chpBioH + chpIndH + nuclearH
      const residualH = demandH - mustTakeH
      const scarcity01H = residualH <= 0 ? 0 : scarcityIndex(residualH, flexMW, Math.max(1, input.capabilities.peakers.maxMW))

      const deliveryHourLocal = (anchorLocalHour + h) % 24
      const rampPeriod01 = [6, 7, 8, 15, 16, 17, 18].includes(deliveryHourLocal) ? 1 : 0.4
      const volatilityU = clamp01((windVarMW / 2000) * rampPeriod01)

      const fcrNoise = (4 + 6 * input.stressLevel) * prnUnit(input.seed, 2000 + h)
      let fcrRaw =
        CONSTANTS.fcrBasePrice *
        fcrSeasonMult *
        (1 + CONSTANTS.fcrVolatilitySensitivity * volatilityU) *
        (1 + CONSTANTS.fcrScarcitySensitivity * scarcity01H) *
        (1 + 0.25 * reservoirTight01) +
        fcrNoise

      const spikeU = Math.max(0, prnUnit(input.seed, 9000 + h))
      const spikeMult =
        input.stressLevel === 2
          ? 1 + 2 * Math.pow(spikeU, 4)
          : 1 + 0.8 * Math.pow(spikeU, 5)
      fcrRaw *= spikeMult

      this._output.fcrPriceEurPerMWPerH[h] = clamp(fcrRaw, CONSTANTS.fcrPriceMin, CONSTANTS.fcrPriceMax)
    }

    // Imbalance prices (96 MTUs)
    for (let k = 0; k < 96; k++) {
      const h = Math.floor(k / 4)
      const daRef = this._output.daPriceEurPerMWh[h] ?? 0

      const qNoise = (3 + 5 * input.stressLevel) * prnUnit(input.seed, 30000 + k)

      const demandH = input.forecast24h.demandMW[h] ?? 0
      const windH = input.forecast24h.windMW[h] ?? 0
      const solarH = input.forecast24h.solarMW[h] ?? 0
      const rorH = input.forecast24h.hydroRoRMW[h] ?? 0
      const chpBioH = input.forecast24h.bioWasteChpMW[h] ?? 0
      const chpIndH = input.forecast24h.industrialChpMW[h] ?? 0
      const nuclearH = input.forecast24h.nuclearMW[h] ?? 0

      const mustTakeH = windH + solarH + rorH + chpBioH + chpIndH + nuclearH
      const residualH = demandH - mustTakeH
      const scarcity01H = residualH <= 0 ? 0 : scarcityIndex(residualH, flexMW, Math.max(1, input.capabilities.peakers.maxMW))

      const spread =
        stressMult *
        (CONSTANTS.imbBaseSpread +
          CONSTANTS.imbSpreadScarcityCoeff * scarcity01H +
          CONSTANTS.imbSpreadVolCoeff * windVarMW)

      const surplusBias = residualH < 0 ? 0.6 : 0
      const spreadDown = spread * (1 + surplusBias)
      const spreadUp = spread

      const upRaw = daRef + spreadUp + qNoise
      const downRaw = daRef - spreadDown + qNoise

      this._output.imbPriceUpEurPerMWh[k] = clamp(upRaw, CONSTANTS.imbPriceMin, CONSTANTS.imbPriceMax)
      this._output.imbPriceDownEurPerMWh[k] = clamp(downRaw, CONSTANTS.imbPriceMin, CONSTANTS.imbPriceMax)
    }

    return this._output
  }

  get output(): MarketPricesOutput {
    return this._output
  }

  reset(): void {
    this._lastAnchorUnixS = -1
    this._output = {
      nextDeliveryHourUnixS: 0,
      nextDeliveryHourLocal: 0,
      daPriceEurPerMWh: new Array(24).fill(0),
      fcrPriceEurPerMWPerH: new Array(24).fill(0),
      imbPriceUpEurPerMWh: new Array(96).fill(0),
      imbPriceDownEurPerMWh: new Array(96).fill(0),
    }
  }
}
