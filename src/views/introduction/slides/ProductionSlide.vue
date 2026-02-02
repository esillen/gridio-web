<script setup lang="ts">
import { computed } from 'vue'
import IntroChart from '../components/IntroChart.vue'
import type { ChartSeries } from '../components/IntroChart.vue'
import { PRODUCTION_CATEGORIES, getTotalConsumption, type HourlyData } from '../introSimulation'

const props = defineProps<{
  data: HourlyData[]
  step: number
}>()

const emit = defineEmits<{
  (e: 'maxSteps', value: number): void
}>()

const maxSteps = PRODUCTION_CATEGORIES.length + 1 // +1 for initial consumption-only state
emit('maxSteps', maxSteps)

// Add totalConsumption to each data point for the line
const dataWithTotals = computed(() => {
  return props.data.map(d => ({
    ...d,
    totalConsumption: getTotalConsumption(d),
  }))
})

const visibleCategories = computed(() => {
  return PRODUCTION_CATEGORIES.slice(0, props.step)
})

const series = computed<ChartSeries[]>(() => {
  const result: ChartSeries[] = []
  
  // Always show consumption line
  result.push({
    key: 'totalConsumption' as keyof HourlyData,
    label: 'Total Consumption',
    color: '#EF4444',
    type: 'line',
  })
  
  // Add production areas based on step
  for (const cat of visibleCategories.value) {
    result.push({
      key: cat.key,
      label: cat.label,
      color: cat.color,
      type: 'area',
    })
  }
  
  return result
})

const currentCategory = computed(() => {
  if (props.step === 0) return null
  return PRODUCTION_CATEGORIES[props.step - 1] || null
})

const currentImage = computed(() => currentCategory.value?.image || null)

const explanation = computed(() => {
  if (props.step === 0) {
    return 'This consumption must be met with electricity production. Let\'s see how different sources contribute.'
  }
  
  const cat = currentCategory.value
  if (!cat) return ''
  
  const explanations: Record<string, string> = {
    nuclear: 'Nuclear provides steady baseload power. It\'s reliable but slow to adjust — changes take hours or days.',
    hydroReservoir: 'Reservoir hydro is the grid\'s workhorse. Fast-responding and dispatchable, it fills gaps left by other sources.',
    hydroRoR: 'Run-of-river hydro depends on natural water flow. It varies with season and precipitation.',
    chp: 'Combined Heat & Power plants produce electricity while generating heat for district heating. Output follows heat demand.',
    wind: 'Wind power is variable and unpredictable. It can swing from near-zero to full capacity within hours.',
    solar: 'Solar follows the sun. In winter, output is low and concentrated around midday.',
  }
  
  return explanations[cat.key] || ''
})

const title = computed(() => {
  if (props.step === 0) return 'Meeting Demand with Production'
  return currentCategory.value?.label || 'Electricity Production'
})
</script>

<template>
  <div class="slide">
    <!-- Background image with fade-through-white transition -->
    <Transition name="bg-fade" mode="out-in">
      <div 
        v-if="currentImage"
        :key="currentImage"
        class="background-image"
        :style="{ backgroundImage: `url(${currentImage})` }"
      ></div>
    </Transition>
    
    <div class="slide-content">
      <h2 class="slide-title">{{ title }}</h2>
      
      <div class="chart-container">
        <IntroChart 
          :data="dataWithTotals" 
          :series="series"
          :maxY="22000"
        />
      </div>
      
      <div class="legend">
        <div class="legend-item consumption">
          <span class="legend-line" style="background: #EF4444"></span>
          <span class="legend-label">Consumption</span>
        </div>
        <div 
          v-for="cat in visibleCategories" 
          :key="cat.key" 
          class="legend-item"
          :class="{ highlight: cat.key === currentCategory?.key }"
        >
          <span class="legend-color" :style="{ background: cat.color }"></span>
          <span class="legend-label">{{ cat.label }}</span>
        </div>
      </div>
      
      <p class="explanation">{{ explanation }}</p>
      
      <div class="hint">
        Press <kbd>Space</kbd> to continue
      </div>
    </div>
  </div>
</template>

<style scoped>
.slide {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.background-image {
  position: fixed;
  inset: 0;
  background-size: cover;
  background-position: center;
  z-index: 0;
}

/* Fade through white transition */
.bg-fade-enter-active {
  transition: opacity 0.4s ease-out;
  transition-delay: 0.15s;
}

.bg-fade-leave-active {
  transition: opacity 0.35s ease-in;
}

.bg-fade-enter-from,
.bg-fade-leave-to {
  opacity: 0;
}

.background-overlay {
  display: none;
}

.slide-content {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 1.5rem;
  margin: 1rem;
  background: rgba(255, 255, 255, 0.90);
  border-radius: 16px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.15);
}

.slide-title {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--gridio-sky-vivid);
  margin-bottom: 1rem;
  text-align: center;
}

.chart-container {
  flex: 1;
  min-height: 250px;
  background: white;
  border-radius: 8px;
  padding: 1rem;
  border: 1px solid var(--color-gray-200);
}

.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  justify-content: center;
  margin-top: 1rem;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.8rem;
  color: var(--color-gray-600);
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  transition: all 0.3s;
}

.legend-item.highlight {
  color: var(--color-gray-900);
  font-weight: 500;
  background: var(--color-gray-100);
}

.legend-item.consumption {
  color: var(--color-gray-700);
  font-weight: 500;
}

.legend-color {
  width: 12px;
  height: 12px;
  border-radius: 2px;
}

.legend-line {
  width: 16px;
  height: 3px;
  border-radius: 2px;
}

.legend-label {
  white-space: nowrap;
}

.explanation {
  text-align: center;
  color: var(--color-gray-700);
  font-size: 1rem;
  line-height: 1.6;
  margin-top: 1rem;
  padding: 0.75rem 1rem;
  min-height: 3rem;
}

.hint {
  text-align: center;
  color: var(--color-gray-400);
  font-size: 0.875rem;
  margin-top: auto;
  padding-top: 1rem;
}

kbd {
  background: var(--color-gray-100);
  padding: 0.2em 0.5em;
  border-radius: 4px;
  font-family: inherit;
  font-size: 0.9em;
}
</style>
