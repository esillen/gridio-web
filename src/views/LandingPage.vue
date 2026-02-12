<script setup lang="ts">
import { useRouter } from 'vue-router'
import backgroundImage from '../assets/background-images/power-lines.jpg'

const router = useRouter()
</script>

<template>
  <div class="landing-page" :style="{ backgroundImage: `url(${backgroundImage})` }">
    <div class="overlay"></div>
    
    <div class="desktop-warning">
      <div class="warning-overlay"></div>
      <div class="warning-content">
        <span class="warning-icon">🖥️</span>
        <p class="warning-text">Grid.io is designed for desktop browsers. Please visit on a larger screen for the best experience.</p>
      </div>
    </div>

    <div class="hero">
      <h1 class="logo">Grid.io</h1>
      <p class="tagline">Make money by balancing the power grid</p>
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
        <span class="option-desc">Learn by playing through 4 guided trading days</span>
      </button>

      <button class="option-btn play" @click="router.push('/game')">
        <span class="option-icon">⚡</span>
        <span class="option-title">Play + Sandbox mode</span>
        <span class="option-desc">Make as much money as you can! Or modify the grid and see how it behaves.</span>
      </button>
    </div>

    <div class="footer">
      <p>Trade batteries on day-ahead and FCR-N markets to keep the grid stable</p>
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
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  position: relative;
}

.overlay {
  position: absolute;
  inset: 0;
  background: rgba(15, 23, 42, 0.7);
  z-index: 0;
}

.desktop-warning {
  display: none;
}

.warning-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.85);
  z-index: 999;
}

.warning-content {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  text-align: center;
  background: linear-gradient(135deg, #F59E0B, #EF4444);
  padding: 2rem 1.5rem;
  border-radius: 16px;
  z-index: 1000;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
  max-width: 90%;
}

.warning-icon {
  font-size: 3rem;
  flex-shrink: 0;
}

.warning-text {
  color: white;
  font-size: 1rem;
  font-weight: 500;
  margin: 0;
  line-height: 1.5;
}

@media (max-width: 1024px) {
  .desktop-warning {
    display: block;
  }
}

.hero, .options, .footer {
  position: relative;
  z-index: 1;
}

.hero {
  text-align: center;
  margin-bottom: 3rem;
}

.logo {
  font-size: 4rem;
  font-weight: 700;
  color: white;
  margin-bottom: 0.5rem;
  letter-spacing: -0.02em;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
}

.tagline {
  font-size: 1.25rem;
  color: rgba(255, 255, 255, 0.9);
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
  gap: 0.4rem;
  padding: 1.1rem 1.5rem;
  border: 2px solid transparent;
  border-radius: 12px;
  background: white;
  cursor: pointer;
  transition: all 0.2s;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.option-btn:hover {
  transform: scale(1.05);
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
  padding: 2rem 2.5rem;
  margin: 1rem -1rem;
}

.option-btn.tutorial .option-icon {
  font-size: 2.5rem;
}

.option-btn.tutorial .option-title {
  font-size: 1.5rem;
}

.option-btn.tutorial .option-desc {
  font-size: 1rem;
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
  font-size: 1.5rem;
}

.option-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-gray-800);
}

.option-desc {
  font-size: 0.75rem;
  color: var(--color-gray-500);
}

.footer {
  margin-top: 3rem;
  text-align: center;
}

.footer p {
  font-size: 0.875rem;
  color: rgba(255, 255, 255, 0.6);
}
</style>
