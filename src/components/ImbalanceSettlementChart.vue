<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import uPlot from 'uplot'
import 'uplot/dist/uPlot.min.css'
import type { SettlementSnapshot, SettlementForecastOutput } from '../system_model'
import { DAY_DURATION_SECONDS } from '../game/GameState'

const props = defineProps<{
  history: SettlementSnapshot[]
  forecast: SettlementForecastOutput | null
  currentTime: number
  version: number
}>()

const chartEl = ref<HTMLDivElement>()
let chart: uPlot | null = null

const COLORS = {
  settlement: '#8B5CF6',
  forecast: '#F59E0B',
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
  const settlement: number[] = []
  const forecast: number[] = []

  // Historical data from history array
  for (const s of props.history) {
    times.push(s.time / 3600)
    settlement.push(s.settlementPriceEurPerMWh)
    forecast.push(NaN)
  }

  // Add forecast data starting from current time
  if (props.forecast && props.forecast.expectedSettlementPriceEurPerMWh.length > 0) {
    const lastHistoricalPrice = props.history.length > 0 
      ? (props.history[props.history.length - 1]?.settlementPriceEurPerMWh ?? 0)
      : props.forecast.expectedSettlementPriceEurPerMWh[0] ?? 0

    // Add connecting point at current time
    times.push(props.currentTime / 3600)
    settlement.push(NaN)
    forecast.push(lastHistoricalPrice)

    // Add forecast points
    for (let i = 0; i < props.forecast.expectedSettlementPriceEurPerMWh.length; i++) {
      const forecastTimeS = props.currentTime + i * props.forecast.stepS
      const forecastTimeHours = forecastTimeS / 3600
      
      if (forecastTimeHours <= 24) {
        times.push(forecastTimeHours)
        settlement.push(NaN)
        forecast.push(props.forecast.expectedSettlementPriceEurPerMWh[i] ?? 0)
      }
    }
  }

  return [times, settlement, forecast]
}

function getYRange(): [number, number] {
  let min = Infinity
  let max = -Infinity
  
  for (const s of props.history) {
    if (s.settlementPriceEurPerMWh < min) min = s.settlementPriceEurPerMWh
    if (s.settlementPriceEurPerMWh > max) max = s.settlementPriceEurPerMWh
  }
  
  if (props.forecast) {
    for (const p of props.forecast.expectedSettlementPriceEurPerMWh) {
      if (p < min) min = p
      if (p > max) max = p
    }
  }
  
  // Default range if no data
  if (!isFinite(min) || !isFinite(max)) {
    return [0, 100]
  }
  
  // Add 10% padding
  const padding = (max - min) * 0.1 || 10
  return [Math.floor(min - padding), Math.ceil(max + padding)]
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
        range: () => getYRange(),
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
        label: 'EUR/MWh',
        font: '12px system-ui',
        labelFont: '12px system-ui',
        values: (_, vals) => vals.map(v => v.toFixed(0)),
      },
    ],
    series: [
      {
        label: 'Time',
        value: (_, v) => v != null ? formatHours(v) : '--',
      },
      {
        label: 'Settlement Price',
        stroke: COLORS.settlement,
        width: 2,
        value: (_, v) => v != null ? `${v.toFixed(1)} €/MWh` : '--',
      },
      {
        label: 'Forecast',
        stroke: COLORS.forecast,
        width: 2,
        dash: [5, 5],
        value: (_, v) => v != null ? `${v.toFixed(1)} €/MWh` : '--',
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
  if (!chart || !chartEl.value) return
  
  // Recreate chart to update y-axis range
  const rect = chartEl.value.getBoundingClientRect()
  chart.destroy()
  chart = new uPlot(getOpts(rect.width, rect.height), buildData(), chartEl.value)
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
