<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { gameState } from '../game/GameState'
import { useRouter } from 'vue-router'

const router = useRouter()
const activeChart = ref<'da' | 'fcr'>('da')
const isDragging = ref(false)

onMounted(() => {
  gameState.generateMarketPrices(Date.now())
  window.addEventListener('keydown', handleKeydown)
  window.addEventListener('mouseup', stopDrag)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
  window.removeEventListener('mouseup', stopDrag)
})

function startDay() {
  gameState.startDay()
  router.push('/day')
}

function handleKeydown(e: KeyboardEvent) {
  if (e.code === 'Space') {
    e.preventDefault()
    startDay()
  } else if (e.code === 'Tab') {
    e.preventDefault()
    activeChart.value = activeChart.value === 'da' ? 'fcr' : 'da'
  }
}

function stopDrag() {
  isDragging.value = false
}

const maxPower = computed(() => gameState.bess.maxPowerMW)

function handleBarInteraction(hour: number, event: MouseEvent, chart: 'da' | 'fcr') {
  const target = event.currentTarget as HTMLElement
  const rect = target.getBoundingClientRect()
  const relY = (event.clientY - rect.top) / rect.height
  
  if (chart === 'da') {
    // DA: center is 0, top is +maxPower (sell), bottom is -maxPower (buy)
    const volume = Math.round((0.5 - relY) * 2 * maxPower.value)
    gameState.setDABid(hour, volume)
  } else {
    // FCR: bottom is 0, top is maxPower
    const volume = Math.round((1 - relY) * maxPower.value)
    gameState.setFCRBid(hour, volume)
  }
}

function onBarMouseDown(hour: number, event: MouseEvent, chart: 'da' | 'fcr') {
  isDragging.value = true
  handleBarInteraction(hour, event, chart)
}

function onBarMouseMove(hour: number, event: MouseEvent, chart: 'da' | 'fcr') {
  if (isDragging.value) {
    handleBarInteraction(hour, event, chart)
  }
}

function getDABarStyle(hour: number) {
  const bid = gameState.playerBids.daBids.find(b => b.hour === hour)
  const volume = bid?.volumeMW ?? 0
  const pct = Math.abs(volume) / maxPower.value * 50
  
  if (volume >= 0) {
    return { bottom: '50%', height: `${pct}%` }
  } else {
    return { top: '50%', height: `${pct}%` }
  }
}

function getFCRBarStyle(hour: number) {
  const bid = gameState.playerBids.fcrBids.find(b => b.hour === hour)
  const volume = bid?.volumeMW ?? 0
  const pct = volume / maxPower.value * 100
  return { bottom: '0', height: `${pct}%` }
}

function formatPrice(price: number): string {
  return price.toFixed(0)
}

const totalDARevenue = computed(() => {
  let total = 0
  for (let h = 0; h < 24; h++) {
    const bid = gameState.playerBids.daBids.find(b => b.hour === h)
    const volume = bid?.volumeMW ?? 0
    const price = gameState.marketPrices.daEurPerMWh[h] ?? 0
    total += volume * price
  }
  return total
})

const totalFCRRevenue = computed(() => {
  let total = 0
  for (let h = 0; h < 24; h++) {
    const bid = gameState.playerBids.fcrBids.find(b => b.hour === h)
    const volume = bid?.volumeMW ?? 0
    const price = gameState.marketPrices.fcrEurPerMWPerH[h] ?? 0
    total += volume * price
  }
  return total
})
</script>

<template>
  <div class="start-screen">
    <header class="header">
      <h1>Day-Ahead Bidding</h1>
      <div class="bess-info">
        <span class="bess-stat">BESS: {{ gameState.bess.capacityMWh }} MWh</span>
        <span class="bess-stat">{{ gameState.bess.maxPowerMW }} MW</span>
      </div>
    </header>

    <div class="market-tabs">
      <button 
        :class="['tab', { active: activeChart === 'da' }]" 
        @click="activeChart = 'da'"
      >
        DA Market
        <span class="revenue" :class="{ positive: totalDARevenue > 0, negative: totalDARevenue < 0 }">
          {{ totalDARevenue >= 0 ? '+' : '' }}{{ totalDARevenue.toFixed(0) }} €
        </span>
      </button>
      <button 
        :class="['tab', { active: activeChart === 'fcr' }]" 
        @click="activeChart = 'fcr'"
      >
        FCR Market
        <span class="revenue positive">+{{ totalFCRRevenue.toFixed(0) }} €</span>
      </button>
    </div>

    <div v-if="activeChart === 'da'" class="chart-section">
      <div class="chart-header">
        <span class="chart-title">Day-Ahead Energy (EUR/MWh)</span>
        <span class="chart-hint">Click/drag to bid. Up = sell, Down = buy</span>
      </div>
      <div class="bid-chart da-chart">
        <div class="zero-line"></div>
        <div 
          v-for="h in 24" 
          :key="h - 1"
          class="bar-slot"
          @mousedown="onBarMouseDown(h - 1, $event, 'da')"
          @mousemove="onBarMouseMove(h - 1, $event, 'da')"
        >
          <div class="price-label">{{ formatPrice(gameState.marketPrices.daEurPerMWh[h - 1] ?? 0) }}</div>
          <div class="bar-area">
            <div 
              class="bar" 
              :class="{ sell: (gameState.playerBids.daBids.find(b => b.hour === h - 1)?.volumeMW ?? 0) > 0, buy: (gameState.playerBids.daBids.find(b => b.hour === h - 1)?.volumeMW ?? 0) < 0 }"
              :style="getDABarStyle(h - 1)"
            ></div>
          </div>
          <div class="hour-label">{{ (h - 1).toString().padStart(2, '0') }}</div>
        </div>
      </div>
      <div class="scale-labels">
        <span>+{{ maxPower }} MW (sell)</span>
        <span>0</span>
        <span>-{{ maxPower }} MW (buy)</span>
      </div>
    </div>

    <div v-if="activeChart === 'fcr'" class="chart-section">
      <div class="chart-header">
        <span class="chart-title">FCR Capacity (EUR/MW/h)</span>
        <span class="chart-hint">Click/drag to bid symmetric reserve</span>
      </div>
      <div class="bid-chart fcr-chart">
        <div 
          v-for="h in 24" 
          :key="h - 1"
          class="bar-slot"
          @mousedown="onBarMouseDown(h - 1, $event, 'fcr')"
          @mousemove="onBarMouseMove(h - 1, $event, 'fcr')"
        >
          <div class="price-label">{{ formatPrice(gameState.marketPrices.fcrEurPerMWPerH[h - 1] ?? 0) }}</div>
          <div class="bar-area">
            <div 
              class="bar fcr" 
              :style="getFCRBarStyle(h - 1)"
            ></div>
          </div>
          <div class="hour-label">{{ (h - 1).toString().padStart(2, '0') }}</div>
        </div>
      </div>
      <div class="scale-labels fcr-scale">
        <span>{{ maxPower }} MW</span>
        <span>0</span>
      </div>
    </div>

    <div class="toggles-section">
      <div class="toggles-grid">
        <label class="toggle">
          <input type="checkbox" v-model="gameState.config.toggles.nuclear" />
          <span class="toggle-label">Nuclear</span>
        </label>
        <label class="toggle">
          <input type="checkbox" v-model="gameState.config.toggles.hydroReservoir" />
          <span class="toggle-label">Hydro Reservoir</span>
        </label>
        <label class="toggle">
          <input type="checkbox" v-model="gameState.config.toggles.hydroRoR" />
          <span class="toggle-label">Hydro RoR</span>
        </label>
        <label class="toggle">
          <input type="checkbox" v-model="gameState.config.toggles.wind" />
          <span class="toggle-label">Wind</span>
        </label>
        <label class="toggle">
          <input type="checkbox" v-model="gameState.config.toggles.solar" />
          <span class="toggle-label">Solar</span>
        </label>
        <label class="toggle">
          <input type="checkbox" v-model="gameState.config.toggles.chp" />
          <span class="toggle-label">CHP</span>
        </label>
        <label class="toggle">
          <input type="checkbox" v-model="gameState.config.toggles.peakers" />
          <span class="toggle-label">Peakers</span>
        </label>
        <label class="toggle">
          <input type="checkbox" v-model="gameState.config.toggles.interconnectors" />
          <span class="toggle-label">Interconnectors</span>
        </label>
        <label class="toggle">
          <input type="checkbox" v-model="gameState.config.toggles.demandResponse" />
          <span class="toggle-label">Demand Response</span>
        </label>
      </div>
    </div>

    <button class="start-btn" @click="startDay">
      Start Day
      <span class="hint">(Space)</span>
    </button>
  </div>
</template>

<style scoped>
.start-screen {
  max-width: 900px;
  margin: 0 auto;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

h1 {
  color: var(--gridio-sky-vivid);
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0;
}

.bess-info {
  display: flex;
  gap: 1rem;
}

.bess-stat {
  font-size: 0.8rem;
  color: var(--color-gray-600);
  background: var(--color-gray-100);
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
}

.market-tabs {
  display: flex;
  gap: 0.5rem;
}

.tab {
  flex: 1;
  padding: 0.75rem;
  border: 2px solid var(--color-gray-200);
  background: white;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 500;
  font-size: 0.9rem;
  color: var(--color-gray-600);
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: all 0.15s;
}

.tab:hover {
  border-color: var(--color-gray-300);
}

.tab.active {
  border-color: var(--gridio-sky-vivid);
  color: var(--gridio-sky-vivid);
  background: #f0f4ff;
}

.revenue {
  font-size: 0.8rem;
  font-weight: 600;
}

.revenue.positive {
  color: #10b981;
}

.revenue.negative {
  color: #ef4444;
}

.chart-section {
  background: white;
  border-radius: 12px;
  padding: 1rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.chart-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.75rem;
}

.chart-title {
  font-weight: 600;
  font-size: 0.9rem;
  color: var(--color-gray-700);
}

.chart-hint {
  font-size: 0.75rem;
  color: var(--color-gray-500);
}

.bid-chart {
  display: flex;
  gap: 2px;
  height: 200px;
  position: relative;
  user-select: none;
}

.da-chart .zero-line {
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  height: 1px;
  background: var(--color-gray-300);
  pointer-events: none;
  z-index: 1;
}

.bar-slot {
  flex: 1;
  display: flex;
  flex-direction: column;
  cursor: crosshair;
}

.price-label {
  font-size: 0.6rem;
  color: var(--color-gray-500);
  text-align: center;
  height: 16px;
  line-height: 16px;
}

.bar-area {
  flex: 1;
  position: relative;
  background: var(--color-gray-50);
  border-radius: 2px;
}

.bar {
  position: absolute;
  left: 2px;
  right: 2px;
  border-radius: 2px;
  transition: height 0.05s;
}

.bar.sell {
  background: #10b981;
}

.bar.buy {
  background: #3b82f6;
}

.bar.fcr {
  background: #f59e0b;
}

.hour-label {
  font-size: 0.6rem;
  color: var(--color-gray-500);
  text-align: center;
  height: 16px;
  line-height: 16px;
}

.scale-labels {
  display: flex;
  justify-content: space-between;
  font-size: 0.65rem;
  color: var(--color-gray-500);
  margin-top: 0.5rem;
  padding: 0 0.25rem;
}

.scale-labels.fcr-scale {
  flex-direction: column;
  align-items: flex-start;
  gap: 0;
}

.fcr-scale span:last-child {
  margin-top: auto;
}

.toggles-section {
  background: white;
  border-radius: 12px;
  padding: 0.75rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.toggles-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.25rem;
}

.toggle {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.25rem 0.375rem;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.15s;
}

.toggle:hover {
  background: var(--color-gray-50);
}

.toggle input[type="checkbox"] {
  width: 14px;
  height: 14px;
  accent-color: var(--gridio-sky-vivid);
  cursor: pointer;
}

.toggle-label {
  font-size: 0.7rem;
  color: var(--color-gray-700);
  user-select: none;
}

.start-btn {
  width: 100%;
  padding: 0.75rem 1.5rem;
  font-size: 1rem;
  background: var(--gridio-sky-vivid);
  color: white;
  border: none;
  border-radius: 20px;
  font-weight: 500;
  transition: background 0.2s;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  cursor: pointer;
}

.start-btn:hover {
  background: #3355e0;
}

.hint {
  font-size: 0.75rem;
  opacity: 0.7;
}
</style>
