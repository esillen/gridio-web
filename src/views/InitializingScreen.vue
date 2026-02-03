<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { gameState } from '../game/GameState'

const router = useRouter()

onMounted(() => {
  // Watch for phase change to 'day'
  const checkPhase = setInterval(() => {
    if (gameState.phase === 'day') {
      clearInterval(checkPhase)
      router.push('/day')
    }
  }, 100)
})
</script>

<template>
  <div class="initializing-screen">
    <div class="content">
      <div class="spinner"></div>
      <h1>Initializing the power grid for you</h1>
      <p>Running 12-hour warm-up to settle all systems...</p>
    </div>
  </div>
</template>

<style scoped>
.initializing-screen {
  position: fixed;
  inset: 0;
  background: linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%);
  display: flex;
  align-items: center;
  justify-content: center;
}

.content {
  text-align: center;
  color: white;
}

.spinner {
  width: 60px;
  height: 60px;
  border: 4px solid rgba(255, 255, 255, 0.2);
  border-top-color: var(--gridio-sky-vivid);
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin: 0 auto 2rem;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

h1 {
  font-size: 2rem;
  font-weight: 600;
  margin-bottom: 1rem;
  color: white;
}

p {
  font-size: 1.125rem;
  opacity: 0.8;
  margin: 0;
}
</style>
