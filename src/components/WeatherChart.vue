<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import uPlot from 'uplot'
import 'uplot/dist/uPlot.min.css'
import type { WeatherSnapshot } from '../game/WorldSimulation'
import { DAY_DURATION_SECONDS } from '../game/GameState'

const props = defineProps<{
  history: WeatherSnapshot[]
  version: number
}>()

const chartEl = ref<HTMLDivElement>()
let chart: uPlot | null = null

const COLORS = {
  temperature: '#F2555D',
  temperatureForecast: '#F2555D',
  wind: '#4467FE',
  windForecast: '#4467FE',
  cloud: '#95957F',
  cloudForecast: '#95957F',
  solar: '#FFC877',
  solarForecast: '#FFC877',
  axis: '#6b7280',
  grid: '#e5e7eb',
}

function buildData(): uPlot.AlignedData {
  const times: number[] = []
  const temp: number[] = []
  const tempFc: (number | null)[] = []
  const wind: number[] = []
  const windFc: (number | null)[] = []
  const solar: number[] = []
  const solarFc: (number | null)[] = []

  for (const s of props.history) {
    times.push(s.time / 3600)
    temp.push(s.current.temperatureC)
    wind.push(s.current.windSpeed100mMps)
    solar.push(s.current.solarIrradianceWm2 / 10) // Scale down for visibility
    tempFc.push(null)
    windFc.push(null)
    solarFc.push(null)
  }

  // Add forecast points (1h ahead from current time)
  const last = props.history[props.history.length - 1]
  if (last) {
    const fcTime = (last.time + 3600) / 3600 // 1h ahead
    if (fcTime <= 24) {
      times.push(fcTime)
      temp.push(last.current.temperatureC) // Bridge point
      wind.push(last.current.windSpeed100mMps)
      solar.push(last.current.solarIrradianceWm2 / 10)
      tempFc.push(last.forecast1h.temperatureC)
      windFc.push(last.forecast1h.windSpeedMps)
      solarFc.push(last.forecast1h.solarIrradianceWm2 / 10)
    }
  }

  return [times, temp, tempFc as number[], wind, windFc as number[], solar, solarFc as number[]]
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
      temp: {
        auto: true,
      },
      wind: {
        auto: true,
      },
      solar: {
        auto: true,
      },
    },
    axes: [
      {
        stroke: COLORS.axis,
        grid: { stroke: COLORS.grid },
        ticks: { stroke: COLORS.grid },
        values: (_, vals) => vals.map(v => `${v}h`),
        font: '12px system-ui',
      },
      {
        scale: 'temp',
        stroke: COLORS.temperature,
        grid: { show: false },
        ticks: { stroke: COLORS.grid },
        label: '°C',
        font: '12px system-ui',
        labelFont: '12px system-ui',
        side: 1,
      },
      {
        scale: 'wind',
        stroke: COLORS.wind,
        grid: { show: false },
        ticks: { stroke: COLORS.grid },
        label: 'm/s',
        font: '12px system-ui',
        labelFont: '12px system-ui',
        side: 3,
      },
    ],
    series: [
      {},
      {
        label: 'Temp',
        stroke: COLORS.temperature,
        width: 2,
        scale: 'temp',
      },
      {
        label: 'Temp (fc)',
        stroke: COLORS.temperatureForecast,
        width: 2,
        dash: [5, 5],
        scale: 'temp',
      },
      {
        label: 'Wind',
        stroke: COLORS.wind,
        width: 2,
        scale: 'wind',
      },
      {
        label: 'Wind (fc)',
        stroke: COLORS.windForecast,
        width: 2,
        dash: [5, 5],
        scale: 'wind',
      },
      {
        label: 'Solar/10',
        stroke: COLORS.solar,
        width: 2,
        scale: 'solar',
      },
      {
        label: 'Solar/10 (fc)',
        stroke: COLORS.solarForecast,
        width: 2,
        dash: [5, 5],
        scale: 'solar',
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
  font-size: 11px;
}

.chart :deep(.u-legend .u-series) {
  padding: 2px 6px;
}

.chart :deep(.u-legend .u-label) {
  color: #374151;
}

.chart :deep(.u-legend .u-value) {
  color: #6b7280;
}
</style>
