<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { gameState } from '../game/GameState'
import DABidChart from '../components/DABidChart.vue'
import FCRBidChart from '../components/FCRBidChart.vue'

const router = useRouter()

const daPerformance = computed(() => gameState.bessPerformance.daPerformance)
const fcrPerformance = computed(() => gameState.bessPerformance.fcrPerformance)
const marketPrices = computed(() => gameState.marketPrices)

const revenueBreakdown = computed(() => {
  const daRevenue = daPerformance.value.reduce((sum, hour) => {
    const price = marketPrices.value.daEurPerMWh[hour.hour] ?? 0
    return sum + (hour.deliveredMWh * price)
  }, 0)

  const fcrRevenue = fcrPerformance.value.reduce((sum, hour) => {
    const price = marketPrices.value.fcrEurPerMWPerH[hour.hour] ?? 0
    return sum + (hour.allocatedMW * price)
  }, 0)

  const totalFailed = fcrPerformance.value.reduce((sum, hour) => sum + hour.failedMWh, 0)
  const fcrPenalty = totalFailed * 50

  const totalRevenue = daRevenue + fcrRevenue - fcrPenalty

  return {
    daRevenue,
    fcrRevenue,
    fcrPenalty,
    totalFailed,
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

function restart() {
  gameState.restart()
  router.push('/game')
}

function formatEur(value: number): string {
  return value.toFixed(2)
}
</script>

<template>
  <div class="end-screen">
    <h1>End of Day Report</h1>
    
    <div class="revenue-summary">
      <h2>Total Revenue</h2>
      <div class="total-revenue" :class="{ negative: revenueBreakdown.totalRevenue < 0 }">
        €{{ formatEur(revenueBreakdown.totalRevenue) }}
      </div>
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
        <h3>FCR Market Performance</h3>
        <FCRBidChart :version="0" />
        <div class="chart-stats">
          <div class="stat-row">
            <span class="stat-label">Total Capacity:</span>
            <span class="stat-value">{{ fcrStats.totalAllocated.toFixed(1) }} MW·h</span>
          </div>
          <div class="stat-row">
            <span class="stat-label">Failed Delivery:</span>
            <span class="stat-value bad">{{ revenueBreakdown.totalFailed.toFixed(1) }} MWh</span>
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
        <span class="breakdown-label">FCR Capacity Revenue</span>
        <span class="breakdown-value positive">€{{ formatEur(revenueBreakdown.fcrRevenue) }}</span>
      </div>
      <div class="breakdown-item penalty">
        <span class="breakdown-label">FCR Delivery Penalties</span>
        <span class="breakdown-value negative">-€{{ formatEur(revenueBreakdown.fcrPenalty) }}</span>
      </div>
      <div class="breakdown-total">
        <span class="breakdown-label">Net Revenue</span>
        <span class="breakdown-value" :class="{ positive: revenueBreakdown.totalRevenue >= 0, negative: revenueBreakdown.totalRevenue < 0 }">
          €{{ formatEur(revenueBreakdown.totalRevenue) }}
        </span>
      </div>
    </div>

    <button class="restart-btn" @click="restart">Start New Day</button>
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

.restart-btn {
  display: block;
  margin: 0 auto;
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
  background: #3355e0;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}
</style>
