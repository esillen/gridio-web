<script setup lang="ts">
import { onMounted, onUnmounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { gameState, type SimulationSpeed } from '../game/GameState'
import PowerChart from '../components/PowerChart.vue'

const router = useRouter()

const speeds: SimulationSpeed[] = [1, 10, 50, 1000]

function handleKeydown(e: KeyboardEvent) {
  if (e.key === ' ') {
    e.preventDefault()
    gameState.togglePause()
  } else if (e.key >= '1' && e.key <= '4') {
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
const snapshot = computed(() => gameState.currentSnapshot)

function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`
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
      <div class="time-display">
        {{ formatTime(currentTime) }} / 24:00
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

    <div class="stats" v-if="snapshot">
      <div class="stat production">
        <span class="label">Production</span>
        <span class="value">{{ snapshot.production }} MW</span>
      </div>
      <div class="stat consumption">
        <span class="label">Consumption</span>
        <span class="value">{{ snapshot.consumption }} MW</span>
      </div>
      <div class="stat imbalance" :class="{ negative: snapshot.imbalance < 0, positive: snapshot.imbalance > 0 }">
        <span class="label">Imbalance</span>
        <span class="value">{{ snapshot.imbalance > 0 ? '+' : '' }}{{ snapshot.imbalance }} MW</span>
      </div>
    </div>

    <div class="chart-container">
      <PowerChart :history="gameState.history" :version="gameState.historyVersion" />
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

.time-display {
  background: white;
  padding: 0.5rem 1rem;
  border-radius: 12px;
  color: var(--color-gray-700);
  font-family: monospace;
  font-weight: 500;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
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

.stats {
  display: flex;
  gap: 1rem;
  margin-bottom: 1rem;
}

.stat {
  flex: 1;
  background: white;
  padding: 1rem;
  border-radius: 16px;
  text-align: center;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.stat .label {
  display: block;
  color: var(--color-gray-500);
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 0.5rem;
  font-weight: 500;
}

.stat .value {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--color-gray-900);
}

.stat.production .value {
  color: var(--gridio-grass-vivid);
}

.stat.consumption .value {
  color: var(--gridio-clay-vivid);
}

.stat.imbalance.positive .value {
  color: var(--gridio-grass-vivid);
}

.stat.imbalance.negative .value {
  color: var(--gridio-clay-vivid);
}

.chart-container {
  background: white;
  border-radius: 16px;
  padding: 1rem;
  margin-bottom: 1rem;
  height: 300px;
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
