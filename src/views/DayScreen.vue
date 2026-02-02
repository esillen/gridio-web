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

const router = useRouter()

const speeds: SimulationSpeed[] = [1, 10, 50, 1000, 2000, 3000]

type SecondaryChart = 'weather' | 'consumption' | 'production' | 'frequency' | 'balancing'
const chartOptions: SecondaryChart[] = ['weather', 'consumption', 'production', 'frequency', 'balancing']
const chartLabels: Record<SecondaryChart, string> = {
  weather: 'Weather',
  consumption: 'Consumption Breakdown',
  production: 'Production Breakdown',
  frequency: 'System Frequency',
  balancing: 'Balancing Services',
}

const activeChart = ref<SecondaryChart>('weather')

function cycleChart() {
  const currentIndex = chartOptions.indexOf(activeChart.value)
  const nextIndex = (currentIndex + 1) % chartOptions.length
  activeChart.value = chartOptions[nextIndex] as SecondaryChart
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === ' ') {
    e.preventDefault()
    gameState.togglePause()
  } else if (e.key === 'Tab') {
    e.preventDefault()
    cycleChart()
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
    router.push('/')
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

function endDayEarly() {
  gameState.endDay()
  router.push('/end')
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

    <div class="section-label">Power Grid</div>
    <div class="chart-container">
      <PowerChart :history="gameState.gridHistory" :version="gameState.historyVersion" />
    </div>

    <div class="section-header">
      <div class="section-label">{{ chartLabels[activeChart] }}</div>
      <div class="chart-tabs">
        <button
          v-for="chart in chartOptions"
          :key="chart"
          :class="{ active: activeChart === chart }"
          @click="activeChart = chart"
        >
          {{ chartLabels[chart] }}
        </button>
        <span class="hotkey-hint">(Tab)</span>
      </div>
    </div>
    <div class="chart-container">
      <WeatherChart 
        v-if="activeChart === 'weather'"
        :history="gameState.weatherHistory" 
        :forecastArrays="gameState.forecastArrays"
        :currentTime="gameState.currentTime"
        :version="gameState.weatherHistoryVersion" 
      />
      <ConsumptionChart
        v-else-if="activeChart === 'consumption'"
        :history="gameState.consumptionHistory"
        :version="gameState.historyVersion"
      />
      <ProductionChart
        v-else-if="activeChart === 'production'"
        :history="gameState.productionHistory"
        :version="gameState.historyVersion"
      />
      <FrequencyChart
        v-else-if="activeChart === 'frequency'"
        :history="gameState.frequencyHistory"
        :version="gameState.historyVersion"
      />
      <BalancingChart
        v-else-if="activeChart === 'balancing'"
        :history="gameState.balancingHistory"
        :version="gameState.historyVersion"
      />
    </div>

    <button class="end-btn" @click="endDayEarly">End Day Early</button>
  </div>
</template>

<style scoped>
.day-screen {
  max-width: 1000px;
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

.end-btn {
  background: white;
  border: 1px solid var(--color-gray-300);
  color: var(--color-gray-500);
  padding: 0.5rem 1rem;
  border-radius: 12px;
  font-size: 0.875rem;
}

.end-btn:hover {
  color: var(--color-gray-700);
  border-color: var(--color-gray-400);
}
</style>
