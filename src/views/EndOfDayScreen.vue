<script setup lang="ts">
import { computed, ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { gameState } from '../game/GameState'
import { tutorialController } from '../tutorial'
import DABidChart from '../components/DABidChart.vue'
import FCRBidChart from '../components/FCRBidChart.vue'

const route = useRoute()
const router = useRouter()
const showImbalanceBreakdown = ref(false)
const showImbalanceHelp = ref(false)
const tutorialMessage = ref<string | null>(null)

// Tutorial state
const isTutorial = computed(() => tutorialController.active)
const tutorialDay = computed(() => tutorialController.currentDay)
const tutorialConfig = computed(() => tutorialController.config)
const goalMet = computed(() => isTutorial.value ? tutorialController.goalMet() : true)

const daPerformance = computed(() => gameState.bessPerformance.daPerformance)
const fcrPerformance = computed(() => gameState.bessPerformance.fcrPerformance)
const marketPrices = computed(() => gameState.marketPrices)

const imbalanceData = computed(() => gameState.imbalanceSettlement)

const revenueBreakdown = computed(() => {
  const daRevenue = daPerformance.value.reduce((sum, hour) => {
    const price = marketPrices.value.daEurPerMWh[hour.hour] ?? 0
    return sum + (hour.bidMWh * price)
  }, 0)

  const fcrRevenue = fcrPerformance.value.reduce((sum, hour) => {
    const price = marketPrices.value.fcrEurPerMWPerH[hour.hour] ?? 0
    return sum + (hour.allocatedMW * price)
  }, 0)

  const totalFailed = fcrPerformance.value.reduce((sum, hour) => sum + hour.failedMWh, 0)
  const fcrPenalty = totalFailed * 50

  const imbalanceCost = imbalanceData.value?.cumulativeNetCashEur ?? 0

  const totalRevenue = daRevenue + fcrRevenue - fcrPenalty + imbalanceCost

  return {
    daRevenue,
    fcrRevenue,
    fcrPenalty,
    totalFailed,
    imbalanceCost,
    totalRevenue
  }
})

const daStats = computed(() => {
  const totalBid = daPerformance.value.reduce((sum, h) => sum + h.bidMWh, 0)
  const totalDelivered = daPerformance.value.reduce((sum, h) => sum + h.deliveredMWh, 0)
  const fulfillmentRate = totalBid > 0 ? (totalDelivered / totalBid) * 100 : 0
  return { totalBid, totalDelivered, fulfillmentRate }
})

const fcrStats = computed(() => {
  const totalAllocated = fcrPerformance.value.reduce((sum, h) => sum + h.allocatedMW, 0)
  const totalRequired = fcrPerformance.value.reduce((sum, h) => sum + h.requiredMWh, 0)
  const totalDelivered = fcrPerformance.value.reduce((sum, h) => sum + h.deliveredMWh, 0)
  const reliability = totalRequired > 0 ? (totalDelivered / totalRequired) * 100 : 100
  return { totalAllocated, totalRequired, totalDelivered, reliability }
})

onMounted(() => {
  // Restore tutorial state from URL params if needed
  if (route.query.tutorial === '1' && route.query.day) {
    tutorialController.restoreFromUrl(parseInt(route.query.day as string))
  }
  
  // Show tutorial tips based on performance
  if (isTutorial.value) {
    showTutorialTips()
  }
})

function showTutorialTips() {
  const day = tutorialDay.value
  const earnings = revenueBreakdown.value.totalRevenue
  const goal = tutorialConfig.value.earningsGoal
  
  if (day === 2 && !goalMet.value) {
    if (earnings <= 0) {
      tutorialMessage.value = 'Tip: Never trade more than your batteries can store! Imbalance penalties are expensive. Also, batteries start at 50% SOC.'
    } else {
      tutorialMessage.value = 'Tip: Trading has a small fee. Plan to earn more than just €' + goal + ' to cover fees!'
    }
  } else if (day === 3 && earnings < 0) {
    tutorialMessage.value = 'Tip: Play it safe - bid small amounts spread through the day and charge manually when needed!'
  } else if (day === 4 && goalMet.value) {
    tutorialMessage.value = 'CONGRATULATIONS! You completed the tutorial! Now try the sandbox and see how much you can earn!'
  }
}

function restart() {
  gameState.restart()
  router.push('/game')
}

function handleContinue() {
  if (isTutorial.value) {
    if (goalMet.value || tutorialConfig.value.earningsGoal === 0) {
      // Advance to next day
      if (tutorialController.nextDay()) {
        // Navigate to game with updated day
        router.push(`/game?tutorial=1&day=${tutorialController.currentDay}`)
      } else {
        // Tutorial complete - exit to home
        tutorialController.stop()
        router.push('/')
      }
    } else {
      // Retry the day
      tutorialController.retryDay()
      router.push(`/game?tutorial=1&day=${tutorialController.currentDay}`)
    }
  } else {
    restart()
  }
}

function exitTutorial() {
  tutorialController.stop()
  router.push('/')
}

function formatEur(value: number): string {
  return value.toFixed(2)
}
</script>

<template>
  <div class="end-screen">
    <!-- Tutorial indicator -->
    <div v-if="isTutorial" class="tutorial-indicator">
      <span class="tutorial-day">Tutorial Day {{ tutorialDay }}/4</span>
    </div>

    <h1>{{ isTutorial ? 'Day ' + tutorialDay + ' Results' : 'End of Day Report' }}</h1>
    
    <div class="revenue-summary">
      <h2>Total Revenue</h2>
      <div class="total-revenue" :class="{ negative: revenueBreakdown.totalRevenue < 0 }">
        €{{ formatEur(revenueBreakdown.totalRevenue) }}
      </div>
      <!-- Tutorial goal status -->
      <div v-if="isTutorial && tutorialConfig.earningsGoal > 0" class="goal-status" :class="{ met: goalMet, failed: !goalMet }">
        Goal: €{{ tutorialConfig.earningsGoal }} - {{ goalMet ? 'ACHIEVED!' : 'Not met' }}
      </div>
    </div>

    <!-- Tutorial tips -->
    <div v-if="tutorialMessage" class="tutorial-tip">
      {{ tutorialMessage }}
    </div>

    <div class="charts-section">
      <div class="chart-box">
        <h3>Day-Ahead Market Performance</h3>
        <DABidChart :version="0" />
        <div class="chart-stats">
          <div class="stat-row">
            <span class="stat-label">Total Bid:</span>
            <span class="stat-value">{{ daStats.totalBid.toFixed(1) }} MWh</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Delivered:</span>
            <span class="stat-value">{{ daStats.totalDelivered.toFixed(1) }} MWh</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Fulfillment:</span>
            <span class="stat-value" :class="{ good: daStats.fulfillmentRate >= 95, warning: daStats.fulfillmentRate < 95 && daStats.fulfillmentRate >= 80, bad: daStats.fulfillmentRate < 80 }">
              {{ daStats.fulfillmentRate.toFixed(1) }}%
            </span>
          </div>
        </div>
      </div>

      <div class="chart-box">
        <h3>FCR-N Market Performance</h3>
        <FCRBidChart :version="0" />
        <div class="chart-stats">
          <div class="stat-row">
            <span class="stat-label">Required by Grid:</span>
            <span class="stat-value">{{ fcrStats.totalRequired.toFixed(1) }} MWh</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Delivered:</span>
            <span class="stat-value">{{ fcrStats.totalDelivered.toFixed(1) }} MWh</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Failed Delivery:</span>
            <span class="stat-value" :class="{ bad: revenueBreakdown.totalFailed > 0 }">{{ revenueBreakdown.totalFailed.toFixed(1) }} MWh</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Reliability:</span>
            <span class="stat-value" :class="{ good: fcrStats.reliability >= 95, warning: fcrStats.reliability < 95 && fcrStats.reliability >= 80, bad: fcrStats.reliability < 80 }">
              {{ fcrStats.reliability.toFixed(1) }}%
            </span>
          </div>
        </div>
      </div>
    </div>

    <div class="revenue-breakdown">
      <h2>Revenue Breakdown</h2>
      <div class="breakdown-item">
        <span class="breakdown-label">Day-Ahead Energy Sales</span>
        <span class="breakdown-value positive">€{{ formatEur(revenueBreakdown.daRevenue) }}</span>
      </div>
      <div class="breakdown-item">
        <span class="breakdown-label">FCR-N Capacity Revenue</span>
        <span class="breakdown-value positive">€{{ formatEur(revenueBreakdown.fcrRevenue) }}</span>
      </div>
      <div class="breakdown-item penalty">
        <span class="breakdown-label">FCR-N Delivery Penalties</span>
        <span class="breakdown-value negative">-€{{ formatEur(revenueBreakdown.fcrPenalty) }}</span>
      </div>
      <div class="breakdown-item expandable" :class="{ penalty: revenueBreakdown.imbalanceCost < 0, expanded: showImbalanceBreakdown }" @click="showImbalanceBreakdown = !showImbalanceBreakdown">
        <span class="breakdown-label">
          <span class="expand-icon">{{ showImbalanceBreakdown ? '▼' : '▶' }}</span>
          Imbalance Settlement
          <span v-if="imbalanceData" class="breakdown-detail">
            ({{ imbalanceData.cumulativeDeviationMWh.toFixed(1) }} MWh deviation)
          </span>
        </span>
        <span class="breakdown-value" :class="{ positive: revenueBreakdown.imbalanceCost >= 0, negative: revenueBreakdown.imbalanceCost < 0 }">
          {{ revenueBreakdown.imbalanceCost >= 0 ? '+' : '' }}€{{ formatEur(revenueBreakdown.imbalanceCost) }}
        </span>
      </div>
      <div v-if="showImbalanceBreakdown && imbalanceData" class="imbalance-breakdown">
        <div class="breakdown-header">
          <span>Fee Breakdown</span>
          <button class="help-btn" @click.stop="showImbalanceHelp = true">?</button>
        </div>
        <div class="sub-item">
          <span class="sub-label">DA Imbalance Cashflow</span>
          <span class="sub-value" :class="{ positive: imbalanceData.cumulativeDaImbalanceCashflowEur >= 0, negative: imbalanceData.cumulativeDaImbalanceCashflowEur < 0 }">
            {{ imbalanceData.cumulativeDaImbalanceCashflowEur >= 0 ? '+' : '' }}€{{ formatEur(imbalanceData.cumulativeDaImbalanceCashflowEur) }}
          </span>
        </div>
        <div class="sub-item" v-if="imbalanceData.cumulativeFcrPenaltyEur > 0">
          <span class="sub-label">FCR-N Shortfall Penalty</span>
          <span class="sub-value negative">-€{{ formatEur(imbalanceData.cumulativeFcrPenaltyEur) }}</span>
        </div>
        <div class="sub-item">
          <span class="sub-label">Volume Fee (€2/MWh)</span>
          <span class="sub-value negative">-€{{ formatEur(imbalanceData.cumulativeFeeVolumeEur) }}</span>
        </div>
        <div class="sub-item">
          <span class="sub-label">Imbalance Fee (€1.15/MWh)</span>
          <span class="sub-value negative">-€{{ formatEur(imbalanceData.cumulativeFeeImbalanceEur) }}</span>
        </div>
        <div class="sub-item">
          <span class="sub-label">Weekly Market Fee (€30/week)</span>
          <span class="sub-value negative">-€{{ formatEur(imbalanceData.cumulativeFeeWeeklyAllocEur) }}</span>
        </div>
      </div>

      <!-- Imbalance Help Modal -->
      <div v-if="showImbalanceHelp" class="modal-overlay" @click="showImbalanceHelp = false">
        <div class="modal-content" @click.stop>
          <div class="modal-header">
            <h3>Imbalance Settlement Fees</h3>
            <button class="modal-close" @click="showImbalanceHelp = false">×</button>
          </div>
          <div class="modal-body">
            <div class="help-item">
              <h4>DA Imbalance Cashflow</h4>
              <p>When your actual delivery differs from your Day-Ahead bid, you settle the difference at the imbalance price. If you over-deliver during high prices, you earn extra. If you under-deliver, you pay the difference.</p>
            </div>
            <div class="help-item">
              <h4>FCR-N Shortfall Penalty</h4>
              <p>If you fail to deliver the FCR-N response required by your bid when frequency deviates, you pay €50/MWh for the energy shortfall. This only appears if you had FCR-N delivery failures.</p>
            </div>
            <div class="help-item">
              <h4>Volume Fee (€2/MWh)</h4>
              <p>eSett charges €2 per MWh for all energy you trade through the imbalance settlement system. This covers the cost of running the Nordic imbalance settlement.</p>
            </div>
            <div class="help-item">
              <h4>Imbalance Fee (€1.15/MWh)</h4>
              <p>An additional fee of €1.15 per MWh of imbalance (deviation from schedule). This incentivizes accurate forecasting and schedule adherence.</p>
            </div>
            <div class="help-item">
              <h4>Weekly Market Fee (€30/week)</h4>
              <p>A fixed market participation fee of €30 per week, charged regardless of trading activity. This is prorated daily (~€4.29/day) in the game.</p>
            </div>
          </div>
        </div>
      </div>
      <div class="breakdown-total">
        <span class="breakdown-label">Net Revenue</span>
        <span class="breakdown-value" :class="{ positive: revenueBreakdown.totalRevenue >= 0, negative: revenueBreakdown.totalRevenue < 0 }">
          €{{ formatEur(revenueBreakdown.totalRevenue) }}
        </span>
      </div>
    </div>

    <div class="action-buttons">
      <button class="restart-btn primary" @click="handleContinue">
        <template v-if="isTutorial">
          <template v-if="goalMet || tutorialConfig.earningsGoal === 0">
            {{ tutorialDay === 4 ? 'Finish Tutorial' : 'Continue to Day ' + (tutorialDay + 1) }}
          </template>
          <template v-else>Retry Day {{ tutorialDay }}</template>
        </template>
        <template v-else>Start New Day</template>
      </button>
      <button v-if="isTutorial" class="restart-btn secondary" @click="exitTutorial">
        Exit Tutorial
      </button>
    </div>
  </div>
</template>

<style scoped>
.end-screen {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}

h1 {
  color: var(--gridio-sky-vivid);
  margin-bottom: 2rem;
  font-size: 2rem;
  font-weight: 600;
  text-align: center;
}

h2 {
  color: var(--color-gray-800);
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 1rem;
}

h3 {
  color: var(--color-gray-700);
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 0.75rem;
}

.revenue-summary {
  background: linear-gradient(135deg, var(--gridio-sky-vivid) 0%, #5577ff 100%);
  border-radius: 16px;
  padding: 2rem;
  margin-bottom: 2rem;
  text-align: center;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.revenue-summary h2 {
  color: white;
  margin-bottom: 0.5rem;
  font-size: 1rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  opacity: 0.9;
}

.total-revenue {
  font-size: 3rem;
  font-weight: 700;
  color: white;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.total-revenue.negative {
  color: #fca5a5;
}

.charts-section {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.chart-box {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
}

.chart-box > :first-child {
  flex-shrink: 0;
}

.chart-box > :nth-child(2) {
  height: 200px;
  flex-shrink: 0;
}

.chart-stats {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--color-gray-200);
}

.stat-row {
  display: flex;
  justify-content: space-between;
  padding: 0.5rem 0;
}

.stat-label {
  color: var(--color-gray-600);
  font-size: 0.875rem;
}

.stat-value {
  font-weight: 600;
  color: var(--color-gray-900);
  font-size: 0.875rem;
}

.stat-value.good {
  color: #10b981;
}

.stat-value.warning {
  color: #f59e0b;
}

.stat-value.bad {
  color: #ef4444;
}

.revenue-breakdown {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  margin-bottom: 2rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.breakdown-item {
  display: flex;
  justify-content: space-between;
  padding: 0.75rem 0;
  border-bottom: 1px solid var(--color-gray-100);
}

.breakdown-item.penalty {
  background: #fef2f2;
  padding: 0.75rem 1rem;
  margin: 0 -1rem;
  border-bottom: 1px solid #fecaca;
}

.breakdown-total {
  display: flex;
  justify-content: space-between;
  padding: 1rem 0 0;
  margin-top: 0.5rem;
  border-top: 2px solid var(--color-gray-300);
  font-size: 1.125rem;
}

.breakdown-label {
  color: var(--color-gray-700);
  font-weight: 500;
}

.breakdown-detail {
  font-size: 0.8rem;
  color: var(--color-gray-500);
  font-weight: 400;
}

.breakdown-value {
  font-weight: 700;
  font-size: 1.125rem;
}

.breakdown-value.positive {
  color: #10b981;
}

.breakdown-value.negative {
  color: #ef4444;
}

.breakdown-total .breakdown-label {
  font-weight: 700;
  color: var(--color-gray-900);
}

.breakdown-item.expandable {
  cursor: pointer;
  user-select: none;
  transition: background-color 0.15s;
}

.breakdown-item.expandable:hover {
  background-color: rgba(0, 0, 0, 0.02);
}

.breakdown-item.expandable.penalty:hover {
  background-color: #fce8e8;
}

.expand-icon {
  display: inline-block;
  width: 1em;
  font-size: 0.7em;
  margin-right: 0.25rem;
  color: var(--color-gray-500);
}

.imbalance-breakdown {
  background: var(--color-gray-50);
  margin: 0 -1rem;
  padding: 0.5rem 1rem 0.75rem 2.5rem;
  border-bottom: 1px solid var(--color-gray-200);
}

.breakdown-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-gray-500);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 0.25rem;
}

.help-btn {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  border: 1px solid var(--color-gray-400);
  background: white;
  color: var(--color-gray-500);
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  transition: all 0.15s;
}

.help-btn:hover {
  background: var(--gridio-sky-vivid);
  border-color: var(--gridio-sky-vivid);
  color: white;
}

.sub-item {
  display: flex;
  justify-content: space-between;
  padding: 0.4rem 0;
  font-size: 0.875rem;
}

.sub-label {
  color: var(--color-gray-600);
}

.sub-value {
  font-weight: 600;
}

.sub-value.positive {
  color: #10b981;
}

.sub-value.negative {
  color: #ef4444;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  border-radius: 12px;
  max-width: 500px;
  width: 90%;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--color-gray-200);
}

.modal-header h3 {
  margin: 0;
  font-size: 1.125rem;
  color: var(--color-gray-900);
}

.modal-close {
  background: none;
  border: none;
  font-size: 1.5rem;
  color: var(--color-gray-500);
  cursor: pointer;
  padding: 0;
  line-height: 1;
}

.modal-close:hover {
  color: var(--color-gray-900);
}

.modal-body {
  padding: 1rem 1.25rem;
}

.help-item {
  margin-bottom: 1rem;
}

.help-item:last-child {
  margin-bottom: 0;
}

.help-item h4 {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-gray-800);
  margin: 0 0 0.25rem 0;
}

.help-item p {
  font-size: 0.8125rem;
  color: var(--color-gray-600);
  margin: 0;
  line-height: 1.5;
}

.action-buttons {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  align-items: center;
  margin-top: 1rem;
}

.restart-btn {
  display: block;
  background: var(--gridio-sky-vivid);
  color: white;
  border: none;
  padding: 1rem 2rem;
  font-size: 1.125rem;
  border-radius: 24px;
  font-weight: 600;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  transition: all 0.2s;
  cursor: pointer;
}

.restart-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.restart-btn.primary:hover {
  background: #3355e0;
}

.restart-btn.secondary {
  background: var(--color-gray-100);
  color: var(--color-gray-600);
  box-shadow: none;
}

.restart-btn.secondary:hover {
  background: var(--color-gray-200);
}

/* Tutorial styles */
.tutorial-indicator {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 1rem;
  padding: 0.5rem 1rem;
  background: white;
  border-radius: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  margin-bottom: 1rem;
  width: fit-content;
  margin-left: auto;
  margin-right: auto;
}

.tutorial-day {
  font-weight: 600;
  color: var(--gridio-sky-vivid);
}

.goal-status {
  margin-top: 1rem;
  padding: 0.5rem 1.5rem;
  border-radius: 20px;
  font-weight: 600;
  font-size: 1rem;
}

.goal-status.met {
  background: #D1FAE5;
  color: #047857;
}

.goal-status.failed {
  background: #FEE2E2;
  color: #B91C1C;
}

.tutorial-tip {
  background: #FEF3C7;
  border: 1px solid #F59E0B;
  color: #92400E;
  padding: 1rem 1.5rem;
  border-radius: 12px;
  margin: 1rem 0;
  text-align: center;
  line-height: 1.5;
}
</style>
