<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import uPlot from 'uplot'
import 'uplot/dist/uPlot.min.css'
import type { GridSnapshot } from '../game/PowerGrid'
import { DAY_DURATION_SECONDS } from '../game/GameState'

const props = defineProps<{
  history: GridSnapshot[]
  version: number
}>()

const chartEl = ref<HTMLDivElement>()
let chart: uPlot | null = null

function buildData(): uPlot.AlignedData {
  const times: number[] = []
  const production: number[] = []
  const consumption: number[] = []
  const imbalance: number[] = []

  for (const s of props.history) {
    times.push(s.time / 3600) // hours
    production.push(s.production)
    consumption.push(s.consumption)
    imbalance.push(s.imbalance)
  }

  return [times, production, consumption, imbalance]
}

function getOpts(width: number, height: number): uPlot.Options {
  return {
    width,
    height,
    scales: {
      x: {
        auto: false,
        range: () => [0, DAY_DURATION_SECONDS / 3600],
      },
    },
    axes: [
      {
        stroke: '#888',
        grid: { stroke: '#333' },
        ticks: { stroke: '#333' },
        values: (_, vals) => vals.map(v => `${v}h`),
      },
      {
        stroke: '#888',
        grid: { stroke: '#333' },
        ticks: { stroke: '#333' },
        label: 'Power (MW)',
      },
    ],
    series: [
      {},
      {
        label: 'Production',
        stroke: '#00ff88',
        width: 2,
      },
      {
        label: 'Consumption',
        stroke: '#ff6b6b',
        width: 2,
      },
      {
        label: 'Imbalance',
        stroke: '#888888',
        width: 2,
        dash: [5, 5],
      },
    ],
    legend: {
      show: true,
    },
    cursor: {
      show: true,
    },
  }
}

function initChart() {
  if (!chartEl.value) return
  const rect = chartEl.value.getBoundingClientRect()
  const opts = getOpts(rect.width, rect.height)
  chart = new uPlot(opts, buildData(), chartEl.value)
}

function updateChart() {
  if (!chart) return
  chart.setData(buildData())
}

onMounted(() => {
  initChart()
  
  const resizeObserver = new ResizeObserver(() => {
    if (chart && chartEl.value) {
      const rect = chartEl.value.getBoundingClientRect()
      chart.setSize({ width: rect.width, height: rect.height })
    }
  })
  
  if (chartEl.value) {
    resizeObserver.observe(chartEl.value)
  }

  onUnmounted(() => {
    resizeObserver.disconnect()
    chart?.destroy()
  })
})

watch(() => props.version, updateChart)
</script>

<template>
  <div ref="chartEl" class="chart"></div>
</template>

<style scoped>
.chart {
  width: 100%;
  height: 100%;
}

.chart :deep(.u-legend) {
  text-align: left;
  padding: 8px;
}

.chart :deep(.u-legend .u-series) {
  padding: 2px 8px;
}

.chart :deep(.u-legend .u-label) {
  color: #ccc;
}
</style>
