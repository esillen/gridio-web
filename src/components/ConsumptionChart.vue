<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import uPlot from 'uplot'
import 'uplot/dist/uPlot.min.css'
import type { ConsumptionSnapshot } from '../game/WorldSimulation'
import { DAY_DURATION_SECONDS } from '../game/GameState'

const props = defineProps<{
  history: ConsumptionSnapshot[]
  version: number
}>()

const chartEl = ref<HTMLDivElement>()
let chart: uPlot | null = null

const COLORS = {
  heating: '#F2555D',
  industry: '#8B5CF6',
  nonHeating: '#F0A679',
  services: '#4467FE',
  transport: '#55D379',
  axis: '#6b7280',
  grid: '#e5e7eb',
}

function formatHours(hours: number): string {
  const h = Math.floor(hours)
  const m = Math.floor((hours - h) * 60)
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
}

// Build stacked data: heating (bottom), industry, services, non-heating, transport (top)
function buildData(): uPlot.AlignedData {
  const times: number[] = []
  const heating: number[] = []
  const industry: number[] = []
  const services: number[] = []
  const nonHeating: number[] = []
  const transport: number[] = []

  for (const s of props.history) {
    times.push(s.time / 3600)
    // Cumulative stacking from bottom to top
    const heatingVal = s.heatingMW
    const industryVal = heatingVal + s.industryMW
    const servicesVal = industryVal + s.servicesMW
    const nonHeatingVal = servicesVal + s.nonHeatingMW
    const transportVal = nonHeatingVal + s.transportMW
    
    heating.push(heatingVal)
    industry.push(industryVal)
    services.push(servicesVal)
    nonHeating.push(nonHeatingVal)
    transport.push(transportVal)
  }

  // Order: time, then top-to-bottom for rendering
  return [times, transport, nonHeating, services, industry, heating]
}

function stackedAreaPaths(u: uPlot, seriesIdx: number, idx0: number, idx1: number): uPlot.Series.Paths | null {
  const xdata = u.data[0]
  const ydata = u.data[seriesIdx]
  if (!xdata || !ydata) return null
  
  // Get the data for the series below (if any)
  const belowIdx = seriesIdx + 1
  const belowData = belowIdx < u.series.length ? u.data[belowIdx] : null
  
  const stroke = new Path2D()
  const fill = new Path2D()
  
  let firstX: number | null = null
  
  // Draw top line left to right
  for (let i = idx0; i <= idx1; i++) {
    const xVal = xdata[i]
    const yVal = ydata[i]
    if (xVal === undefined) continue
    const x = u.valToPos(xVal, 'x', true)
    const y = u.valToPos(yVal ?? 0, 'y', true)
    
    if (firstX === null) {
      stroke.moveTo(x, y)
      fill.moveTo(x, y)
      firstX = x
    } else {
      stroke.lineTo(x, y)
      fill.lineTo(x, y)
    }
  }
  
  // For fill: go back along the bottom edge (either previous series or zero line)
  for (let i = idx1; i >= idx0; i--) {
    const xVal = xdata[i]
    if (xVal === undefined) continue
    const x = u.valToPos(xVal, 'x', true)
    const y = belowData 
      ? u.valToPos(belowData[i] ?? 0, 'y', true)
      : u.valToPos(0, 'y', true)
    fill.lineTo(x, y)
  }
  
  fill.closePath()
  
  return {
    stroke,
    fill,
  }
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
        label: 'Consumption (MW)',
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
        label: 'Transport',
        stroke: COLORS.transport,
        fill: COLORS.transport + '80',
        width: 1,
        paths: stackedAreaPaths,
        value: (u, v, si, i) => {
          if (v == null || i == null) return '--'
          const below = u.data[si + 1]?.[i] ?? 0
          return `${(v - below).toFixed(0)} MW`
        },
      },
      {
        label: 'Non-Heating',
        stroke: COLORS.nonHeating,
        fill: COLORS.nonHeating + '80',
        width: 1,
        paths: stackedAreaPaths,
        value: (u, v, si, i) => {
          if (v == null || i == null) return '--'
          const below = u.data[si + 1]?.[i] ?? 0
          return `${(v - below).toFixed(0)} MW`
        },
      },
      {
        label: 'Services',
        stroke: COLORS.services,
        fill: COLORS.services + '80',
        width: 1,
        paths: stackedAreaPaths,
        value: (u, v, si, i) => {
          if (v == null || i == null) return '--'
          const below = u.data[si + 1]?.[i] ?? 0
          return `${(v - below).toFixed(0)} MW`
        },
      },
      {
        label: 'Industry',
        stroke: COLORS.industry,
        fill: COLORS.industry + '80',
        width: 1,
        paths: stackedAreaPaths,
        value: (u, v, si, i) => {
          if (v == null || i == null) return '--'
          const below = u.data[si + 1]?.[i] ?? 0
          return `${(v - below).toFixed(0)} MW`
        },
      },
      {
        label: 'Heating',
        stroke: COLORS.heating,
        fill: COLORS.heating + '80',
        width: 1,
        paths: stackedAreaPaths,
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
