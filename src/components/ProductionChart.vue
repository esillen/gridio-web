<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import uPlot from 'uplot'
import 'uplot/dist/uPlot.min.css'
import type { ProductionSnapshot } from '../game/WorldSimulation'
import { DAY_DURATION_SECONDS } from '../game/GameState'

const props = defineProps<{
  history: ProductionSnapshot[]
  version: number
}>()

const chartEl = ref<HTMLDivElement>()
let chart: uPlot | null = null

const COLORS = {
  nuclear: '#F0A679',
  hydro: '#4467FE',
  total: '#55D379',
  axis: '#6b7280',
  grid: '#e5e7eb',
}

function formatHours(hours: number): string {
  const h = Math.floor(hours)
  const m = Math.floor((hours - h) * 60)
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
}

function buildData(): uPlot.AlignedData {
  const times: number[] = []
  const nuclear: number[] = []
  const hydro: number[] = []
  const total: number[] = []

  for (const s of props.history) {
    times.push(s.time / 3600)
    nuclear.push(s.nuclearMW)
    hydro.push(s.hydroMW)
    total.push(s.totalMW)
  }

  return [times, nuclear, hydro, total]
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
        stroke: COLORS.axis,
        grid: { stroke: COLORS.grid },
        ticks: { stroke: COLORS.grid },
        values: (_, vals) => vals.map(v => formatHours(v)),
        font: '12px system-ui',
      },
      {
        stroke: COLORS.axis,
        grid: { stroke: COLORS.grid },
        ticks: { stroke: COLORS.grid },
        label: 'Production (MW)',
        font: '12px system-ui',
        labelFont: '12px system-ui',
      },
    ],
    series: [
      {
        label: 'Time',
        value: (_, v) => v != null ? formatHours(v) : '--',
      },
      {
        label: 'Nuclear',
        stroke: COLORS.nuclear,
        width: 2,
        value: (_, v) => v != null ? `${v.toFixed(0)} MW` : '--',
      },
      {
        label: 'Hydro',
        stroke: COLORS.hydro,
        width: 2,
        value: (_, v) => v != null ? `${v.toFixed(0)} MW` : '--',
      },
      {
        label: 'Total',
        stroke: COLORS.total,
        width: 2,
        dash: [5, 5],
        value: (_, v) => v != null ? `${v.toFixed(0)} MW` : '--',
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
  font-size: 12px;
}

.chart :deep(.u-legend .u-series) {
  padding: 2px 8px;
}

.chart :deep(.u-legend .u-label) {
  color: #374151;
}

.chart :deep(.u-legend .u-value) {
  color: #6b7280;
}
</style>
