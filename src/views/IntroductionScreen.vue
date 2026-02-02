<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const currentSlide = ref(0)
const isTransitioning = ref(false)

interface Slide {
  title: string
  content: string[]
  icon: string
}

const slides: Slide[] = [
  {
    title: 'The Power Grid',
    icon: '⚡',
    content: [
      'The electricity grid must be balanced at all times.',
      'Production must exactly match consumption, every second.',
      'If they don\'t match, the grid frequency deviates from 50 Hz.',
    ],
  },
  {
    title: 'Supply & Demand',
    icon: '⚖️',
    content: [
      'Demand fluctuates with weather, time of day, and human activity.',
      'Some generation is controllable (hydro, nuclear), some is variable (wind, solar).',
      'Your job is to keep them in balance.',
    ],
  },
  {
    title: 'Frequency Control',
    icon: '📊',
    content: [
      'When demand exceeds supply, frequency drops below 50 Hz.',
      'When supply exceeds demand, frequency rises above 50 Hz.',
      'Reserves (FCR, aFRR, mFRR) automatically help stabilize the grid.',
    ],
  },
]

const totalSlides = slides.length

const progress = computed(() => ((currentSlide.value + 1) / totalSlides) * 100)

function nextSlide() {
  if (isTransitioning.value) return
  
  if (currentSlide.value < totalSlides - 1) {
    isTransitioning.value = true
    currentSlide.value++
    setTimeout(() => {
      isTransitioning.value = false
    }, 400)
  } else {
    router.push('/game')
  }
}

function prevSlide() {
  if (isTransitioning.value) return
  
  if (currentSlide.value > 0) {
    isTransitioning.value = true
    currentSlide.value--
    setTimeout(() => {
      isTransitioning.value = false
    }, 400)
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === ' ' || e.key === 'ArrowRight' || e.key === 'Enter') {
    e.preventDefault()
    nextSlide()
  } else if (e.key === 'ArrowLeft') {
    e.preventDefault()
    prevSlide()
  } else if (e.key === 'Escape') {
    router.push('/game')
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
  <div class="introduction-screen">
    <div class="progress-bar">
      <div class="progress-fill" :style="{ width: `${progress}%` }"></div>
    </div>
    
    <div class="slide-container">
      <TransitionGroup name="slide">
        <div 
          v-for="(slide, index) in slides" 
          :key="index"
          v-show="currentSlide === index"
          class="slide"
        >
          <div class="slide-icon">{{ slide.icon }}</div>
          <h1 class="slide-title">{{ slide.title }}</h1>
          <div class="slide-content">
            <p v-for="(line, i) in slide.content" :key="i" class="content-line">
              {{ line }}
            </p>
          </div>
        </div>
      </TransitionGroup>
    </div>

    <div class="navigation">
      <div class="dots">
        <button 
          v-for="(_, index) in slides" 
          :key="index"
          class="dot"
          :class="{ active: currentSlide === index, visited: index < currentSlide }"
          @click="currentSlide = index"
        ></button>
      </div>
      
      <div class="nav-buttons">
        <button 
          v-if="currentSlide > 0" 
          class="nav-btn secondary"
          @click="prevSlide"
        >
          Back
        </button>
        <button class="nav-btn primary" @click="nextSlide">
          {{ currentSlide < totalSlides - 1 ? 'Continue' : 'Start Game' }}
          <span class="hotkey">(Space)</span>
        </button>
      </div>
    </div>

    <button class="skip-btn" @click="router.push('/game')">
      Skip Introduction
    </button>
  </div>
</template>

<style scoped>
.introduction-screen {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  position: relative;
}

.progress-bar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: var(--color-gray-200);
}

.progress-fill {
  height: 100%;
  background: var(--gridio-sky-vivid);
  transition: width 0.4s ease;
}

.slide-container {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  max-width: 600px;
  position: relative;
  min-height: 400px;
}

.slide {
  position: absolute;
  width: 100%;
  text-align: center;
}

.slide-icon {
  font-size: 4rem;
  margin-bottom: 1.5rem;
  line-height: 1;
}

.slide-title {
  font-size: 2rem;
  font-weight: 600;
  color: var(--gridio-sky-vivid);
  margin-bottom: 2rem;
}

.slide-content {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.content-line {
  font-size: 1.25rem;
  color: var(--color-gray-700);
  line-height: 1.6;
  background: white;
  padding: 1rem 1.5rem;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.navigation {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
  margin-top: 2rem;
}

.dots {
  display: flex;
  gap: 0.75rem;
}

.dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--color-gray-300);
  border: none;
  cursor: pointer;
  transition: all 0.2s;
}

.dot:hover {
  background: var(--color-gray-400);
}

.dot.visited {
  background: var(--gridio-sky-weak);
}

.dot.active {
  background: var(--gridio-sky-vivid);
  transform: scale(1.2);
}

.nav-buttons {
  display: flex;
  gap: 1rem;
}

.nav-btn {
  padding: 0.875rem 2rem;
  font-size: 1rem;
  border: none;
  border-radius: 24px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.nav-btn.primary {
  background: var(--gridio-sky-vivid);
  color: white;
  box-shadow: 0 2px 8px rgba(68, 103, 254, 0.3);
}

.nav-btn.primary:hover {
  background: #3355e0;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(68, 103, 254, 0.4);
}

.nav-btn.secondary {
  background: white;
  color: var(--color-gray-700);
  border: 1px solid var(--color-gray-300);
}

.nav-btn.secondary:hover {
  background: var(--color-gray-50);
  border-color: var(--color-gray-400);
}

.hotkey {
  opacity: 0.7;
  font-size: 0.875rem;
}

.skip-btn {
  position: absolute;
  bottom: 2rem;
  right: 2rem;
  background: none;
  border: none;
  color: var(--color-gray-400);
  font-size: 0.875rem;
  cursor: pointer;
  transition: color 0.2s;
}

.skip-btn:hover {
  color: var(--color-gray-600);
}

/* Slide transitions */
.slide-enter-active,
.slide-leave-active {
  transition: all 0.4s ease;
}

.slide-enter-from {
  opacity: 0;
  transform: translateX(30px);
}

.slide-leave-to {
  opacity: 0;
  transform: translateX(-30px);
}
</style>
