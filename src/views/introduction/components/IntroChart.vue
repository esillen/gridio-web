<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, computed } from 'vue'
import type { HourlyData } from '../introSimulation'

export interface ChartSeries {
  key: keyof HourlyData
  label: string
  color: string
  type: 'area' | 'line'
}

const props = defineProps<{
  data: HourlyData[]
  series: ChartSeries[]
  maxY?: number
}>()

const canvasRef = ref<HTMLCanvasElement>()
let ctx: CanvasRenderingContext2D | null = null
let cssWidth = 0
let cssHeight = 0

const computedMaxY = computed(() => {
  if (props.maxY) return props.maxY
  
  let max = 0
  for (const d of props.data) {
    // Calculate stacked area total
    let areaTotal = 0
    for (const s of props.series) {
      if (s.type === 'area') {
        areaTotal += (d[s.key] as number) || 0
      }
    }
    max = Math.max(max, areaTotal)
    
    // Also check line values
    for (const s of props.series) {
      if (s.type === 'line') {
        max = Math.max(max, (d[s.key] as number) || 0)
      }
    }
  }
  return Math.ceil(max / 2000) * 2000 + 2000
})

function draw() {
  if (!canvasRef.value || !ctx || cssWidth === 0) return
  
  const width = cssWidth
  const height = cssHeight
  const padding = { top: 20, right: 20, bottom: 40, left: 60 }
  const chartWidth = width - padding.left - padding.right
  const chartHeight = height - padding.top - padding.bottom
  
  // Clear
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, width, height)
  
  const maxY = computedMaxY.value
  
  // Draw grid
  ctx.strokeStyle = '#e5e7eb'
  ctx.lineWidth = 1
  
  // Horizontal grid lines
  const yTicks = 5
  for (let i = 0; i <= yTicks; i++) {
    const y = padding.top + (chartHeight * i / yTicks)
    ctx.beginPath()
    ctx.moveTo(padding.left, y)
    ctx.lineTo(width - padding.right, y)
    ctx.stroke()
    
    // Y-axis labels
    const value = maxY - (maxY * i / yTicks)
    ctx.fillStyle = '#6b7280'
    ctx.font = '11px system-ui'
    ctx.textAlign = 'right'
    ctx.fillText(`${(value / 1000).toFixed(0)} GW`, padding.left - 8, y + 4)
  }
  
  // X-axis line
  ctx.strokeStyle = '#9ca3af'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(padding.left, padding.top + chartHeight)
  ctx.lineTo(width - padding.right, padding.top + chartHeight)
  ctx.stroke()
  
  // X-axis labels and ticks (every 4 hours)
  ctx.fillStyle = '#6b7280'
  ctx.font = '11px system-ui'
  ctx.textAlign = 'center'
  for (let hour = 0; hour <= 24; hour += 4) {
    const x = padding.left + hour * chartWidth / 24
    
    // Tick mark
    ctx.strokeStyle = '#9ca3af'
    ctx.beginPath()
    ctx.moveTo(x, padding.top + chartHeight)
    ctx.lineTo(x, padding.top + chartHeight + 5)
    ctx.stroke()
    
    // Label
    ctx.fillText(`${hour.toString().padStart(2, '0')}:00`, x, padding.top + chartHeight + 18)
  }
  
  // Collect areas and lines separately
  const areaSeries = props.series.filter(s => s.type === 'area')
  const lineSeries = props.series.filter(s => s.type === 'line')
  
  // Helper to get x position for an hour
  const getX = (hour: number) => padding.left + (hour + 0.5) * chartWidth / 24
  const baseY = padding.top + chartHeight
  
  // Pre-compute cumulative values for stacking
  const cumulativeValues: number[][] = []
  for (let hour = 0; hour < 24; hour++) {
    const d = props.data[hour]
    if (!d) {
      cumulativeValues.push([])
      continue
    }
    
    let cumulative = 0
    const values: number[] = []
    for (const series of areaSeries) {
      cumulative += (d[series.key] as number) || 0
      values.push(cumulative)
    }
    cumulativeValues.push(values)
  }
  
  // Draw stacked areas (in reverse order so first series is on bottom)
  for (let i = areaSeries.length - 1; i >= 0; i--) {
    const series = areaSeries[i]!
    ctx.fillStyle = series.color
    ctx.beginPath()
    
    // Draw top edge (left to right)
    let started = false
    for (let hour = 0; hour < 24; hour++) {
      const vals = cumulativeValues[hour]
      if (!vals || vals.length === 0) continue
      
      const cumVal = vals[i] ?? 0
      const x = getX(hour)
      const y = baseY - (cumVal / maxY) * chartHeight
      
      if (!started) {
        ctx.moveTo(x, y)
        started = true
      } else {
        ctx.lineTo(x, y)
      }
    }
    
    // Draw bottom edge (right to left)
    for (let hour = 23; hour >= 0; hour--) {
      const vals = cumulativeValues[hour]
      if (!vals || vals.length === 0) continue
      
      const prevCumVal = i > 0 ? (vals[i - 1] ?? 0) : 0
      const x = getX(hour)
      const y = baseY - (prevCumVal / maxY) * chartHeight
      
      ctx.lineTo(x, y)
    }
    
    ctx.closePath()
    ctx.fill()
  }
  
  // Draw lines on top
  for (const series of lineSeries) {
    ctx.strokeStyle = series.color
    ctx.lineWidth = 3
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.beginPath()
    
    let started = false
    for (let hour = 0; hour < 24; hour++) {
      const d = props.data[hour]
      if (!d) continue
      
      const value = (d[series.key] as number) || 0
      const x = getX(hour)
      const y = baseY - (value / maxY) * chartHeight
      
      if (!started) {
        ctx.moveTo(x, y)
        started = true
      } else {
        ctx.lineTo(x, y)
      }
    }
    ctx.stroke()
  }
}

function setupCanvas() {
  if (!canvasRef.value) return
  
  const canvas = canvasRef.value
  const rect = canvas.getBoundingClientRect()
  const dpr = window.devicePixelRatio || 1
  
  cssWidth = rect.width
  cssHeight = rect.height
  
  canvas.width = rect.width * dpr
  canvas.height = rect.height * dpr
  
  ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.scale(dpr, dpr)
  }
  
  draw()
}

onMounted(() => {
  setupCanvas()
  
  const resizeObserver = new ResizeObserver(() => {
    setupCanvas()
  })
  
  if (canvasRef.value) {
    resizeObserver.observe(canvasRef.value)
  }
  
  onUnmounted(() => {
    resizeObserver.disconnect()
  })
})

watch(() => [props.data, props.series, props.maxY], draw, { deep: true })
</script>

<template>
  <canvas ref="canvasRef" class="chart-canvas"></canvas>
</template>

<style scoped>
.chart-canvas {
  width: 100%;
  height: 100%;
  display: block;
}
</style>
