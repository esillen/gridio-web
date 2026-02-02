<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import uPlot from 'uplot'
import 'uplot/dist/uPlot.min.css'
import type { BalancingSnapshot } from '../game/WorldSimulation'
import { DAY_DURATION_SECONDS } from '../game/GameState'

const props = defineProps<{
  history: BalancingSnapshot[]
  version: number
}>()

const chartEl = ref<HTMLDivElement>()
let chart: uPlot | null = null

const COLORS = {
  fcr: '#10B981',
  afrr: '#3B82F6',
  mfrr: '#F59E0B',
  frequency: '#6366F1',
  axis: '#6b7280',
  grid: '#e5e7eb',
  zeroLine: '#9CA3AF',
}

function formatHours(hours: number): string {
  const h = Math.floor(hours)
  const m = Math.floor((hours - h) * 60)
  const s = Math.floor(((hours - h) * 60 - m) * 60)
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

function buildData(): uPlot.AlignedData {
  const times: number[] = []
  const fcr: number[] = []
  const afrr: number[] = []
  const mfrr: number[] = []
  const frequency: number[] = []

  for (const s of props.history) {
    times.push(s.time / 3600)
    fcr.push(s.fcrMW)
    afrr.push(s.afrrMW)
    mfrr.push(s.mfrrMW)
    frequency.push(s.frequencyHz)
  }

  return [times, fcr, afrr, mfrr, frequency]
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
        auto: true,
      },
      freq: {
        auto: false,
        range: () => [49.5, 50.5],
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
        label: 'Reserve Activation (MW)',
        font: '12px system-ui',
        labelFont: '12px system-ui',
      },
      {
        scale: 'freq',
        stroke: COLORS.frequency,
        side: 1,
        grid: { show: false },
        ticks: { stroke: COLORS.grid },
        label: 'Frequency (Hz)',
        font: '12px system-ui',
        labelFont: '12px system-ui',
        values: (_, vals) => vals.map(v => v.toFixed(2)),
      },
    ],
    series: [
      {
        label: 'Time',
        value: (_, v) => v != null ? formatHours(v) : '--',
      },
      {
        label: 'FCR',
        stroke: COLORS.fcr,
        width: 2,
        fill: COLORS.fcr + '40',
        value: (_, v) => v != null ? `${v.toFixed(0)} MW` : '--',
      },
      {
        label: 'aFRR',
        stroke: COLORS.afrr,
        width: 2,
        fill: COLORS.afrr + '40',
        value: (_, v) => v != null ? `${v.toFixed(0)} MW` : '--',
      },
      {
        label: 'mFRR',
        stroke: COLORS.mfrr,
        width: 2,
        fill: COLORS.mfrr + '40',
        value: (_, v) => v != null ? `${v.toFixed(0)} MW` : '--',
      },
      {
        label: 'Frequency',
        scale: 'freq',
        stroke: COLORS.frequency,
        width: 1,
        dash: [4, 4],
        value: (_, v) => v != null ? `${v.toFixed(3)} Hz` : '--',
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

          // Draw zero line for reserve MW
          const y0 = u.valToPos(0, 'y', true)
          ctx.strokeStyle = COLORS.zeroLine
          ctx.lineWidth = 1
          ctx.setLineDash([2, 2])
          ctx.beginPath()
          ctx.moveTo(left, y0)
          ctx.lineTo(left + width, y0)
          ctx.stroke()
          ctx.setLineDash([])

          // Draw 50 Hz reference line
          const y50 = u.valToPos(50.0, 'freq', true)
          ctx.strokeStyle = COLORS.frequency + '60'
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
