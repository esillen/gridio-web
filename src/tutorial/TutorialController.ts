import { reactive } from 'vue'
import { gameState } from '../game/GameState'
import type { BESSConfig } from '../system_model'

export type TutorialDay = 1 | 2 | 3 | 4
export type TutorialPhase = 'bidding' | 'day' | 'end'

export interface TutorialMessage {
  id: string
  text: string
  waitFor?: 'space' | 'tab_to_da' | 'tab_to_fcr' | 'game_time'
  waitValue?: number
  highlight?: string
}

export interface DayConfig {
  daEnabled: boolean
  fcrEnabled: boolean
  chargeDischargeEnabled: boolean
  marketToggleEnabled: boolean
  earningsGoal: number
  forcedMarket: 'da' | 'fcr' | 'auto' | null
}

const DAY_CONFIGS: Record<TutorialDay, DayConfig> = {
  1: {
    daEnabled: true,
    fcrEnabled: false,
    chargeDischargeEnabled: false,
    marketToggleEnabled: false,
    earningsGoal: 0,
    forcedMarket: 'da',
  },
  2: {
    daEnabled: true,
    fcrEnabled: false,
    chargeDischargeEnabled: false,
    marketToggleEnabled: false,
    earningsGoal: 5,
    forcedMarket: 'da',
  },
  3: {
    daEnabled: false,
    fcrEnabled: true,
    chargeDischargeEnabled: true,
    marketToggleEnabled: false,
    earningsGoal: 5,
    forcedMarket: 'fcr',
  },
  4: {
    daEnabled: true,
    fcrEnabled: true,
    chargeDischargeEnabled: true,
    marketToggleEnabled: true,
    earningsGoal: 10,
    forcedMarket: null,
  },
}

const TUTORIAL_REAL_DAY_BY_TUTORIAL_DAY: Record<TutorialDay, string> = {
  1: '2026-01-08',
  2: '2026-01-09',
  3: '2026-01-10',
  4: '2026-01-11',
}

const TUTORIAL_BASE_BATTERY: BESSConfig = {
  id: 'tutorial-bess-1',
  name: 'Tutorial BESS 1',
  maxPowerMW: 10, // 10 MW
  capacityMWh: 10, // 10 MWh
  roundTripEfficiency: 0.90,
  initialSoC01: 0.5,
}

function tutorialFleetForDay(day: TutorialDay): BESSConfig[] {
  if (day === 4) {
    return [
      { ...TUTORIAL_BASE_BATTERY, id: 'tutorial-bess-1', name: 'Tutorial BESS 1' },
      { ...TUTORIAL_BASE_BATTERY, id: 'tutorial-bess-2', name: 'Tutorial BESS 2' },
    ]
  }
  return [{ ...TUTORIAL_BASE_BATTERY, id: 'tutorial-bess-1', name: 'Tutorial BESS 1' }]
}

class TutorialController {
  active = false
  currentDay: TutorialDay = 1
  phase: TutorialPhase = 'bidding'
  
  // Message system
  messageQueue: TutorialMessage[] = []
  currentMessage: TutorialMessage | null = null
  
  // Condition tracking
  waitingForTabToDa = false
  waitingForTabToFcr = false
  waitingForGameTime: number | null = null
  
  // Track shown messages to avoid repeats
  shownMessages: Set<string> = new Set()

  get config(): DayConfig {
    return DAY_CONFIGS[this.currentDay]
  }

  get seed(): number {
    return this.currentDay
  }

  start(): void {
    this.startAtDay(1)
  }

  startAtDay(day: TutorialDay): void {
    this.active = true
    this.currentDay = day
    this.phase = 'bidding'
    this.shownMessages.clear()
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
    
    const validDay = (day >= 1 && day <= 4 ? day : 1) as TutorialDay
    this.active = true
    this.currentDay = validDay
    this.applyDayData()
    this.applyDayFleet()
    // Don't call setupDay() - just restore the active state
    // The game state should already be in progress
  }

  getUrlParams(): string {
    if (!this.active) return ''
    return `tutorial=1&day=${this.currentDay}`
  }

  stop(): void {
    this.active = false
    this.currentMessage = null
    this.messageQueue = []
    gameState.resetToDefaultBESSFleet()
  }

  setupDay(): void {
    this.phase = 'bidding'
    this.currentMessage = null
    this.messageQueue = []
    this.waitingForTabToDa = false
    this.waitingForTabToFcr = false
    this.waitingForGameTime = null
    
    // Reset game state
    gameState.restart()
    this.applyDayData()
    this.applyDayFleet()
    gameState.clearBids()
  }

  private applyDayData(): void {
    gameState.config.useSimulation = false
    gameState.config.day = TUTORIAL_REAL_DAY_BY_TUTORIAL_DAY[this.currentDay]
  }

  private applyDayFleet(): void {
    gameState.setBESSFleet(tutorialFleetForDay(this.currentDay))
  }

  queueMessages(messages: TutorialMessage[]): void {
    // Filter out already shown messages
    const newMessages = messages.filter(m => !this.shownMessages.has(m.id))
    this.messageQueue.push(...newMessages)
    if (!this.currentMessage && this.messageQueue.length > 0) {
      this.showNextMessage()
    }
  }

  showNextMessage(): void {
    if (this.messageQueue.length === 0) {
      this.currentMessage = null
      return
    }
    
    this.currentMessage = this.messageQueue.shift()!
    this.shownMessages.add(this.currentMessage.id)
    
    // Set up wait conditions
    if (this.currentMessage.waitFor === 'tab_to_da') {
      this.waitingForTabToDa = true
    } else if (this.currentMessage.waitFor === 'tab_to_fcr') {
      this.waitingForTabToFcr = true
    } else if (this.currentMessage.waitFor === 'game_time' && this.currentMessage.waitValue) {
      this.waitingForGameTime = this.currentMessage.waitValue
    }
  }

  advanceMessage(): boolean {
    if (!this.currentMessage) return true
    
    const msg = this.currentMessage
    
    // Check if waiting for condition
    if (msg.waitFor === 'tab_to_da' && this.waitingForTabToDa) return false
    if (msg.waitFor === 'tab_to_fcr' && this.waitingForTabToFcr) return false
    if (msg.waitFor === 'game_time' && this.waitingForGameTime !== null) return false
    
    this.showNextMessage()
    return true
  }

  onChartChanged(chart: string): void {
    if (this.waitingForTabToDa && chart === 'da') {
      this.waitingForTabToDa = false
      if (this.currentMessage?.waitFor === 'tab_to_da') {
        this.showNextMessage()
      }
    }
    
    if (this.waitingForTabToFcr && chart === 'fcr') {
      this.waitingForTabToFcr = false
      if (this.currentMessage?.waitFor === 'tab_to_fcr') {
        this.showNextMessage()
      }
    }
  }

  checkGameTime(gameTimeS: number): void {
    if (this.waitingForGameTime !== null && gameTimeS >= this.waitingForGameTime) {
      this.waitingForGameTime = null
      if (this.currentMessage?.waitFor === 'game_time') {
        this.showNextMessage()
      }
    }
  }

  hasBids(): boolean {
    if (this.config.daEnabled) {
      const hasDaBid = gameState.playerBids.daBids.some(b => b.volumeMW !== 0)
      if (hasDaBid) return true
    }
    if (this.config.fcrEnabled) {
      const hasFcrBid = gameState.playerBids.fcrBids.some(b => b.volumeMW > 0)
      if (hasFcrBid) return true
    }
    return false
  }

  calculateEarnings(): number {
    const daRevenue = gameState.bessPerformance.daPerformance.reduce((sum, hour) => {
      const price = gameState.marketPrices.daEurPerMWh[hour.hour] ?? 0
      return sum + (hour.bidMWh * price)
    }, 0)

    const fcrRevenue = gameState.bessPerformance.fcrPerformance.reduce((sum, hour) => {
      const price = gameState.marketPrices.fcrEurPerMWPerH[hour.hour] ?? 0
      return sum + (hour.allocatedMW * price)
    }, 0)

    const totalFailed = gameState.bessPerformance.fcrPerformance.reduce((sum, hour) => sum + hour.failedMWh, 0)
    const fcrPenalty = totalFailed * 50

    const imbalanceCost = gameState.imbalanceSettlement?.cumulativeNetCashEur ?? 0

    return daRevenue + fcrRevenue - fcrPenalty + imbalanceCost
  }

  goalMet(): boolean {
    return this.calculateEarnings() >= this.config.earningsGoal
  }

  nextDay(): boolean {
    if (this.currentDay >= 4) {
      this.stop()
      return false
    }
    
    this.currentDay = (this.currentDay + 1) as TutorialDay
    this.setupDay()
    return true
  }

  retryDay(): void {
    this.setupDay()
  }

  forceBatteryMarkets(): void {
    if (this.config.forcedMarket) {
      for (const unit of gameState.bessStates) {
        gameState.setUnitMarket(unit.id, this.config.forcedMarket)
      }
    }
  }
}

export const tutorialController = reactive(new TutorialController())
