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
        <span class="value production">{{ stats.totalProductionMWh }} MWh</span>
      </div>
      <div class="stat">
        <span class="label">Total Consumption</span>
        <span class="value consumption">{{ stats.totalConsumptionMWh }} MWh</span>
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
  color: var(--gridio-sky-vivid);
  margin-bottom: 2rem;
  font-size: 1.75rem;
  font-weight: 600;
}

.summary {
  background: white;
  border-radius: 16px;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.stat {
  display: flex;
  justify-content: space-between;
  padding: 0.75rem 0;
  border-bottom: 1px solid var(--color-gray-100);
}

.stat:last-child {
  border-bottom: none;
}

.stat .label {
  color: var(--color-gray-500);
  font-size: 0.875rem;
}

.stat .value {
  color: var(--color-gray-900);
  font-weight: 600;
}

.stat .value.production {
  color: var(--gridio-grass-vivid);
}

.stat .value.consumption {
  color: var(--gridio-clay-vivid);
}

.restart-btn {
  background: var(--gridio-sky-vivid);
  color: white;
  border: none;
  padding: 0.875rem 1.5rem;
  font-size: 1rem;
  border-radius: 24px;
  font-weight: 500;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  transition: background 0.2s;
}

.restart-btn:hover {
  background: #3355e0;
}
</style>
