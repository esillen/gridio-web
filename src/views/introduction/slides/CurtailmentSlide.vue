<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import IntroChart from '../components/IntroChart.vue'
import type { ChartSeries } from '../components/IntroChart.vue'
import { getTotalConsumption, getTotalProduction } from '../introSimulation'
import type { HourlyData } from '../introSimulation'

const props = defineProps<{
  data: HourlyData[]
  step: number
}>()

const animationProgress = ref(0)
let animationFrame: number | null = null

onMounted(() => {
  animateProgress()
})

onUnmounted(() => {
  if (animationFrame) {
    cancelAnimationFrame(animationFrame)
  }
})

function animateProgress() {
  if (animationProgress.value < 1) {
    animationProgress.value += 0.02
    animationFrame = requestAnimationFrame(animateProgress)
  }
}

const dataWithCurtailment = computed(() => {
  const progress = Math.min(1, animationProgress.value)
  
  return props.data.map(d => {
    const totalConsumption = getTotalConsumption(d)
    const originalProduction = getTotalProduction(d)
    
    // Curtail production to match consumption
    const targetProduction = totalConsumption
    const curtailedProduction = originalProduction + (targetProduction - originalProduction) * progress
    
    return {
      ...d,
      totalConsumption,
      originalProduction,
      curtailedProduction,
    }
  })
})

const series = computed<ChartSeries[]>(() => {
  if (props.step === 0) {
    return [
      {
        key: 'totalConsumption',
        label: 'Consumption',
        color: '#EF4444',
        type: 'line',
      },
      {
        key: 'originalProduction',
        label: 'Production (before)',
        color: '#10B981',
        type: 'line',
        dash: [5, 5],
      },
      {
        key: 'curtailedProduction',
        label: 'Production (curtailed)',
        color: '#10B981',
        type: 'line',
      },
    ]
  }
  return [
    {
      key: 'totalConsumption',
      label: 'Consumption',
      color: '#EF4444',
      type: 'line',
    },
    {
      key: 'curtailedProduction',
      label: 'Production',
      color: '#10B981',
      type: 'line',
    },
  ]
})

const explanationText = computed(() => {
  if (props.step === 0) {
    return {
      main: 'Production must be curtailed to match consumption',
      detail: 'When there\'s excess production (like on windy days), generators must reduce output. This is called curtailment.',
    }
  }
  return {
    main: 'This is done by balancing services',
    detail: 'Grid operators and market participants constantly adjust production and consumption to maintain the balance in real-time.',
  }
})
</script>

<template>
  <div class="slide">
    <h2 class="slide-title">Balancing the Grid</h2>
    
    <div class="chart-container">
      <IntroChart 
        :data="dataWithCurtailment" 
        :series="series"
        :maxY="22000"
      />
    </div>
    
    <div class="legend">
      <div class="legend-item">
        <span class="legend-line" style="background: #EF4444"></span>
        <span class="legend-label">Consumption</span>
      </div>
      <div class="legend-item" v-if="step === 0">
        <span class="legend-line dashed" style="background: #10B981"></span>
        <span class="legend-label">Original Production</span>
      </div>
      <div class="legend-item">
        <span class="legend-line" style="background: #10B981"></span>
        <span class="legend-label">{{ step === 0 ? 'Curtailed Production' : 'Production' }}</span>
      </div>
    </div>
    
    <div class="explanation-box">
      <p class="explanation main">
        {{ explanationText.main }}
      </p>
      <p class="explanation detail">
        {{ explanationText.detail }}
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

.legend-line.dashed {
  background: repeating-linear-gradient(
    to right,
    #10B981 0px,
    #10B981 5px,
    transparent 5px,
    transparent 10px
  ) !important;
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
  font-weight: 500;
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
