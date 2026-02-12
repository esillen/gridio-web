<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, markRaw } from 'vue'
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

function fmt(n: number, decimals = 0): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: decimals, minimumFractionDigits: decimals })
}

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
  
  const warmupSeconds = 48 * 3600
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

const latestGrid = computed<GridSnapshot | null>(() =>
  gridHistory.value.length ? gridHistory.value[gridHistory.value.length - 1]! : null)
const latestProduction = computed<ProductionSnapshot | null>(() =>
  productionHistory.value.length ? productionHistory.value[productionHistory.value.length - 1]! : null)
const latestConsumption = computed<ConsumptionSnapshot | null>(() =>
  consumptionHistory.value.length ? consumptionHistory.value[consumptionHistory.value.length - 1]! : null)
const latestWeather = computed<WeatherSnapshot | null>(() =>
  weatherHistory.value.length ? weatherHistory.value[weatherHistory.value.length - 1]! : null)
const latestBalancing = computed<BalancingSnapshot | null>(() =>
  balancingHistory.value.length ? balancingHistory.value[balancingHistory.value.length - 1]! : null)

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
          <div class="section-label">System Frequency</div>
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
        <div v-if="bottomChartView === 'grid' && latestGrid" class="chart-numbers">
          <span>Production <strong>{{ fmt(latestGrid.production) }}</strong> MW</span>
          <span>Consumption <strong>{{ fmt(latestGrid.consumption) }}</strong> MW</span>
          <span>Imbalance <strong>{{ fmt(latestGrid.imbalance) }}</strong> MW</span>
        </div>
        <div v-else-if="bottomChartView === 'production' && latestProduction" class="chart-numbers">
          <span>Nuclear <strong>{{ fmt(latestProduction.nuclearMW) }}</strong></span>
          <span>Hydro res. <strong>{{ fmt(latestProduction.hydroReservoirMW) }}</strong></span>
          <span>Hydro RoR <strong>{{ fmt(latestProduction.hydroRoRMW) }}</strong></span>
          <span>Wind <strong>{{ fmt(latestProduction.windMW) }}</strong></span>
          <span>Solar <strong>{{ fmt(latestProduction.solarMW) }}</strong></span>
          <span>CHP <strong>{{ fmt(latestProduction.chpMW) }}</strong></span>
          <span>Ind. CHP <strong>{{ fmt(latestProduction.industrialChpMW) }}</strong></span>
          <span>Peakers <strong>{{ fmt(latestProduction.peakersMW) }}</strong></span>
          <span>Interconn. <strong>{{ fmt(latestProduction.interconnectorsMW) }}</strong></span>
          <span class="total">Total <strong>{{ fmt(latestProduction.totalMW) }}</strong> MW</span>
        </div>
        <div v-else-if="bottomChartView === 'consumption' && latestConsumption" class="chart-numbers">
          <span>Heating <strong>{{ fmt(latestConsumption.heatingMW) }}</strong></span>
          <span>Non-heating <strong>{{ fmt(latestConsumption.nonHeatingMW) }}</strong></span>
          <span>Services <strong>{{ fmt(latestConsumption.servicesMW) }}</strong></span>
          <span>Transport <strong>{{ fmt(latestConsumption.transportMW) }}</strong></span>
          <span>Industry <strong>{{ fmt(latestConsumption.industryMW) }}</strong></span>
          <span>Losses <strong>{{ fmt(latestConsumption.lossesMW) }}</strong></span>
          <span>Exports <strong>{{ fmt(latestConsumption.exportsMW) }}</strong></span>
          <span class="total">Total <strong>{{ fmt(latestConsumption.totalMW) }}</strong> MW</span>
        </div>
        <div v-else-if="bottomChartView === 'weather' && latestWeather" class="chart-numbers">
          <span>Temp <strong>{{ fmt(latestWeather.current.synoptic.temperatureC, 1) }}</strong> °C</span>
          <span>Wind <strong>{{ fmt(latestWeather.current.synoptic.windMps, 1) }}</strong> m/s</span>
          <span>Cloud <strong>{{ fmt(latestWeather.current.synoptic.cloudCover01 * 100, 0) }}</strong>%</span>
          <span v-if="latestWeather.current.windRegions.length">Wind regions: {{ latestWeather.current.windRegions.map(r => fmt(r.windSpeed100mMps, 1)).join(', ') }} m/s</span>
        </div>
        <div v-else-if="bottomChartView === 'balancing' && latestBalancing" class="chart-numbers">
          <span>FCR-N <strong>{{ fmt(latestBalancing.fcrMW) }}</strong></span>
          <span>FFR <strong>{{ fmt(latestBalancing.ffrMW) }}</strong></span>
          <span>aFRR <strong>{{ fmt(latestBalancing.afrrMW) }}</strong></span>
          <span>mFRR <strong>{{ fmt(latestBalancing.mfrrMW) }}</strong></span>
          <span class="total">Total reserves <strong>{{ fmt(latestBalancing.totalReserveMW) }}</strong> MW</span>
          <span>Frequency <strong>{{ fmt(latestBalancing.frequencyHz, 3) }}</strong> Hz</span>
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
  height: 600px;
}

.chart-numbers {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem 1.5rem;
  margin-top: 0.75rem;
  padding: 0.75rem 0 1.25rem;
  border-top: 1px solid var(--color-gray-200);
  font-size: 0.8rem;
  color: var(--color-gray-600);
  min-height: 5rem;
}

.chart-numbers span {
  white-space: nowrap;
}

.chart-numbers strong {
  color: var(--color-gray-800);
  font-weight: 600;
  margin-left: 0.25rem;
}

.chart-numbers span.total {
  margin-left: auto;
  font-weight: 500;
}

.advanced-section {
  margin-top: 0.5rem;
  padding-bottom: 1rem;
}
</style>
