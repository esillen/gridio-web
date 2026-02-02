<script setup lang="ts">
import { computed } from 'vue'
import IntroChart from '../components/IntroChart.vue'
import type { ChartSeries } from '../components/IntroChart.vue'
import { DEMAND_CATEGORIES, type HourlyData } from '../introSimulation'

const props = defineProps<{
  data: HourlyData[]
  step: number
}>()

const emit = defineEmits<{
  (e: 'maxSteps', value: number): void
}>()

const maxSteps = DEMAND_CATEGORIES.length + 1 // +1 for initial empty state
emit('maxSteps', maxSteps)

const visibleCategories = computed(() => {
  return DEMAND_CATEGORIES.slice(0, props.step)
})

const series = computed<ChartSeries[]>(() => {
  return visibleCategories.value.map(cat => ({
    key: cat.key,
    label: cat.label,
    color: cat.color,
    type: 'area' as const,
  }))
})

const currentCategory = computed(() => {
  if (props.step === 0) return null
  return DEMAND_CATEGORIES[props.step - 1] || null
})

const explanation = computed(() => {
  if (props.step === 0) {
    return 'The electricity grid serves millions of consumers. Let\'s see what uses electricity throughout a typical winter day.'
  }
  
  const cat = currentCategory.value
  if (!cat) return ''
  
  const explanations: Record<string, string> = {
    heating: 'Space heating is the largest consumer in winter. Heat pumps and electric radiators follow outdoor temperature and daily patterns.',
    industry: 'Industry runs around the clock but with reduced activity at night. Steel mills, paper mills, and data centers are major consumers.',
    services: 'Offices, shops, and public buildings consume electricity mainly during business hours.',
    nonHeating: 'Hot water, cooking, lighting, and appliances create peaks in morning and evening when people are home.',
    transport: 'Electric trains and EV charging follow commuter patterns, with a second peak for overnight home charging.',
    losses: 'About 3-4% of electricity is lost in transmission and distribution. Losses increase with load.',
  }
  
  return explanations[cat.key] || ''
})

const title = computed(() => {
  if (props.step === 0) return 'Electricity Consumption'
  return currentCategory.value?.label || 'Electricity Consumption'
})
</script>

<template>
  <div class="slide">
    <h2 class="slide-title">{{ title }}</h2>
    
    <div class="chart-container">
      <IntroChart 
        :data="data" 
        :series="series"
        :maxY="22000"
      />
    </div>
    
    <div class="legend" v-if="visibleCategories.length > 0">
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
</template>

<style scoped>
.slide {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 1rem;
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
  border-radius: 12px;
  padding: 1rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
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
  background: var(--color-gray-100);
  color: var(--color-gray-900);
  font-weight: 500;
}

.legend-color {
  width: 12px;
  height: 12px;
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
  padding: 0 1rem;
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
