<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { gameState } from '../game/GameState'

const router = useRouter()

const stats = computed(() => {
  const history = gameState.history
  if (history.length === 0) return null

  const totalProductionMWs = history.reduce((sum, s) => sum + s.production, 0)
  const totalConsumptionMWs = history.reduce((sum, s) => sum + s.consumption, 0)
  const avgImbalance = history.reduce((sum, s) => sum + Math.abs(s.imbalance), 0) / history.length
  const hours = history.length / 3600

  return {
    durationHours: hours.toFixed(1),
    totalProductionMWh: (totalProductionMWs / 3600).toFixed(0),
    totalConsumptionMWh: (totalConsumptionMWs / 3600).toFixed(0),
    avgImbalance: avgImbalance.toFixed(1)
  }
})

function restart() {
  gameState.restart()
  router.push('/')
}
</script>

<template>
  <div class="end-screen">
    <h1>End of Day</h1>
    
    <div class="summary" v-if="stats">
      <div class="stat">
        <span class="label">Duration</span>
        <span class="value">{{ stats.durationHours }} hours</span>
      </div>
      <div class="stat">
        <span class="label">Total Production</span>
        <span class="value">{{ stats.totalProductionMWh }} MWh</span>
      </div>
      <div class="stat">
        <span class="label">Total Consumption</span>
        <span class="value">{{ stats.totalConsumptionMWh }} MWh</span>
      </div>
      <div class="stat">
        <span class="label">Avg Absolute Imbalance</span>
        <span class="value">{{ stats.avgImbalance }} MW</span>
      </div>
    </div>

    <button class="restart-btn" @click="restart">Start New Day</button>
  </div>
</template>

<style scoped>
.end-screen {
  max-width: 500px;
  margin: 0 auto;
  padding: 2rem;
  text-align: center;
}

h1 {
  color: #00ff88;
  margin-bottom: 2rem;
}

.summary {
  background: #1a1a2e;
  border-radius: 12px;
  padding: 1.5rem;
  margin-bottom: 2rem;
}

.stat {
  display: flex;
  justify-content: space-between;
  padding: 0.75rem 0;
  border-bottom: 1px solid #333;
}

.stat:last-child {
  border-bottom: none;
}

.stat .label {
  color: #888;
}

.stat .value {
  color: #fff;
  font-weight: bold;
}

.restart-btn {
  background: #00ff88;
  color: #0f0f1a;
  border: none;
  padding: 1rem 2rem;
  font-size: 1.1rem;
  border-radius: 8px;
  cursor: pointer;
  font-weight: bold;
}

.restart-btn:hover {
  background: #00cc6a;
}
</style>
