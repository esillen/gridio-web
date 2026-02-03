<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import uPlot from 'uplot'
import 'uplot/dist/uPlot.min.css'
import { gameState } from '../game/GameState'

const props = defineProps<{
  version: number
}>()

const chartEl = ref<HTMLDivElement>()
let chart: uPlot | null = null

const COLORS = {
  bid: '#3b82f6',
  delivered: '#f59e0b',
  axis: '#6b7280',
  grid: '#e5e7eb',
}

function formatHours(hours: number): string {
  const h = Math.floor(hours)
  return `${h.toString().padStart(2, '0')}:00`
}

function buildData(): uPlot.AlignedData {
  const times: number[] = []
  const bids: number[] = []
  const requiredMWh: number[] = []
  const deliveredMWh: number[] = []
  const failedMWh: number[] = []
  
  const currentHour = Math.floor(gameState.currentTime / 3600)
  const performance = gameState.bessPerformance.fcrPerformance
  
  for (let h = 0; h < 24; h++) {
    times.push(h)
    bids.push(performance[h]?.allocatedMW ?? 0)
    
    if (h <= currentHour) {
      requiredMWh.push(performance[h]?.requiredMWh ?? 0)
      deliveredMWh.push(performance[h]?.deliveredMWh ?? 0)
      failedMWh.push(performance[h]?.failedMWh ?? 0)
    } else {
      requiredMWh.push(NaN)
      deliveredMWh.push(NaN)
      failedMWh.push(NaN)
    }
  }
  
  return [times, bids, requiredMWh, deliveredMWh, failedMWh]
}

function getOpts(width: number, height: number): uPlot.Options {
  return {
    width,
    height,
    padding: [10, 10, 0, 0],
    cursor: { show: true },
    legend: { show: true },
    scales: {
      x: { time: false, min: 0, max: 24 },
      mw: { auto: true },
      mwh: { auto: true },
    },
    axes: [
      {
        stroke: COLORS.axis,
        grid: { stroke: COLORS.grid, width: 1 },
        ticks: { stroke: COLORS.grid },
        values: (_u, vals) => vals.map(v => formatHours(v)),
        gap: 5,
        size: 30,
      },
      {
        scale: 'mw',
        stroke: COLORS.bid,
        grid: { stroke: COLORS.grid, width: 1 },
        ticks: { stroke: COLORS.grid },
        values: (_u, vals) => vals.map(v => `${v.toFixed(0)}`),
        gap: 5,
        size: 50,
        label: 'MW',
        labelSize: 12,
      },
      {
        scale: 'mwh',
        side: 1,
        stroke: '#ef4444',
        grid: { show: false },
        ticks: { stroke: '#ef4444' },
        values: (_u, vals) => vals.map(v => `${v.toFixed(1)}`),
        gap: 5,
        size: 50,
        label: 'MWh',
        labelSize: 12,
      },
    ],
    series: [
      {},
      {
        label: 'FCR Capacity (MW)',
        scale: 'mw',
        stroke: COLORS.bid,
        width: 2,
        fill: COLORS.bid + '30',
        paths: uPlot.paths.bars!({ size: [0.6, 100] }),
      },
      {
        label: 'Required (MWh)',
        scale: 'mwh',
        stroke: '#9ca3af',
        width: 2,
        dash: [4, 4],
      },
      {
        label: 'Delivered (MWh)',
        scale: 'mwh',
        stroke: '#10b981',
        width: 2,
        points: { show: true, size: 4, fill: '#10b981' },
      },
      {
        label: 'Failed (MWh)',
        scale: 'mwh',
        stroke: '#ef4444',
        width: 3,
        points: { show: true, size: 6, fill: '#ef4444' },
      },
    ],
  }
}

function createChart() {
  if (!chartEl.value) return
  if (chart) {
    chart.destroy()
    chart = null
  }
  
  const rect = chartEl.value.getBoundingClientRect()
  const opts = getOpts(rect.width, rect.height)
  chart = new uPlot(opts, buildData(), chartEl.value)
}

function updateChart() {
  if (!chart) return
  chart.setData(buildData())
}

const resizeObserver = new ResizeObserver(() => {
  if (chart && chartEl.value) {
    const rect = chartEl.value.getBoundingClientRect()
    chart.setSize({ width: rect.width, height: rect.height })
  }
})

onMounted(() => {
  createChart()
  if (chartEl.value) {
    resizeObserver.observe(chartEl.value)
  }
})

onUnmounted(() => {
  resizeObserver.disconnect()
  if (chart) {
    chart.destroy()
    chart = null
  }
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
</style>
