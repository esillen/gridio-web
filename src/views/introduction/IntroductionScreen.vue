<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { generateIntroData, type HourlyData } from './introSimulation'
import ConsumptionSlide from './slides/ConsumptionSlide.vue'
import ProductionSlide from './slides/ProductionSlide.vue'
import BalanceSlide from './slides/BalanceSlide.vue'
import BalancingServicesSlide from './slides/BalancingServicesSlide.vue'
import PlayerRoleSlide from './slides/PlayerRoleSlide.vue'

const router = useRouter()

// Generate data once on mount
const introData = ref<HourlyData[]>([])

onMounted(() => {
  introData.value = generateIntroData()
})

// Slide management
type SlideType = 'consumption' | 'production' | 'balance' | 'balancing' | 'player'

interface SlideInfo {
  type: SlideType
  maxSteps: number
}

const slides: SlideInfo[] = [
  { type: 'consumption', maxSteps: 7 }, // 0 (empty) + 6 demand categories
  { type: 'production', maxSteps: 7 }, // 0 (consumption only) + 6 production categories
  { type: 'balance', maxSteps: 1 },
  { type: 'balancing', maxSteps: 1 },
  { type: 'player', maxSteps: 1 },
]

const currentSlideIndex = ref(0)
const currentStep = ref(0)

const currentSlide = computed(() => slides[currentSlideIndex.value]!)
const totalSlides = slides.length

const progress = computed(() => {
  // Calculate progress based on all steps across all slides
  let completedSteps = 0
  let totalSteps = 0
  
  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i]!
    totalSteps += slide.maxSteps
    if (i < currentSlideIndex.value) {
      completedSteps += slide.maxSteps
    } else if (i === currentSlideIndex.value) {
      completedSteps += currentStep.value
    }
  }
  
  return (completedSteps / totalSteps) * 100
})

function advance() {
  const slide = currentSlide.value
  
  if (currentStep.value < slide.maxSteps - 1) {
    currentStep.value++
  } else if (currentSlideIndex.value < totalSlides - 1) {
    currentSlideIndex.value++
    currentStep.value = 0
  } else {
    router.push('/game')
  }
}

function goBack() {
  if (currentStep.value > 0) {
    currentStep.value--
  } else if (currentSlideIndex.value > 0) {
    currentSlideIndex.value--
    currentStep.value = slides[currentSlideIndex.value]!.maxSteps - 1
  }
}

function handleKeydown(e: KeyboardEvent) {
  if (e.key === ' ' || e.key === 'ArrowRight' || e.key === 'Enter') {
    e.preventDefault()
    advance()
  } else if (e.key === 'ArrowLeft') {
    e.preventDefault()
    goBack()
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
      <ConsumptionSlide 
        v-if="currentSlide.type === 'consumption'"
        :data="introData"
        :step="currentStep"
      />
      <ProductionSlide 
        v-else-if="currentSlide.type === 'production'"
        :data="introData"
        :step="currentStep"
      />
      <BalanceSlide 
        v-else-if="currentSlide.type === 'balance'"
        :data="introData"
      />
      <BalancingServicesSlide 
        v-else-if="currentSlide.type === 'balancing'"
      />
      <PlayerRoleSlide 
        v-else-if="currentSlide.type === 'player'"
      />
    </div>
    
    <!--
    <div class="navigation">
      <button 
        v-if="currentSlideIndex > 0 || currentStep > 0" 
        class="nav-btn secondary"
        @click="goBack"
      >
        Back
      </button>
      <button class="nav-btn primary" @click="advance">
        {{ currentSlideIndex === totalSlides - 1 && currentStep === currentSlide.maxSteps - 1 ? 'Start Game' : 'Continue' }}
      </button>
    </div>
    -->

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
  padding: 1rem;
  max-width: 800px;
  margin: 0 auto;
}

.progress-bar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 4px;
  background: var(--color-gray-200);
  z-index: 100;
}

.progress-fill {
  height: 100%;
  background: var(--gridio-sky-vivid);
  transition: width 0.3s ease;
}

.slide-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  margin-top: 1rem;
}

.navigation {
  display: flex;
  justify-content: center;
  gap: 1rem;
  padding: 1rem 0;
}

.nav-btn {
  padding: 0.75rem 1.5rem;
  font-size: 0.95rem;
  border: none;
  border-radius: 20px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.nav-btn.primary {
  background: var(--gridio-sky-vivid);
  color: white;
  box-shadow: 0 2px 8px rgba(68, 103, 254, 0.3);
}

.nav-btn.primary:hover {
  background: #3355e0;
  transform: translateY(-1px);
}

.nav-btn.secondary {
  background: white;
  color: var(--color-gray-700);
  border: 1px solid var(--color-gray-300);
}

.nav-btn.secondary:hover {
  background: var(--color-gray-50);
}

.skip-btn {
  position: fixed;
  bottom: 1.5rem;
  right: 1.5rem;
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
</style>
