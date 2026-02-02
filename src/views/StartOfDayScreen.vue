<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { gameState } from '../game/GameState'
import { useRouter } from 'vue-router'

const router = useRouter()

function startDay() {
  gameState.startDay()
  router.push('/day')
}

function handleKeydown(e: KeyboardEvent) {
  if (e.code === 'Space') {
    e.preventDefault()
    startDay()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div class="start-screen">
    <h1>Power Grid Simulator</h1>
    
    <div class="toggles-section">
      <div class="toggles-grid">
        <label class="toggle">
          <input type="checkbox" v-model="gameState.config.toggles.nuclear" />
          <span class="toggle-label">Nuclear</span>
        </label>
        <label class="toggle">
          <input type="checkbox" v-model="gameState.config.toggles.hydroReservoir" />
          <span class="toggle-label">Hydro Reservoir</span>
        </label>
        <label class="toggle">
          <input type="checkbox" v-model="gameState.config.toggles.hydroRoR" />
          <span class="toggle-label">Hydro RoR</span>
        </label>
        <label class="toggle">
          <input type="checkbox" v-model="gameState.config.toggles.wind" />
          <span class="toggle-label">Wind</span>
        </label>
        <label class="toggle">
          <input type="checkbox" v-model="gameState.config.toggles.solar" />
          <span class="toggle-label">Solar</span>
        </label>
        <label class="toggle">
          <input type="checkbox" v-model="gameState.config.toggles.chp" />
          <span class="toggle-label">CHP</span>
        </label>
        <label class="toggle">
          <input type="checkbox" v-model="gameState.config.toggles.peakers" />
          <span class="toggle-label">Peakers</span>
        </label>
        <label class="toggle">
          <input type="checkbox" v-model="gameState.config.toggles.interconnectors" />
          <span class="toggle-label">Interconnectors</span>
        </label>
        <label class="toggle">
          <input type="checkbox" v-model="gameState.config.toggles.demandResponse" />
          <span class="toggle-label">Demand Response</span>
        </label>
      </div>
    </div>

    <button class="start-btn" @click="startDay">
      Start Day
      <span class="hint">(Space)</span>
    </button>
  </div>
</template>

<style scoped>
.start-screen {
  max-width: 400px;
  margin: 0 auto;
  padding: 2rem;
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  justify-content: center;
}

h1 {
  text-align: center;
  color: var(--gridio-sky-vivid);
  margin-bottom: 1.5rem;
  font-size: 1.5rem;
  font-weight: 600;
}

.toggles-section {
  background: white;
  border-radius: 12px;
  padding: 1rem;
  margin-bottom: 1.5rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.toggles-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 0.5rem;
}

.toggle {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.375rem 0.5rem;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s;
}

.toggle:hover {
  background: var(--color-gray-50);
}

.toggle input[type="checkbox"] {
  width: 16px;
  height: 16px;
  accent-color: var(--gridio-sky-vivid);
  cursor: pointer;
}

.toggle-label {
  font-size: 0.8rem;
  color: var(--color-gray-700);
  user-select: none;
}

.start-btn {
  width: 100%;
  padding: 0.75rem 1.5rem;
  font-size: 1rem;
  background: var(--gridio-sky-vivid);
  color: white;
  border: none;
  border-radius: 20px;
  font-weight: 500;
  transition: background 0.2s;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.start-btn:hover {
  background: #3355e0;
}

.hint {
  font-size: 0.75rem;
  opacity: 0.7;
}
</style>
