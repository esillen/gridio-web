import { reactive } from 'vue'
import { gameState } from '../game/GameState'
import type { BESSConfig } from '../system_model'

export type CampaignDay = 1 | 2 | 3 | 4 | 5 | 6

export interface CampaignDayConfig {
  earningsGoal: number
}

const DAY_CONFIGS: Record<CampaignDay, CampaignDayConfig> = {
  1: { earningsGoal: 0 },
  2: { earningsGoal: 0 },
  3: { earningsGoal: 0 },
  4: { earningsGoal: 0 },
  5: { earningsGoal: 0 },
  6: { earningsGoal: 0 },
}

const CAMPAIGN_REAL_DAY_BY_CAMPAIGN_DAY: Record<CampaignDay, string> = {
  1: '2026-01-12',
  2: '2026-01-13',
  3: '2026-01-14',
  4: '2026-01-15',
  5: '2026-01-16',
  6: '2026-01-17',
}

const CAMPAIGN_BATTERY_POOL: BESSConfig[] = [
  { id: 'campaign-bess-1', name: 'Campaign BESS 1', maxPowerMW: 10, capacityMWh: 20, roundTripEfficiency: 0.90, initialSoC01: 0.5 },
  { id: 'campaign-bess-2', name: 'Campaign BESS 2', maxPowerMW: 20, capacityMWh: 20, roundTripEfficiency: 0.90, initialSoC01: 0.5 },
  { id: 'campaign-bess-3', name: 'Campaign BESS 3', maxPowerMW: 5, capacityMWh: 20, roundTripEfficiency: 0.90, initialSoC01: 0.5 },
  { id: 'campaign-bess-4', name: 'Campaign BESS 4', maxPowerMW: 10, capacityMWh: 10, roundTripEfficiency: 0.90, initialSoC01: 0.5 },
]

function fleetSizeForDay(day: CampaignDay): number {
  if (day <= 2) return 1
  if (day === 3) return 2
  if (day === 4) return 3
  return 4
}

function campaignFleetForDay(day: CampaignDay): BESSConfig[] {
  const count = fleetSizeForDay(day)
  return CAMPAIGN_BATTERY_POOL.slice(0, count).map(c => ({ ...c }))
}

class CampaignController {
  active = false
  currentDay: CampaignDay = 1

  get config(): CampaignDayConfig {
    return DAY_CONFIGS[this.currentDay]
  }

  get seed(): number {
    return this.currentDay
  }

  start(): void {
    this.startAtDay(1)
  }

  startAtDay(day: CampaignDay): void {
    this.active = true
    this.currentDay = day
    this.setupDay()
  }

  restoreFromUrl(day: number): void {
    // Always re-apply fleet from URL state, even if day is unchanged.
    // This prevents stale/default fleets when mode switching has just reset BESS.
    if (this.active && this.currentDay === day) {
      this.applyDayData()
      this.applyDayFleet()
      return
    }

    const validDay = (day >= 1 && day <= 6 ? day : 1) as CampaignDay
    this.active = true
    this.currentDay = validDay
    this.applyDayData()
    this.applyDayFleet()
  }

  stop(): void {
    this.active = false
    gameState.resetToDefaultBESSFleet()
  }

  setupDay(): void {
    gameState.restart()
    this.applyDayData()
    this.applyDayFleet()
    gameState.clearBids()
  }

  private applyDayData(): void {
    gameState.config.useSimulation = false
    gameState.config.day = CAMPAIGN_REAL_DAY_BY_CAMPAIGN_DAY[this.currentDay]
  }

  nextDay(): boolean {
    if (this.currentDay >= 6) {
      this.stop()
      return false
    }

    this.currentDay = (this.currentDay + 1) as CampaignDay
    this.setupDay()
    return true
  }

  retryDay(): void {
    this.setupDay()
  }

  private applyDayFleet(): void {
    gameState.setBESSFleet(campaignFleetForDay(this.currentDay))
  }
}

export const campaignController = reactive(new CampaignController())
