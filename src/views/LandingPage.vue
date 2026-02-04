<script setup lang="ts">
import { useRouter } from 'vue-router'

const router = useRouter()
</script>

<template>
  <div class="landing-page">
    <div class="hero">
      <h1 class="logo">Grid.io</h1>
      <p class="tagline">Master the balance of the power grid</p>
    </div>

    <div class="options">
      <button class="option-btn introduction" @click="router.push('/introduction')">
        <span class="option-icon">📚</span>
        <span class="option-title">Introduction</span>
        <span class="option-desc">Learn how the power grid works</span>
      </button>

      <button class="option-btn tutorial" @click="router.push('/tutorial')">
        <span class="option-icon">🎓</span>
        <span class="option-title">Tutorial</span>
        <span class="option-desc">Learn by playing - 4 guided days</span>
      </button>

      <button class="option-btn play" @click="router.push('/game')">
        <span class="option-icon">⚡</span>
        <span class="option-title">Play Game</span>
        <span class="option-desc">Jump right into trading</span>
      </button>
    </div>

    <div class="footer">
      <p>Trade batteries on day-ahead and FCR markets to keep the grid stable</p>
    </div>
  </div>
</template>

<style scoped>
.landing-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%);
}

.hero {
  text-align: center;
  margin-bottom: 3rem;
}

.logo {
  font-size: 4rem;
  font-weight: 700;
  color: var(--gridio-sky-vivid);
  margin-bottom: 0.5rem;
  letter-spacing: -0.02em;
}

.tagline {
  font-size: 1.25rem;
  color: var(--color-gray-600);
  font-weight: 400;
}

.options {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: 100%;
  max-width: 400px;
}

.option-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 1.5rem 2rem;
  border: 2px solid transparent;
  border-radius: 16px;
  background: white;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.option-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
}

.option-btn.introduction {
  border-color: #8B5CF6;
}

.option-btn.introduction:hover {
  background: #f5f3ff;
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

.option-btn.play .option-title,
.option-btn.play .option-desc {
  color: white;
}

.option-btn.play:hover {
  background: #3355e0;
  border-color: #3355e0;
}

.option-icon {
  font-size: 2rem;
}

.option-title {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--color-gray-800);
}

.option-desc {
  font-size: 0.875rem;
  color: var(--color-gray-500);
}

.footer {
  margin-top: 3rem;
  text-align: center;
}

.footer p {
  font-size: 0.875rem;
  color: var(--color-gray-400);
}
</style>
