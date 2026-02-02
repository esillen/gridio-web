<script setup lang="ts">
import { gameState } from '../game/GameState'
import { useRouter } from 'vue-router'

const router = useRouter()

function startDay() {
  gameState.startDay()
  router.push('/day')
}
</script>

<template>
  <div class="start-screen">
    <h1>Power Grid Simulator</h1>
    
    <div class="config-section">
      <h2>Day Configuration</h2>
      
      <div class="config-group">
        <label>
          Power Plants
          <input type="number" v-model.number="gameState.config.powerPlantCount" min="0" max="20" />
        </label>
        <label>
          MW per Plant
          <input type="number" v-model.number="gameState.config.powerPlantMW" min="1" max="1000" />
        </label>
      </div>
      
      <div class="config-group">
        <label>
          Consumers
          <input type="number" v-model.number="gameState.config.consumerCount" min="0" max="50" />
        </label>
        <label>
          MW per Consumer
          <input type="number" v-model.number="gameState.config.consumerMW" min="1" max="500" />
        </label>
      </div>

      <div class="summary">
        <p>Total Production: <strong class="production">{{ gameState.config.powerPlantCount * gameState.config.powerPlantMW }} MW</strong></p>
        <p>Total Consumption: <strong class="consumption">{{ gameState.config.consumerCount * gameState.config.consumerMW }} MW</strong></p>
        <p>Expected Imbalance: <strong>{{ gameState.config.powerPlantCount * gameState.config.powerPlantMW - gameState.config.consumerCount * gameState.config.consumerMW }} MW</strong></p>
      </div>
    </div>

    <button class="start-btn" @click="startDay">Start Day</button>
  </div>
</template>

<style scoped>
.start-screen {
  max-width: 600px;
  margin: 0 auto;
  padding: 2rem;
}

h1 {
  text-align: center;
  color: var(--gridio-sky-vivid);
  margin-bottom: 2rem;
  font-size: 1.75rem;
  font-weight: 600;
}

h2 {
  color: var(--color-gray-500);
  font-size: 0.875rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 1rem;
  font-weight: 500;
}

.config-section {
  background: white;
  border-radius: 16px;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.config-group {
  display: flex;
  gap: 1rem;
  margin-bottom: 1rem;
}

label {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  color: var(--color-gray-700);
  font-size: 0.875rem;
  font-weight: 500;
}

input {
  background: var(--color-gray-50);
  border: 1px solid var(--color-gray-300);
  border-radius: 12px;
  padding: 0.75rem;
  color: var(--color-gray-900);
  font-size: 1rem;
}

input:focus {
  outline: none;
  border-color: var(--gridio-sky-vivid);
  box-shadow: 0 0 0 3px var(--gridio-sky-weak);
}

.summary {
  margin-top: 1.5rem;
  padding-top: 1rem;
  border-top: 1px solid var(--color-gray-200);
}

.summary p {
  margin: 0.5rem 0;
  color: var(--color-gray-600);
  font-size: 0.875rem;
}

.summary strong {
  color: var(--color-gray-900);
}

.summary .production {
  color: var(--gridio-grass-vivid);
}

.summary .consumption {
  color: var(--gridio-clay-vivid);
}

.start-btn {
  width: 100%;
  padding: 0.875rem 1.5rem;
  font-size: 1rem;
  background: var(--gridio-sky-vivid);
  color: white;
  border: none;
  border-radius: 24px;
  font-weight: 500;
  transition: background 0.2s;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.start-btn:hover {
  background: #3355e0;
}
</style>
