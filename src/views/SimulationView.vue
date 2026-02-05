<script setup lang="ts">
import { ref, onMounted, onUnmounted, markRaw } from 'vue'
import { WorldSimulation } from '../game/WorldSimulation'
import type { WeatherSnapshot, ConsumptionSnapshot, ProductionSnapshot, FrequencySnapshot, BalancingSnapshot } from '../game/WorldSimulation'
import type { GridSnapshot } from '../game/PowerGrid'
import type { ForecastRegionalOutput } from '../system_model'
import { DAY_DURATION_SECONDS } from '../game/GameState'

import PowerChart from '../components/PowerChart.vue'
import WeatherChart from '../components/WeatherChart.vue'
import ConsumptionChart from '../components/ConsumptionChart.vue'
import ProductionChart from '../components/ProductionChart.vue'
import FrequencyChart from '../components/FrequencyChart.vue'
import BalancingChart from '../components/BalancingChart.vue'

const currentTime = ref(0)
const isRunning = ref(false)
const isInitializing = ref(true)

const gridHistory = ref<GridSnapshot[]>([])
const weatherHistory = ref<WeatherSnapshot[]>([])
const consumptionHistory = ref<ConsumptionSnapshot[]>([])
const productionHistory = ref<ProductionSnapshot[]>([])
const frequencyHistory = ref<FrequencySnapshot[]>([])
const balancingHistory = ref<BalancingSnapshot[]>([])
const forecastRegional = ref<ForecastRegionalOutput | null>(null)

const historyVersion = ref(0)
const weatherHistoryVersion = ref(0)

let world: WorldSimulation | null = null
let animationFrameId: number | null = null

type BottomChart = 'grid' | 'production' | 'consumption' | 'weather' | 'balancing'
const bottomChartOptions: BottomChart[] = ['grid', 'production', 'consumption', 'weather', 'balancing']
const bottomChartLabels: Record<BottomChart, string> = {
  grid: 'Power Grid',
  production: 'Production Breakdown',
  consumption: 'Consumption Breakdown',
  weather: 'Weather & Forecast',
  balancing: 'Balancing Services',
}

const bottomChartView = ref<BottomChart>('grid')

function cycleBottomChart() {
  const currentIndex = bottomChartOptions.indexOf(bottomChartView.value)
  const nextIndex = (currentIndex + 1) % bottomChartOptions.length
  bottomChartView.value = bottomChartOptions[nextIndex] as BottomChart
}

function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

function syncUIState() {
  if (!world) return
  currentTime.value = world.currentTime
  gridHistory.value = world.gridHistory
  weatherHistory.value = world.weatherHistory
  consumptionHistory.value = world.consumptionHistory
  productionHistory.value = world.productionHistory
  frequencyHistory.value = world.frequencyHistory
  balancingHistory.value = world.balancingHistory
  forecastRegional.value = world.forecastRegional
  historyVersion.value++
  weatherHistoryVersion.value++
}

async function initialize() {
  isInitializing.value = true
  
  await new Promise(resolve => setTimeout(resolve, 50))
  
  const config = {
    startDayOfYear: 15,
    toggles: {
      nuclear: true,
      hydroReservoir: true,
      hydroRoR: true,
      wind: true,
      solar: true,
      chp: true,
      peakers: true,
      interconnectors: true,
      demandResponse: true,
    },
  }
  
  world = markRaw(new WorldSimulation(config))
  world.initialize()
  
  const warmupSeconds = 12 * 3600
  for (let i = 0; i < warmupSeconds; i++) {
    world.tick()
  }
  
  world.resetToStartOfDay()
  
  isInitializing.value = false
  syncUIState()
  startSimulation()
}

function startSimulation() {
  if (!world) return
  isRunning.value = true
  animationFrameId = requestAnimationFrame(simulationLoop)
}

function simulationLoop() {
  if (!isRunning.value || !world) return
  
  if (world.currentTime < DAY_DURATION_SECONDS) {
    const ticksPerFrame = 100
    for (let i = 0; i < ticksPerFrame && world.currentTime < DAY_DURATION_SECONDS; i++) {
      world.tick()
    }
    syncUIState()
    animationFrameId = requestAnimationFrame(simulationLoop)
  } else {
    isRunning.value = false
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    e.preventDefault()
    cycleBottomChart()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
  initialize()
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
  if (animationFrameId !== null) {
    cancelAnimationFrame(animationFrameId)
  }
})
</script>

<template>
  <div class="simulation-view">
    <header class="header">
      <h1>Dev Simulation View</h1>
      <div class="header-stats">
        <div v-if="isInitializing" class="status-display">Initializing...</div>
        <div v-else-if="!isRunning" class="status-display">Complete</div>
        <div v-else class="time-display">
          {{ formatTime(currentTime) }} / 24:00:00
        </div>
      </div>
    </header>

    <div v-if="isInitializing" class="loading-state">
      <p>Running 12-hour warmup...</p>
    </div>

    <div v-else class="charts-container">
      <div class="section">
        <div class="section-header">
          <div class="section-label">System Frequency & Imbalance</div>
        </div>
        <div class="chart-container frequency-chart">
          <FrequencyChart
            :history="frequencyHistory"
            :version="historyVersion"
          />
        </div>
      </div>

      <div class="section advanced-section">
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
        <div class="chart-container bottom-chart">
          <PowerChart 
            v-if="bottomChartView === 'grid'"
            :history="gridHistory" 
            :version="historyVersion" 
          />
          <ProductionChart
            v-else-if="bottomChartView === 'production'"
            :history="productionHistory"
            :version="historyVersion"
          />
          <ConsumptionChart
            v-else-if="bottomChartView === 'consumption'"
            :history="consumptionHistory"
            :version="historyVersion"
          />
          <WeatherChart 
            v-else-if="bottomChartView === 'weather'"
            :history="weatherHistory" 
            :forecastRegional="forecastRegional"
            :currentTime="currentTime"
            :version="weatherHistoryVersion" 
          />
          <BalancingChart
            v-else-if="bottomChartView === 'balancing'"
            :history="balancingHistory"
            :version="historyVersion"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.simulation-view {
  max-width: 1400px;
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

.time-display, .status-display {
  background: white;
  padding: 0.5rem 1rem;
  border-radius: 12px;
  color: var(--color-gray-700);
  font-family: monospace;
  font-weight: 500;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.loading-state {
  background: white;
  border-radius: 16px;
  padding: 3rem;
  text-align: center;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.loading-state p {
  color: var(--color-gray-600);
  font-size: 1.125rem;
  margin: 0;
}

.charts-container {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.section {
  background: white;
  border-radius: 16px;
  padding: 1rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.section-label {
  font-size: 0.875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-gray-600);
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
  width: 100%;
  overflow: hidden;
}

.frequency-chart {
  height: 300px;
}

.bottom-chart {
  height: 500px;
}

.advanced-section {
  margin-top: 0.5rem;
}
</style>
