import { reactive } from 'vue'
import { gameState } from './GameState'

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
    earningsGoal: 600,
    forcedMarket: 'da',
  },
  3: {
    daEnabled: false,
    fcrEnabled: true,
    chargeDischargeEnabled: true,
    marketToggleEnabled: false,
    earningsGoal: 400,
    forcedMarket: 'fcr',
  },
  4: {
    daEnabled: true,
    fcrEnabled: true,
    chargeDischargeEnabled: true,
    marketToggleEnabled: true,
    earningsGoal: 1000,
    forcedMarket: null,
  },
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
    this.active = true
    this.currentDay = 1
    this.phase = 'bidding'
    this.shownMessages.clear()
    this.setupDay()
  }

  stop(): void {
    this.active = false
    this.currentMessage = null
    this.messageQueue = []
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
    gameState.generateMarketPrices(this.seed)
    gameState.clearBids()
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
      return sum + (hour.deliveredMWh * price)
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
