<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'
import uPlot from 'uplot'
import 'uplot/dist/uPlot.min.css'
import type { WeatherSnapshot } from '../game/WorldSimulation'
import type { ForecastRegionalOutput } from '../system_model'
import { DAY_DURATION_SECONDS } from '../game/GameState'

const props = defineProps<{
  history: WeatherSnapshot[]
  forecastRegional: ForecastRegionalOutput | null
  currentTime: number
  version: number
}>()

const chartEl = ref<HTMLDivElement>()
let chart: uPlot | null = null

const COLORS = {
  temperature: '#F2555D',
  wind: '#4467FE',
  solar: '#FFC877',
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
  const temp: number[] = []
  const tempFc: (number | null)[] = []
  const wind: number[] = []
  const windFc: (number | null)[] = []
  const solar: number[] = []
  const solarFc: (number | null)[] = []

  // Current weather history (solid lines) – use synoptic + aggregate solar
  for (const s of props.history) {
    times.push(s.time / 3600)
    temp.push(s.current.synoptic.temperatureC)
    wind.push(s.current.synoptic.windMps)
    const solarAvg = s.current.solarSites.length
      ? s.current.solarSites.reduce((a, site) => a + site.solarIrradianceWm2, 0) / s.current.solarSites.length
      : 0
    solar.push(solarAvg / 10)
    tempFc.push(null)
    windFc.push(null)
    solarFc.push(null)
  }

  // Add forecast data (dotted lines) from current time forward
  if (props.forecastRegional && props.currentTime > 0) {
    const fc = props.forecastRegional
    const currentTimeHours = props.currentTime / 3600
    const resolutionS = fc.stepS
    const maxForecastHours = 24 - currentTimeHours
    const N = fc.forecastWindSpeed100mMpsByRegion[0]?.length ?? 0

    for (let i = 0; i < N; i += 5) {
      const deltaS = i * resolutionS
      const forecastTimeHours = currentTimeHours + deltaS / 3600
      if (forecastTimeHours > 24 || deltaS > maxForecastHours * 3600) break
      if (forecastTimeHours <= currentTimeHours) continue
      times.push(forecastTimeHours)
      const tAvg = fc.forecastTemperatureCByWindRegion.reduce((s, row) => s + (row[i] ?? 0), 0) / 8
      const wAvg = fc.forecastWindSpeed100mMpsByRegion.reduce((s, row) => s + (row[i] ?? 0), 0) / 8
      const solAvg = fc.forecastSolarIrradianceWm2BySite.reduce((s, row) => s + (row[i] ?? 0), 0) / 2
      tempFc.push(tAvg)
      windFc.push(wAvg)
      solarFc.push(solAvg / 10)
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
        values: (_, vals) => vals.map(v => formatHours(v)),
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
      {
        label: 'Time',
        value: (_, v) => v != null ? formatHours(v) : '--',
      },
      {
        label: 'Temp',
        stroke: COLORS.temperature,
        width: 2,
        scale: 'temp',
        value: (_, v) => v != null ? `${v.toFixed(1)}°C` : '--',
      },
      {
        label: 'Temp (fc)',
        stroke: COLORS.temperature,
        width: 2,
        dash: [5, 5],
        scale: 'temp',
        value: (_, v) => v != null ? `${v.toFixed(1)}°C` : '--',
      },
      {
        label: 'Wind',
        stroke: COLORS.wind,
        width: 2,
        scale: 'wind',
        value: (_, v) => v != null ? `${v.toFixed(1)} m/s` : '--',
      },
      {
        label: 'Wind (fc)',
        stroke: COLORS.wind,
        width: 2,
        dash: [5, 5],
        scale: 'wind',
        value: (_, v) => v != null ? `${v.toFixed(1)} m/s` : '--',
      },
      {
        label: 'Solar/10',
        stroke: COLORS.solar,
        width: 2,
        scale: 'solar',
        value: (_, v) => v != null ? `${(v * 10).toFixed(0)} W/m²` : '--',
      },
      {
        label: 'Solar/10 (fc)',
        stroke: COLORS.solar,
        width: 2,
        dash: [5, 5],
        scale: 'solar',
        value: (_, v) => v != null ? `${(v * 10).toFixed(0)} W/m²` : '--',
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
