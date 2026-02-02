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
  color: #00ff88;
  margin: 0;
  font-size: 1.5rem;
}

.time-display {
  background: #1a1a2e;
  padding: 0.5rem 1rem;
  border-radius: 6px;
  color: #fff;
  font-family: monospace;
}

.controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: #1a1a2e;
  padding: 0.75rem;
  border-radius: 8px;
  margin-bottom: 1rem;
}

.speed-controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.speed-controls .label {
  color: #888;
  margin-right: 0.5rem;
}

.speed-controls button {
  background: #0f0f1a;
  border: 1px solid #333;
  color: #ccc;
  padding: 0.5rem 0.75rem;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s;
}

.speed-controls button.active {
  background: #00ff88;
  color: #0f0f1a;
  border-color: #00ff88;
}

.speed-controls button:hover:not(.active) {
  border-color: #00ff88;
}

.hotkey {
  opacity: 0.6;
  font-size: 0.8em;
}

.pause-btn {
  background: #333;
  border: none;
  color: #fff;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
}

.pause-btn.paused {
  background: #ff8800;
}

.stats {
  display: flex;
  gap: 1rem;
  margin-bottom: 1rem;
}

.stat {
  flex: 1;
  background: #1a1a2e;
  padding: 1rem;
  border-radius: 8px;
  text-align: center;
}

.stat .label {
  display: block;
  color: #888;
  font-size: 0.8rem;
  text-transform: uppercase;
  margin-bottom: 0.5rem;
}

.stat .value {
  font-size: 1.5rem;
  font-weight: bold;
}

.stat.production .value {
  color: #00ff88;
}

.stat.consumption .value {
  color: #ff6b6b;
}

.stat.imbalance .value {
  color: #888;
}

.stat.imbalance.positive .value {
  color: #00ff88;
}

.stat.imbalance.negative .value {
  color: #ff6b6b;
}

.chart-container {
  background: #1a1a2e;
  border-radius: 8px;
  padding: 1rem;
  margin-bottom: 1rem;
  height: 300px;
}

.end-btn {
  background: #333;
  border: none;
  color: #888;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;
}

.end-btn:hover {
  color: #fff;
}
</style>
