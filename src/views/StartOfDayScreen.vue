<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import type { Component } from 'vue'
import { gameState } from '../game/GameState'
import { useRouter } from 'vue-router'
import InfoModal from '../components/info/InfoModal.vue'
import NuclearInfo from '../components/info/NuclearInfo.vue'
import HydroReservoirInfo from '../components/info/HydroReservoirInfo.vue'
import HydroRoRInfo from '../components/info/HydroRoRInfo.vue'
import WindInfo from '../components/info/WindInfo.vue'
import SolarInfo from '../components/info/SolarInfo.vue'
import CHPInfo from '../components/info/CHPInfo.vue'
import PeakersInfo from '../components/info/PeakersInfo.vue'
import InterconnectorsInfo from '../components/info/InterconnectorsInfo.vue'
import DemandResponseInfo from '../components/info/DemandResponseInfo.vue'

const router = useRouter()
const activeChart = ref<'da' | 'fcr'>('da')
const isDragging = ref(false)
const showSandbox = ref(true)
const showInfoModal = ref(false)
const currentInfoType = ref<EnergyType | null>(null)

type EnergyType = 'nuclear' | 'hydroReservoir' | 'hydroRoR' | 'wind' | 'solar' | 'chp' | 'peakers' | 'interconnectors' | 'demandResponse'

const energyTypes: EnergyType[] = ['nuclear', 'hydroReservoir', 'hydroRoR', 'wind', 'solar', 'chp', 'peakers', 'interconnectors', 'demandResponse']

const infoComponents: Record<EnergyType, Component> = {
  nuclear: NuclearInfo,
  hydroReservoir: HydroReservoirInfo,
  hydroRoR: HydroRoRInfo,
  wind: WindInfo,
  solar: SolarInfo,
  chp: CHPInfo,
  peakers: PeakersInfo,
  interconnectors: InterconnectorsInfo,
  demandResponse: DemandResponseInfo,
}

const currentInfoComponent = computed(() => {
  return currentInfoType.value ? infoComponents[currentInfoType.value] : null
})

const currentIndex = computed(() => {
  return currentInfoType.value ? energyTypes.indexOf(currentInfoType.value) : -1
})

const canGoLeft = computed(() => currentIndex.value >= 0)
const canGoRight = computed(() => currentIndex.value >= 0)

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

const maxPower = computed(() => gameState.totalBessMaxPowerMW)

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

const daPriceRange = computed(() => {
  const prices = gameState.marketPrices.daEurPerMWh
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  return { min, max, range: max - min }
})

const fcrPriceRange = computed(() => {
  const prices = gameState.marketPrices.fcrEurPerMWPerH
  const min = Math.min(...prices)
  const max = Math.max(...prices)
  return { min, max, range: max - min }
})

function getDAPriceStyle(hour: number) {
  const price = gameState.marketPrices.daEurPerMWh[hour] ?? 0
  const { min, range } = daPriceRange.value
  const t = range > 0 ? (price - min) / range : 0.5
  const fontSize = 0.55 + t * 0.35
  const r = Math.round(80 + t * 175)
  const g = Math.round(80 + (1 - t) * 100)
  const b = Math.round(80)
  return {
    fontSize: `${fontSize}rem`,
    color: `rgb(${r}, ${g}, ${b})`,
    fontWeight: t > 0.6 ? '600' : '400',
  }
}

function getFCRPriceStyle(hour: number) {
  const price = gameState.marketPrices.fcrEurPerMWPerH[hour] ?? 0
  const { min, range } = fcrPriceRange.value
  const t = range > 0 ? (price - min) / range : 0.5
  const fontSize = 0.55 + t * 0.35
  const r = Math.round(80 + t * 175)
  const g = Math.round(100 + (1 - t) * 80)
  const b = Math.round(80)
  return {
    fontSize: `${fontSize}rem`,
    color: `rgb(${r}, ${g}, ${b})`,
    fontWeight: t > 0.6 ? '600' : '400',
  }
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

function showInfo(type: EnergyType) {
  currentInfoType.value = type
  showInfoModal.value = true
}

function closeModal() {
  showInfoModal.value = false
  currentInfoType.value = null
}

function goLeft() {
  if (currentInfoType.value) {
    const idx = energyTypes.indexOf(currentInfoType.value)
    const nextIdx = idx - 1 < 0 ? energyTypes.length - 1 : idx - 1
    const nextType = energyTypes[nextIdx]
    if (nextType) currentInfoType.value = nextType
  }
}

function goRight() {
  if (currentInfoType.value) {
    const idx = energyTypes.indexOf(currentInfoType.value)
    const nextIdx = idx + 1 >= energyTypes.length ? 0 : idx + 1
    const nextType = energyTypes[nextIdx]
    if (nextType) currentInfoType.value = nextType
  }
}
</script>

<template>
  <div class="start-screen">
    <header class="header">
      <h1>Day-Ahead Bidding</h1>
      <div class="bess-info">
        <span class="bess-stat">Fleet: {{ gameState.totalBessCapacityMWh }} MWh</span>
        <span class="bess-stat">{{ gameState.totalBessMaxPowerMW }} MW</span>
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
          <div class="price-label" :style="getDAPriceStyle(h - 1)">{{ formatPrice(gameState.marketPrices.daEurPerMWh[h - 1] ?? 0) }}</div>
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
          <div class="price-label" :style="getFCRPriceStyle(h - 1)">{{ formatPrice(gameState.marketPrices.fcrEurPerMWPerH[h - 1] ?? 0) }}</div>
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

    <div class="sandbox-section">
      <button class="sandbox-header" @click="showSandbox = !showSandbox">
        <span class="sandbox-title">Sandbox <span class="sandbox-subtitle">(what if this was not part of the system...)</span></span>
        <span class="chevron" :class="{ expanded: showSandbox }">▼</span>
      </button>
      <Transition name="expand">
        <div v-if="showSandbox" class="toggles-section">
          <div class="toggles-grid">
            <div class="toggle-item">
              <label class="toggle">
                <input type="checkbox" v-model="gameState.config.toggles.nuclear" />
                <span class="toggle-label">Nuclear</span>
              </label>
              <button class="info-btn" @click.stop="showInfo('nuclear')" title="Learn about Nuclear">?</button>
            </div>
            <div class="toggle-item">
              <label class="toggle">
                <input type="checkbox" v-model="gameState.config.toggles.hydroReservoir" />
                <span class="toggle-label">Hydro Reservoir</span>
              </label>
              <button class="info-btn" @click.stop="showInfo('hydroReservoir')" title="Learn about Hydro Reservoir">?</button>
            </div>
            <div class="toggle-item">
              <label class="toggle">
                <input type="checkbox" v-model="gameState.config.toggles.hydroRoR" />
                <span class="toggle-label">Hydro RoR</span>
              </label>
              <button class="info-btn" @click.stop="showInfo('hydroRoR')" title="Learn about Run-of-River">?</button>
            </div>
            <div class="toggle-item">
              <label class="toggle">
                <input type="checkbox" v-model="gameState.config.toggles.wind" />
                <span class="toggle-label">Wind</span>
              </label>
              <button class="info-btn" @click.stop="showInfo('wind')" title="Learn about Wind Power">?</button>
            </div>
            <div class="toggle-item">
              <label class="toggle">
                <input type="checkbox" v-model="gameState.config.toggles.solar" />
                <span class="toggle-label">Solar</span>
              </label>
              <button class="info-btn" @click.stop="showInfo('solar')" title="Learn about Solar PV">?</button>
            </div>
            <div class="toggle-item">
              <label class="toggle">
                <input type="checkbox" v-model="gameState.config.toggles.chp" />
                <span class="toggle-label">CHP</span>
              </label>
              <button class="info-btn" @click.stop="showInfo('chp')" title="Learn about Combined Heat & Power">?</button>
            </div>
            <div class="toggle-item">
              <label class="toggle">
                <input type="checkbox" v-model="gameState.config.toggles.peakers" />
                <span class="toggle-label">Peakers</span>
              </label>
              <button class="info-btn" @click.stop="showInfo('peakers')" title="Learn about Gas & Oil Peakers">?</button>
            </div>
            <div class="toggle-item">
              <label class="toggle">
                <input type="checkbox" v-model="gameState.config.toggles.interconnectors" />
                <span class="toggle-label">Interconnectors</span>
              </label>
              <button class="info-btn" @click.stop="showInfo('interconnectors')" title="Learn about Grid Interconnectors">?</button>
            </div>
            <div class="toggle-item">
              <label class="toggle">
                <input type="checkbox" v-model="gameState.config.toggles.demandResponse" />
                <span class="toggle-label">Demand Response</span>
              </label>
              <button class="info-btn" @click.stop="showInfo('demandResponse')" title="Learn about Demand Response">?</button>
            </div>
          </div>
        </div>
      </Transition>
    </div>

    <InfoModal 
      :show="showInfoModal" 
      :can-go-left="canGoLeft" 
      :can-go-right="canGoRight"
      @close="closeModal"
      @go-left="goLeft"
      @go-right="goRight"
    >
      <component :is="currentInfoComponent" v-if="currentInfoComponent" />
    </InfoModal>

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
  text-align: center;
  height: 20px;
  line-height: 20px;
  transition: font-size 0.1s, color 0.1s;
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

.sandbox-section {
  background: white;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.sandbox-header {
  width: 100%;
  padding: 0.75rem;
  background: var(--color-gray-50);
  border: none;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  transition: background 0.15s;
}

.sandbox-header:hover {
  background: var(--color-gray-100);
}

.sandbox-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-gray-800);
}

.sandbox-subtitle {
  font-size: 0.75rem;
  font-weight: 400;
  color: var(--color-gray-500);
  font-style: italic;
}

.chevron {
  font-size: 0.75rem;
  color: var(--color-gray-600);
  transition: transform 0.2s;
}

.chevron.expanded {
  transform: rotate(180deg);
}

.toggles-section {
  padding: 0.75rem;
}

.toggles-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.25rem;
}

.toggle-item {
  display: flex;
  align-items: center;
}

.toggle {
  display: flex;
  align-items: center;
  gap: 0.25rem;
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

.info-btn {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 1px solid var(--color-gray-300);
  background: white;
  color: var(--color-gray-600);
  font-size: 0.6rem;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
  flex-shrink: 0;
  margin-left: 0.25rem;
}

.info-btn:hover {
  background: var(--gridio-sky-vivid);
  border-color: var(--gridio-sky-vivid);
  color: white;
  transform: scale(1.1);
}

.expand-enter-active,
.expand-leave-active {
  transition: all 0.2s ease-out;
  overflow: hidden;
}

.expand-enter-from,
.expand-leave-to {
  max-height: 0;
  opacity: 0;
}

.expand-enter-to,
.expand-leave-from {
  max-height: 500px;
  opacity: 1;
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
