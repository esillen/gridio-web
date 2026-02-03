<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { gameState, type SimulationSpeed } from '../game/GameState'
import PowerChart from '../components/PowerChart.vue'
import WeatherChart from '../components/WeatherChart.vue'
import ConsumptionChart from '../components/ConsumptionChart.vue'
import ProductionChart from '../components/ProductionChart.vue'
import FrequencyChart from '../components/FrequencyChart.vue'
import BalancingChart from '../components/BalancingChart.vue'
import DABidChart from '../components/DABidChart.vue'
import FCRBidChart from '../components/FCRBidChart.vue'
import ImbalanceSettlementChart from '../components/ImbalanceSettlementChart.vue'
import BESSPanel from '../components/BESSPanel.vue'

const router = useRouter()

const speeds: SimulationSpeed[] = [1, 10, 50, 1000, 2000, 3000]

type TopChart = 'frequency' | 'da' | 'fcr' | 'imbalance'
const topChartOptions: TopChart[] = ['frequency', 'da', 'fcr', 'imbalance']
const topChartLabels: Record<TopChart, string> = {
  frequency: 'System Frequency',
  da: 'DA Bids',
  fcr: 'FCR Bids',
  imbalance: 'Imbalance Settlement',
}

type BottomChart = 'grid' | 'production' | 'consumption' | 'weather' | 'balancing'
const bottomChartOptions: BottomChart[] = ['grid', 'production', 'consumption', 'weather', 'balancing']
const bottomChartLabels: Record<BottomChart, string> = {
  grid: 'Power Grid',
  production: 'Production Breakdown',
  consumption: 'Consumption Breakdown',
  weather: 'Weather & Forecast',
  balancing: 'Balancing Services',
}

const topChartView = ref<TopChart>('frequency')
const bottomChartView = ref<BottomChart>('grid')
const showAdvanced = ref(false)

function cycleTopChart() {
  const currentIndex = topChartOptions.indexOf(topChartView.value)
  const nextIndex = (currentIndex + 1) % topChartOptions.length
  topChartView.value = topChartOptions[nextIndex] as TopChart
}

function cycleBottomChart() {
  const currentIndex = bottomChartOptions.indexOf(bottomChartView.value)
  const nextIndex = (currentIndex + 1) % bottomChartOptions.length
  bottomChartView.value = bottomChartOptions[nextIndex] as BottomChart
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === ' ') {
    e.preventDefault()
    gameState.togglePause()
  } else if (e.key === 'Tab') {
    e.preventDefault()
    cycleTopChart()
  } else if (e.key === 'Enter') {
    e.preventDefault()
    cycleBottomChart()
  } else if (e.key >= '1' && e.key <= '6') {
    const speedIndex = parseInt(e.key) - 1
    const speed = speeds[speedIndex]
    if (speed !== undefined) {
      gameState.setSpeed(speed)
    }
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
  
  if (gameState.phase !== 'day') {
    router.push('/game')
  }
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})

const currentTime = computed(() => gameState.currentTime)

function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}
</script>

<template>
  <div class="day-screen">
    <header class="header">
      <h1>Day Simulation</h1>
      <div class="header-stats">
        <div class="frequency-display" :class="gameState.currentFrequencyBand">
          {{ gameState.currentFrequencyHz.toFixed(3) }} Hz
        </div>
        <div class="time-display">
          {{ formatTime(currentTime) }} / 24:00:00
        </div>
      </div>
    </header>

    <div class="controls">
      <div class="speed-controls">
        <span class="label">Speed:</span>
        <button
          v-for="(s, i) in speeds"
          :key="s"
          :class="{ active: gameState.speed === s }"
          @click="gameState.setSpeed(s)"
        >
          {{ s }}x <span class="hotkey">({{ i + 1 }})</span>
        </button>
      </div>
      <button class="pause-btn" :class="{ paused: gameState.paused }" @click="gameState.togglePause()">
        {{ gameState.paused ? 'Resume' : 'Pause' }} <span class="hotkey">(Space)</span>
      </button>
    </div>

    <div class="main-content">
      <BESSPanel />
      
      <div class="charts-column">
        <div class="section-header">
          <div class="section-label">{{ topChartLabels[topChartView] }}</div>
          <div class="chart-tabs">
            <button
              v-for="chart in topChartOptions"
              :key="chart"
              :class="{ active: topChartView === chart }"
              @click="topChartView = chart"
            >
              {{ topChartLabels[chart] }}
            </button>
            <span class="hotkey-hint">(Tab)</span>
          </div>
        </div>
        <div class="chart-container">
          <FrequencyChart
            v-if="topChartView === 'frequency'"
            :history="gameState.frequencyHistory"
            :version="gameState.historyVersion"
          />
          <DABidChart 
            v-else-if="topChartView === 'da'"
            :version="gameState.bessVersion"
          />
          <FCRBidChart 
            v-else-if="topChartView === 'fcr'"
            :version="gameState.bessVersion"
          />
          <ImbalanceSettlementChart
            v-else-if="topChartView === 'imbalance'"
            :history="gameState.imbalanceSettlementHistory"
            :forecast="gameState.imbalanceSettlement?.forecast4h || null"
            :currentTime="gameState.currentTime"
            :version="gameState.imbalanceSettlementVersion"
          />
        </div>

        <div class="advanced-section">
          <button class="advanced-header" @click="showAdvanced = !showAdvanced">
            <span class="advanced-title">Advanced Charts</span>
            <span class="chevron" :class="{ expanded: showAdvanced }">▼</span>
          </button>
          <Transition name="expand">
            <div v-if="showAdvanced" class="advanced-content">
              <div class="section-header">
                <div class="section-label">{{ bottomChartLabels[bottomChartView] }}</div>
                <div class="chart-tabs">
                  <button
                    v-for="chart in bottomChartOptions"
                    :key="chart"
                    :class="{ active: bottomChartView === chart }"
                    @click="bottomChartView = chart"
                  >
                    {{ bottomChartLabels[chart] }}
                  </button>
                  <span class="hotkey-hint">(Enter)</span>
                </div>
              </div>
              <div class="chart-container">
                <PowerChart 
                  v-if="bottomChartView === 'grid'"
                  :history="gameState.gridHistory" 
                  :version="gameState.historyVersion" 
                />
                <ProductionChart
                  v-else-if="bottomChartView === 'production'"
                  :history="gameState.productionHistory"
                  :version="gameState.historyVersion"
                />
                <ConsumptionChart
                  v-else-if="bottomChartView === 'consumption'"
                  :history="gameState.consumptionHistory"
                  :version="gameState.historyVersion"
                />
                <WeatherChart 
                  v-else-if="bottomChartView === 'weather'"
                  :history="gameState.weatherHistory" 
                  :forecastArrays="gameState.forecastArrays"
                  :currentTime="gameState.currentTime"
                  :version="gameState.weatherHistoryVersion" 
                />
                <BalancingChart
                  v-else-if="bottomChartView === 'balancing'"
                  :history="gameState.balancingHistory"
                  :version="gameState.historyVersion"
                />
              </div>
            </div>
          </Transition>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.day-screen {
  max-width: 1200px;
  margin: 0 auto;
  padding: 1rem;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

h1 {
  color: var(--gridio-sky-vivid);
  margin: 0;
  font-size: 1.5rem;
  font-weight: 600;
}

.header-stats {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.time-display {
  background: white;
  padding: 0.5rem 1rem;
  border-radius: 12px;
  color: var(--color-gray-700);
  font-family: monospace;
  font-weight: 500;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.frequency-display {
  background: #D1FAE5;
  padding: 0.5rem 1rem;
  border-radius: 12px;
  font-family: monospace;
  font-weight: 600;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  color: #059669;
  transition: all 0.3s;
}

.frequency-display.normal {
  background: #D1FAE5;
  color: #059669;
}

.frequency-display.off_normal {
  background: #FEF3C7;
  color: #D97706;
}

.frequency-display.alert {
  background: #FED7AA;
  color: #C2410C;
}

.frequency-display.emergency {
  background: #FEE2E2;
  color: #DC2626;
  animation: pulse 1s infinite;
}

.frequency-display.blackout {
  background: #7F1D1D;
  color: white;
  animation: pulse 0.5s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

.controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: white;
  padding: 0.75rem;
  border-radius: 16px;
  margin-bottom: 1rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.speed-controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.speed-controls .label {
  color: var(--color-gray-500);
  margin-right: 0.5rem;
  font-size: 0.875rem;
}

.speed-controls button {
  background: var(--color-gray-50);
  border: 1px solid var(--color-gray-300);
  color: var(--color-gray-700);
  padding: 0.5rem 0.75rem;
  border-radius: 12px;
  font-size: 0.875rem;
  transition: all 0.2s;
}

.speed-controls button.active {
  background: var(--gridio-sky-vivid);
  color: white;
  border-color: var(--gridio-sky-vivid);
}

.speed-controls button:hover:not(.active) {
  border-color: var(--gridio-sky-vivid);
  color: var(--gridio-sky-vivid);
}

.hotkey {
  opacity: 0.6;
  font-size: 0.75em;
}

.pause-btn {
  background: var(--color-gray-100);
  border: 1px solid var(--color-gray-300);
  color: var(--color-gray-700);
  padding: 0.5rem 1rem;
  border-radius: 12px;
  font-size: 0.875rem;
  font-weight: 500;
}

.pause-btn:hover {
  background: var(--color-gray-200);
}

.pause-btn.paused {
  background: var(--gridio-peach-vivid);
  border-color: var(--gridio-peach-vivid);
  color: white;
}

.main-content {
  display: flex;
  gap: 1rem;
}

.charts-column {
  flex: 1;
  min-width: 0;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.section-label {
  font-size: 0.75rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-gray-500);
  margin-bottom: 0.5rem;
}

.section-header .section-label {
  margin-bottom: 0;
}

.chart-tabs {
  display: flex;
  gap: 0.25rem;
  align-items: center;
}

.chart-tabs button {
  background: var(--color-gray-100);
  border: 1px solid var(--color-gray-200);
  color: var(--color-gray-600);
  padding: 0.25rem 0.5rem;
  border-radius: 6px;
  font-size: 0.7rem;
  transition: all 0.2s;
}

.chart-tabs button.active {
  background: var(--gridio-sky-vivid);
  color: white;
  border-color: var(--gridio-sky-vivid);
}

.chart-tabs button:hover:not(.active) {
  border-color: var(--gridio-sky-vivid);
  color: var(--gridio-sky-vivid);
}

.hotkey-hint {
  color: var(--color-gray-400);
  font-size: 0.65rem;
  margin-left: 0.25rem;
}

.chart-container {
  background: white;
  border-radius: 16px;
  padding: 1rem;
  margin-bottom: 1rem;
  height: 250px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.advanced-section {
  margin-top: 2rem;
}

.advanced-header {
  width: 100%;
  background: var(--color-gray-50);
  border: 1px solid var(--color-gray-200);
  border-radius: 12px;
  padding: 0.75rem 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  transition: all 0.2s;
  margin-bottom: 0.5rem;
}

.advanced-header:hover {
  background: var(--color-gray-100);
  border-color: var(--gridio-sky-vivid);
}

.advanced-title {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-gray-600);
}

.chevron {
  transition: transform 0.3s;
  color: var(--color-gray-400);
  font-size: 0.75rem;
}

.chevron.expanded {
  transform: rotate(-180deg);
}

.advanced-content {
  overflow: hidden;
}

.advanced-content .chart-container {
  height: 500px;
}

.expand-enter-active,
.expand-leave-active {
  transition: all 0.3s ease;
  max-height: 800px;
}

.expand-enter-from,
.expand-leave-to {
  opacity: 0;
  max-height: 0;
  margin-top: 0;
}
</style>
