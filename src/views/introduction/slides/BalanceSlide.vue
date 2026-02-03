<script setup lang="ts">
import { computed } from 'vue'
import IntroChart from '../components/IntroChart.vue'
import type { ChartSeries } from '../components/IntroChart.vue'
import { getTotalConsumption, getTotalProduction, type HourlyData } from '../introSimulation'

const props = defineProps<{
  data: HourlyData[]
}>()

// Add totals to each data point
const dataWithTotals = computed(() => {
  return props.data.map(d => ({
    ...d,
    totalConsumption: getTotalConsumption(d),
    totalProduction: getTotalProduction(d),
  }))
})

const series = computed<ChartSeries[]>(() => [
  {
    key: 'totalConsumption' as keyof HourlyData,
    label: 'Total Consumption',
    color: '#EF4444',
    type: 'line',
  },
  {
    key: 'totalProduction' as keyof HourlyData,
    label: 'Total Production',
    color: '#10B981',
    type: 'line',
  },
])
</script>

<template>
  <div class="slide">
    <h2 class="slide-title">The Balance Challenge</h2>
    
    <div class="chart-container">
      <IntroChart 
        :data="(dataWithTotals as unknown as Record<string, number>[])" 
        :series="series"
        :maxY="22000"
      />
    </div>
    
    <div class="legend">
      <div class="legend-item">
        <span class="legend-line" style="background: #EF4444"></span>
        <span class="legend-label">Consumption</span>
      </div>
      <div class="legend-item">
        <span class="legend-line" style="background: #10B981"></span>
        <span class="legend-label">Production</span>
      </div>
    </div>
    
    <div class="explanation-box">
      <p class="explanation main">
        At every moment, production must <strong>exactly</strong> match consumption.
      </p>
      <p class="explanation detail">
        When they don't match, the grid frequency deviates from 50 Hz. Too much deviation causes equipment damage and blackouts.
      </p>
    </div>
    
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
  gap: 1.5rem;
  justify-content: center;
  margin-top: 1rem;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  color: var(--color-gray-700);
  font-weight: 500;
}

.legend-line {
  width: 20px;
  height: 3px;
  border-radius: 2px;
}

.explanation-box {
  text-align: center;
  margin-top: 1rem;
  padding: 1rem;
  background: white;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.explanation {
  color: var(--color-gray-700);
  line-height: 1.6;
}

.explanation.main {
  font-size: 1.125rem;
  margin-bottom: 0.5rem;
}

.explanation.main strong {
  color: var(--gridio-sky-vivid);
}

.explanation.detail {
  font-size: 0.925rem;
  color: var(--color-gray-500);
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
