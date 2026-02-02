<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import uPlot from 'uplot'
import 'uplot/dist/uPlot.min.css'
import type { FrequencySnapshot } from '../game/WorldSimulation'
import { DAY_DURATION_SECONDS } from '../game/GameState'

const props = defineProps<{
  history: FrequencySnapshot[]
  version: number
}>()

const chartEl = ref<HTMLDivElement>()
let chart: uPlot | null = null

const COLORS = {
  frequency: '#10B981',
  rocof: '#F59E0B',
  imbalance: '#EF4444',
  normalBand: '#D1FAE5',
  alertBand: '#FEF3C7',
  emergencyBand: '#FEE2E2',
  axis: '#6b7280',
  grid: '#e5e7eb',
}

function formatHours(hours: number): string {
  const h = Math.floor(hours)
  const m = Math.floor((hours - h) * 60)
  const s = Math.floor(((hours - h) * 60 - m) * 60)
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

function buildData(): uPlot.AlignedData {
  const times: number[] = []
  const frequency: number[] = []
  const imbalance: number[] = []

  for (const s of props.history) {
    times.push(s.time / 3600)
    frequency.push(s.frequencyHz)
    imbalance.push(s.imbalanceMW)
  }

  return [times, frequency, imbalance]
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
      y: {
        auto: false,
        range: () => [49.0, 51.0],
      },
      imbalance: {
        auto: true,
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
        stroke: COLORS.frequency,
        grid: { stroke: COLORS.grid },
        ticks: { stroke: COLORS.grid },
        label: 'Frequency (Hz)',
        font: '12px system-ui',
        labelFont: '12px system-ui',
        values: (_, vals) => vals.map(v => v.toFixed(2)),
      },
      {
        scale: 'imbalance',
        stroke: COLORS.imbalance,
        side: 1,
        grid: { show: false },
        ticks: { stroke: COLORS.grid },
        label: 'Imbalance (MW)',
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
        label: 'Frequency',
        stroke: COLORS.frequency,
        width: 2,
        value: (_, v) => v != null ? `${v.toFixed(3)} Hz` : '--',
      },
      {
        label: 'Imbalance',
        scale: 'imbalance',
        stroke: COLORS.imbalance,
        width: 1,
        value: (_, v) => v != null ? `${v.toFixed(0)} MW` : '--',
      },
    ],
    legend: {
      show: true,
    },
    cursor: {
      show: true,
    },
    hooks: {
      drawAxes: [
        (u: uPlot) => {
          const ctx = u.ctx
          const { left, width } = u.bbox

          // Normal band (49.9 - 50.1 Hz)
          const y1 = u.valToPos(50.1, 'y', true)
          const y2 = u.valToPos(49.9, 'y', true)
          ctx.fillStyle = COLORS.normalBand
          ctx.fillRect(left, y1, width, y2 - y1)

          // 50 Hz line
          const y50 = u.valToPos(50.0, 'y', true)
          ctx.strokeStyle = '#059669'
          ctx.lineWidth = 1
          ctx.setLineDash([4, 4])
          ctx.beginPath()
          ctx.moveTo(left, y50)
          ctx.lineTo(left + width, y50)
          ctx.stroke()
          ctx.setLineDash([])
        },
      ],
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
