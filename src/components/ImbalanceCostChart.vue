<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import uPlot from 'uplot'
import 'uplot/dist/uPlot.min.css'
import type { SettlementSnapshot } from '../system_model'

const props = defineProps<{
  history: SettlementSnapshot[]
}>()

const chartEl = ref<HTMLDivElement>()
let chart: uPlot | null = null

const COLORS = {
  price: '#8b5cf6',
  paid: '#ef4444',
  axis: '#6b7280',
  grid: '#e5e7eb',
}

function formatHours(hours: number): string {
  const h = Math.floor(hours)
  return `${h.toString().padStart(2, '0')}:00`
}

function buildData(): uPlot.AlignedData {
  const t: number[] = []
  const price: number[] = []
  const paid: number[] = []

  for (const s of props.history) {
    t.push(s.time / 3600)
    price.push(s.settlementPriceEurPerMWh)
    paid.push(Math.max(0, -s.totalImbalanceCashflowEur))
  }

  return [t, price, paid]
}

type RangeSpec = { price: { min: number; max: number }; paid: { min: number; max: number } }

function computeAlignedRanges(): RangeSpec {
  const priceVals = props.history.map(s => s.settlementPriceEurPerMWh).filter(v => Number.isFinite(v))
  const paidVals = props.history.map(s => Math.max(0, -s.totalImbalanceCashflowEur)).filter(v => Number.isFinite(v))

  const pMin = priceVals.length ? Math.min(...priceVals) : 0
  const pMax = priceVals.length ? Math.max(...priceVals) : 0
  const cMin = paidVals.length ? Math.min(...paidVals) : 0
  const cMax = paidVals.length ? Math.max(...paidVals) : 0

  const globalPos = Math.max(0, pMax, cMax)
  const globalNeg = Math.max(0, -pMin, -cMin)

  // All zeros
  if (globalPos === 0 && globalNeg === 0) {
    return { price: { min: -1, max: 1 }, paid: { min: -1, max: 1 } }
  }

  // Only non-negative values -> place zero at bottom for both axes
  if (globalNeg === 0) {
    const padP = Math.max(1, pMax * 0.05)
    const padC = Math.max(1, cMax * 0.05)
    return {
      price: { min: 0, max: pMax + padP },
      paid: { min: 0, max: cMax + padC },
    }
  }

  // Only non-positive values -> place zero at top for both axes
  if (globalPos === 0) {
    const padP = Math.max(1, (-pMin) * 0.05)
    const padC = Math.max(1, (-cMin) * 0.05)
    return {
      price: { min: pMin - padP, max: 0 },
      paid: { min: cMin - padC, max: 0 },
    }
  }

  // Mixed signs: enforce shared negative/positive ratio so 0 is at same height on both axes.
  const ratio = globalNeg / globalPos
  const pNeg = Math.max(0, -pMin)
  const cNeg = Math.max(0, -cMin)

  let pAxisMax = Math.max(pMax, pNeg / ratio)
  let cAxisMax = Math.max(cMax, cNeg / ratio)
  pAxisMax *= 1.05
  cAxisMax *= 1.05

  return {
    price: { min: -ratio * pAxisMax, max: pAxisMax },
    paid: { min: -ratio * cAxisMax, max: cAxisMax },
  }
}

function getOpts(width: number, height: number): uPlot.Options {
  const ranges = computeAlignedRanges()
  return {
    width,
    height,
    scales: {
      x: { time: false, min: 0, max: 24 },
      price: {
        auto: false,
        range: () => [ranges.price.min, ranges.price.max],
      },
      paid: {
        auto: false,
        range: () => [ranges.paid.min, ranges.paid.max],
      },
    },
    axes: [
      {
        stroke: COLORS.axis,
        grid: { stroke: COLORS.grid },
        ticks: { stroke: COLORS.grid },
        values: (_u, vals) => vals.map(v => formatHours(v)),
      },
      {
        scale: 'price',
        stroke: COLORS.price,
        grid: { stroke: COLORS.grid },
        ticks: { stroke: COLORS.grid },
        label: 'Imbalance Price (EUR/MWh)',
      },
      {
        scale: 'paid',
        side: 1,
        stroke: COLORS.paid,
        grid: { show: false },
        ticks: { stroke: COLORS.grid },
        label: 'Imbalance Paid (EUR)',
      },
    ],
    series: [
      { label: 'Time' },
      {
        label: 'Imbalance Price',
        scale: 'price',
        stroke: COLORS.price,
        width: 2,
      },
      {
        label: 'Imbalance Paid',
        scale: 'paid',
        stroke: COLORS.paid,
        width: 2,
        paths: uPlot.paths.bars!({ size: [0.55, 120] }),
      },
    ],
    legend: { show: true },
    cursor: { show: true },
  }
}

function initChart() {
  if (!chartEl.value) return
  const rect = chartEl.value.getBoundingClientRect()
  chart = new uPlot(getOpts(rect.width, rect.height), buildData(), chartEl.value)
}

function updateChart() {
  if (!chart || !chartEl.value) return
  const rect = chartEl.value.getBoundingClientRect()
  chart.destroy()
  chart = new uPlot(getOpts(rect.width, rect.height), buildData(), chartEl.value)
}

const resizeObserver = new ResizeObserver(() => {
  if (!chart || !chartEl.value) return
  const rect = chartEl.value.getBoundingClientRect()
  chart.setSize({ width: rect.width, height: rect.height })
})

onMounted(() => {
  initChart()
  if (chartEl.value) resizeObserver.observe(chartEl.value)
})

onUnmounted(() => {
  resizeObserver.disconnect()
  chart?.destroy()
  chart = null
})

watch(() => props.history, updateChart, { deep: true })
</script>

<template>
  <div ref="chartEl" class="chart"></div>
</template>

<style scoped>
.chart {
  width: 100%;
  height: 180px;
}
</style>
