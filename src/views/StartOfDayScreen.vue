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
        <p>Total Production: <strong>{{ gameState.config.powerPlantCount * gameState.config.powerPlantMW }} MW</strong></p>
        <p>Total Consumption: <strong>{{ gameState.config.consumerCount * gameState.config.consumerMW }} MW</strong></p>
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
  color: #00ff88;
  margin-bottom: 2rem;
}

h2 {
  color: #888;
  font-size: 1rem;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  margin-bottom: 1rem;
}

.config-section {
  background: #1a1a2e;
  border-radius: 12px;
  padding: 1.5rem;
  margin-bottom: 2rem;
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
  color: #ccc;
  font-size: 0.9rem;
}

input {
  background: #0f0f1a;
  border: 1px solid #333;
  border-radius: 6px;
  padding: 0.75rem;
  color: #fff;
  font-size: 1rem;
}

input:focus {
  outline: none;
  border-color: #00ff88;
}

.summary {
  margin-top: 1.5rem;
  padding-top: 1rem;
  border-top: 1px solid #333;
}

.summary p {
  margin: 0.5rem 0;
  color: #888;
}

.summary strong {
  color: #00ff88;
}

.start-btn {
  width: 100%;
  padding: 1rem 2rem;
  font-size: 1.2rem;
  background: #00ff88;
  color: #0f0f1a;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-weight: bold;
  transition: background 0.2s;
}

.start-btn:hover {
  background: #00cc6a;
}
</style>
