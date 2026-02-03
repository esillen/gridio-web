<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()
</script>

<template>
  <div class="after-intro-screen">
    <div class="content">
      <div class="icon">🎉</div>
      <h1>Ready to Trade?</h1>
      <p class="subtitle">You now understand how the grid works. What would you like to do next?</p>

      <div class="options">
        <button class="option-btn tutorial" @click="router.push('/tutorial')">
          <span class="btn-icon">🎓</span>
          <span class="btn-text">
            <span class="btn-title">Take the Tutorial</span>
            <span class="btn-desc">Learn the game controls step by step</span>
          </span>
        </button>

        <button class="option-btn play" @click="router.push('/game')">
          <span class="btn-icon">⚡</span>
          <span class="btn-text">
            <span class="btn-title">Start Playing</span>
            <span class="btn-desc">Jump right into trading</span>
          </span>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.after-intro-screen {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
}

.content {
  text-align: center;
  max-width: 450px;
}

.icon {
  font-size: 4rem;
  margin-bottom: 1rem;
}

h1 {
  font-size: 2rem;
  font-weight: 700;
  color: var(--gridio-sky-vivid);
  margin-bottom: 0.5rem;
}

.subtitle {
  font-size: 1.1rem;
  color: var(--color-gray-600);
  margin-bottom: 2rem;
  line-height: 1.5;
}

.options {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.option-btn {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.25rem 1.5rem;
  border: 2px solid transparent;
  border-radius: 12px;
  background: white;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  text-align: left;
}

.option-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
}

.option-btn.tutorial {
  border-color: #F59E0B;
}

.option-btn.tutorial:hover {
  background: #fffbeb;
}

.option-btn.play {
  border-color: var(--gridio-sky-vivid);
  background: var(--gridio-sky-vivid);
}

.option-btn.play .btn-title,
.option-btn.play .btn-desc {
  color: white;
}

.option-btn.play:hover {
  background: #3355e0;
  border-color: #3355e0;
}

.btn-icon {
  font-size: 2rem;
}

.btn-text {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.btn-title {
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--color-gray-800);
}

.btn-desc {
  font-size: 0.875rem;
  color: var(--color-gray-500);
}
</style>
