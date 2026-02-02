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
      <h2>Nuclear Fleet</h2>
      <p class="info">
        6 reactors totaling 7,012 MW capacity operate as baseload generation.
        Slow ramp rate (0.05 MW/s per unit).
      </p>
      <div class="reactor-list">
        <div class="reactor">Forsmark 1-3: 3,397 MW</div>
        <div class="reactor">Ringhals 3-4: 2,215 MW</div>
        <div class="reactor">Oskarshamn 3: 1,400 MW</div>
      </div>
    </div>

    <div class="config-section">
      <h2>Hydro Reservoir Fleet</h2>
      <p class="info">
        ~14,580 MW dispatchable capacity with daily energy budget.
        Fast ramping (20 MW/s up, 40 MW/s down). Storage: 34 TWh.
      </p>
    </div>

    <div class="config-section">
      <h2>Demand (Weather-Driven)</h2>
      <p class="info">
        Residential heating demand is simulated based on weather conditions.
        Peak demand can reach ~14,000 MW on very cold days.
      </p>
      
      <div class="config-group">
        <label>
          Start Day of Year
          <input type="number" v-model.number="gameState.config.startDayOfYear" min="1" max="365" />
        </label>
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

.info {
  color: var(--color-gray-600);
  font-size: 0.875rem;
  margin-bottom: 1rem;
  line-height: 1.5;
}

.reactor-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.reactor {
  color: var(--color-gray-700);
  font-size: 0.875rem;
  padding: 0.5rem 0.75rem;
  background: var(--color-gray-50);
  border-radius: 8px;
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
