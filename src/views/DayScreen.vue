<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { gameState, type SimulationSpeed } from '../game/GameState'
import { tutorialController } from '../tutorial'

const route = useRoute()
import PowerChart from '../components/PowerChart.vue'
import WeatherChart from '../components/WeatherChart.vue'
import ConsumptionChart from '../components/ConsumptionChart.vue'
import ProductionChart from '../components/ProductionChart.vue'
import FrequencyChart from '../components/FrequencyChart.vue'
import BalancingChart from '../components/BalancingChart.vue'
import DABidChart from '../components/DABidChart.vue'
import FCRBidChart from '../components/FCRBidChart.vue'
import ImbalanceSettlementChart from '../components/ImbalanceSettlementChart.vue'
import BESSPanel from '../components/BESSPanel.vue'

// Refs for highlightable elements
const bessRef = ref<HTMLElement | null>(null)
const topChartRef = ref<HTMLElement | null>(null)
const chartTabsRef = ref<HTMLElement | null>(null)
const advancedToggleRef = ref<HTMLElement | null>(null)

// Spotlight and message positioning (using absolute positioning relative to document)
const spotlightRect = ref<{ top: number; left: number; width: number; height: number } | null>(null)
const messagePosition = ref<{ top: string; left: string; transform: string }>({ top: '50vh', left: '50%', transform: 'translate(-50%, -50%)' })

function updateSpotlight() {
  const highlight = tutorialMessage.value?.highlight
  if (!highlight) {
    spotlightRect.value = null
    // Center in viewport when no highlight
    const scrollY = window.scrollY
    messagePosition.value = { top: `${scrollY + window.innerHeight / 2}px`, left: '50%', transform: 'translate(-50%, -50%)' }
    return
  }

  let element: HTMLElement | null = null
  
  if (highlight === 'bess' && bessRef.value) {
    element = bessRef.value
  } else if ((highlight === 'frequency' || highlight === 'chart') && topChartRef.value) {
    element = topChartRef.value
  } else if (highlight === 'chart-tabs' && chartTabsRef.value) {
    element = chartTabsRef.value
  } else if (highlight === 'advanced' && advancedToggleRef.value) {
    element = advancedToggleRef.value
  }

  if (element) {
    const rect = element.getBoundingClientRect()
    const scrollY = window.scrollY
    const scrollX = window.scrollX
    const padding = 8
    
    // Spotlight uses viewport coords (parent is position: fixed)
    spotlightRect.value = {
      top: rect.top - padding,
      left: rect.left - padding,
      width: rect.width + padding * 2,
      height: rect.height + padding * 2,
    }

    // Message uses document coords (position: absolute in overlay)
    if (highlight === 'bess') {
      messagePosition.value = {
        top: `${rect.top + scrollY + 20}px`,
        left: `${rect.right + scrollX + 20}px`,
        transform: 'none',
      }
    } else {
      // Below the chart
      messagePosition.value = {
        top: `${rect.bottom + scrollY + 20}px`,
        left: `${rect.left + scrollX + rect.width / 2}px`,
        transform: 'translateX(-50%)',
      }
    }
  } else {
    spotlightRect.value = null
    const scrollY = window.scrollY
    messagePosition.value = { top: `${scrollY + window.innerHeight / 2}px`, left: '50%', transform: 'translate(-50%, -50%)' }
  }
}

const router = useRouter()

const speeds: SimulationSpeed[] = [1, 10, 50, 1000, 2000, 3000, 10000]

type TopChart = 'frequency' | 'da' | 'fcr' | 'imbalance'
const topChartOptions: TopChart[] = ['frequency', 'da', 'fcr', 'imbalance']
const topChartLabels: Record<TopChart, string> = {
  frequency: 'System Frequency',
  da: 'DA Bids',
  fcr: 'FCR Bids',
  imbalance: 'Imbalance Settlement',
}

type BottomChart = 'grid' | 'production' | 'consumption' | 'weather' | 'balancing'
const bottomChartOptions: BottomChart[] = ['grid', 'production', 'consumption', 'weather', 'balancing']
const bottomChartLabels: Record<BottomChart, string> = {
  grid: 'Power Grid',
  production: 'Production Breakdown',
  consumption: 'Consumption Breakdown',
  weather: 'Weather & Forecast',
  balancing: 'Balancing Services',
}

const topChartView = ref<TopChart>('frequency')
const bottomChartView = ref<BottomChart>('grid')
const showAdvanced = ref(false)

// Tutorial state
const isTutorial = computed(() => tutorialController.active)
const tutorialDay = computed(() => tutorialController.currentDay)
const tutorialConfig = computed(() => tutorialController.config)
const tutorialMessage = computed(() => tutorialController.currentMessage)

// Watch for message changes to update spotlight
watch(tutorialMessage, async () => {
  await nextTick()
  updateSpotlight()
}, { immediate: true })

// Track tutorial-triggered messages to avoid duplicates
const shownSpeedMsg = ref(false)
const shownNoonMsg = ref(false)
const shownMidgameMsg = ref(false)

// Filter chart options based on tutorial config
const availableTopCharts = computed(() => {
  if (!isTutorial.value) return topChartOptions
  return topChartOptions.filter(opt => {
    if (opt === 'da' && !tutorialConfig.value.daEnabled) return false
    if (opt === 'fcr' && !tutorialConfig.value.fcrEnabled) return false
    return true
  })
})

function cycleTopChart() {
  const opts = availableTopCharts.value
  const currentIndex = opts.indexOf(topChartView.value)
  const nextIndex = (currentIndex + 1) % opts.length
  const nextChart = opts[nextIndex]
  if (nextChart) {
    topChartView.value = nextChart
    tutorialController.onChartChanged(nextChart)
  }
}

function cycleBottomChart() {
  const currentIndex = bottomChartOptions.indexOf(bottomChartView.value)
  const nextIndex = (currentIndex + 1) % bottomChartOptions.length
  bottomChartView.value = bottomChartOptions[nextIndex] as BottomChart
}

function handleKeydown(e: KeyboardEvent) {
  // Handle tutorial messages first
  if (tutorialMessage.value && e.key === ' ') {
    e.preventDefault()
    const advanced = tutorialController.advanceMessage()
    if (advanced && !tutorialMessage.value) {
      // No more messages, auto-resume
      gameState.paused = false
      gameState.startSimulation()
    }
    return
  }

  if (e.key === ' ') {
    e.preventDefault()
    gameState.togglePause()
  } else if (e.key === 'Tab') {
    e.preventDefault()
    cycleTopChart()
  } else if (e.key === 'Enter') {
    e.preventDefault()
    cycleBottomChart()
  } else if (e.key >= '1' && e.key <= '7') {
    const speedIndex = parseInt(e.key) - 1
    const speed = speeds[speedIndex]
    if (speed !== undefined) {
      gameState.setSpeed(speed)
    }
  }
}

const isDayComplete = computed(() => gameState.phase === 'day_complete')

function proceedToEnd() {
  gameState.proceedToEndScreen()
  // Navigate with tutorial params if in tutorial mode
  const params = tutorialController.getUrlParams()
  router.push(params ? `/end?${params}` : '/end')
}

function handleDayCompleteKeydown(e: KeyboardEvent) {
  // Only handle if we're actually in day_complete phase
  if (!isDayComplete.value) return
  if (tutorialMessage.value) return // Don't proceed if tutorial message is showing
  if (e.key === ' ' || e.key === 'Enter') {
    e.preventDefault()
    proceedToEnd()
  }
}

onMounted(() => {
  // Restore tutorial state from URL params if needed
  if (route.query.tutorial === '1' && route.query.day) {
    tutorialController.restoreFromUrl(parseInt(route.query.day as string))
  }
  
  window.addEventListener('keydown', handleKeydown)
  window.addEventListener('keydown', handleDayCompleteKeydown)
  window.addEventListener('scroll', updateSpotlight)
  
  // Redirect to /game if not in correct phase
  if (gameState.phase !== 'day' && gameState.phase !== 'day_complete') {
    const params = tutorialController.getUrlParams()
    router.push(params ? `/game?${params}` : '/game')
  }
  
  // Queue gameplay tutorial messages
  if (isTutorial.value) {
    shownSpeedMsg.value = false
    shownNoonMsg.value = false
    shownMidgameMsg.value = false
    queueGameplayMessages()
    gameState.paused = true
  }
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
  window.removeEventListener('keydown', handleDayCompleteKeydown)
  window.removeEventListener('scroll', updateSpotlight)
})

const currentTime = computed(() => gameState.currentTime)

function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

function queueGameplayMessages() {
  const day = tutorialDay.value
  
  if (day === 1) {
    tutorialController.queueMessages([
      { id: 'd1_control', text: 'This is the control room where you monitor and control everything during a trading day.' },
      { id: 'd1_batteries', text: 'These are your batteries. Their state of charge (SOC), power (MW), and capacity (MWh) are displayed.', highlight: 'bess' },
      { id: 'd1_no_control', text: 'Today, batteries respond automatically to your DA bids (DA is the selected mode and you can\'t change it for now).', highlight: 'bess' },
      { id: 'd1_frequency', text: 'This chart shows grid frequency and imbalance. Your services help balance the grid! However, this information is irrelevant when only trading on DA.', highlight: 'chart' },
      { id: 'd1_tab', text: 'Press Tab to switch to the DA bids chart to monitor your bids and delivery.', highlight: 'chart-tabs', waitFor: 'tab_to_da' },
      { id: 'd1_da_chart', text: 'This shows your DA commitments (in blue) and how well you\'re delivering (in gold). Press Space to unpause!', highlight: 'chart' },
    ])
  } else if (day === 3) {
    tutorialController.queueMessages([
      { id: 'd3_market', text: 'Your batteries are now set to FCR market. They\'ll respond to grid frequency changes.', highlight: 'bess' },
      { id: 'd3_charge', text: 'You now have Charge/Discharge buttons! But while using them, batteries won\'t respond to FCR - risking failed delivery!', highlight: 'bess' },
      { id: 'd3_tab', text: 'Press Tab to view the FCR bids chart.', waitFor: 'tab_to_fcr' },
      { id: 'd3_chart', text: 'This shows your FCR bids and delivery. If the grid needs power, you must deliver!' },
    ])
  } else if (day === 4) {
    tutorialController.queueMessages([
      { id: 'd4_toggle', text: 'You can now toggle each battery\'s market: DA, FCR, AUTO (automatic), or Inactive.', highlight: 'bess' },
    ])
  }
}

// Watch for time-based tutorial triggers
watch(currentTime, (time) => {
  if (!isTutorial.value) return
  
  tutorialController.checkGameTime(time)
  
  const day = tutorialDay.value
  
  // Day 1: Speed message after a few seconds
  if (day === 1 && !shownSpeedMsg.value && time >= 5) {
    shownSpeedMsg.value = true
    tutorialController.queueMessages([
      { id: 'd1_speed', text: 'Press number keys 1-7 to change speed. Press Space to pause anytime.' }
    ])
    gameState.paused = true
  }
  
  // Day 1: Noon message
  if (day === 1 && !shownNoonMsg.value && time >= 12 * 3600) {
    shownNoonMsg.value = true
    tutorialController.queueMessages([
      { id: 'd1_advanced', text: 'In the Advanced section below you can see detailed weather, production, consumption, and balancing info! Interesting and useful for optimal control but unnecessarily complex for now.', highlight: 'advanced' }
    ])
    gameState.paused = true
  }
  
  // Day 4: Midgame message
  if (day === 4 && !shownMidgameMsg.value && time >= 4 * 3600) {
    shownMidgameMsg.value = true
    tutorialController.queueMessages([
      { id: 'd4_imbalance', text: 'Check the Imbalance Settlement chart (press Tab) - it predicts imbalance costs for tactical charging!' }
    ])
    gameState.paused = true
  }
})

// Pause game when tutorial message appears
watch(tutorialMessage, (msg) => {
  if (msg && gameState.phase === 'day') {
    gameState.paused = true
  }
})
</script>

<template>
  <div class="day-screen">
    <!-- Tutorial indicator -->
    <div v-if="isTutorial" class="tutorial-indicator">
      <span class="tutorial-day">Tutorial Day {{ tutorialDay }}/4</span>
      <span v-if="tutorialConfig.earningsGoal > 0" class="tutorial-goal">Goal: €{{ tutorialConfig.earningsGoal }}</span>
    </div>

    <header class="header">
      <h1>{{ isTutorial ? 'Day ' + tutorialDay : 'Day Simulation' }}</h1>
      <div class="header-stats">
        <div class="frequency-display" :class="gameState.currentFrequencyBand">
          {{ gameState.currentFrequencyHz.toFixed(3) }} Hz
        </div>
        <div class="time-display">
          {{ formatTime(currentTime) }} / 24:00:00
        </div>
      </div>
    </header>

    <div class="controls">
      <div class="speed-controls">
        <span class="label">Speed:</span>
        <button
          v-for="(s, i) in speeds"
          :key="s"
          :class="{ active: gameState.speed === s }"
          @click="gameState.setSpeed(s)"
        >
          {{ s }}x <span class="hotkey">({{ i + 1 }})</span>
        </button>
      </div>
      <button class="pause-btn" :class="{ paused: gameState.paused }" @click="gameState.togglePause()">
        {{ gameState.paused ? 'Resume' : 'Pause' }} <span class="hotkey">(Space)</span>
      </button>
    </div>

    <div class="main-content">
      <div ref="bessRef" class="bess-wrapper" :class="{ 'tutorial-highlight': tutorialMessage?.highlight === 'bess' }">
        <BESSPanel 
          :charge-discharge-enabled="!isTutorial || tutorialConfig.chargeDischargeEnabled"
          :market-toggle-enabled="!isTutorial || tutorialConfig.marketToggleEnabled"
        />
      </div>
      
      <div class="charts-column">
        <div class="section-header">
          <div class="section-label">{{ topChartLabels[topChartView] }}</div>
          <div ref="chartTabsRef" class="chart-tabs" :class="{ 'tutorial-highlight': tutorialMessage?.highlight === 'chart-tabs' }">
            <button
              v-for="chart in availableTopCharts"
              :key="chart"
              :class="{ active: topChartView === chart }"
              @click="topChartView = chart; tutorialController.onChartChanged(chart)"
            >
              {{ topChartLabels[chart] }}
            </button>
            <span class="hotkey-hint">(Tab)</span>
          </div>
        </div>
        <div ref="topChartRef" class="chart-container" :class="{ 'tutorial-highlight': tutorialMessage?.highlight === 'frequency' || tutorialMessage?.highlight === 'chart' }">
          <FrequencyChart
            v-if="topChartView === 'frequency'"
            :history="gameState.frequencyHistory"
            :version="gameState.historyVersion"
          />
          <DABidChart 
            v-else-if="topChartView === 'da'"
            :version="gameState.bessVersion"
          />
          <FCRBidChart 
            v-else-if="topChartView === 'fcr'"
            :version="gameState.bessVersion"
          />
          <ImbalanceSettlementChart
            v-else-if="topChartView === 'imbalance'"
            :history="gameState.imbalanceSettlementHistory"
            :forecast="gameState.imbalanceSettlement?.forecast4h || null"
            :currentTime="gameState.currentTime"
            :version="gameState.imbalanceSettlementVersion"
          />
        </div>

        <div class="advanced-section">
          <button ref="advancedToggleRef" class="advanced-header" :class="{ 'tutorial-highlight': tutorialMessage?.highlight === 'advanced' }" @click="showAdvanced = !showAdvanced">
            <span class="advanced-title">Advanced Charts</span>
            <span class="chevron" :class="{ expanded: showAdvanced }">▼</span>
          </button>
          <Transition name="expand">
            <div v-if="showAdvanced" class="advanced-content">
              <div class="section-header">
                <div class="section-label">{{ bottomChartLabels[bottomChartView] }}</div>
                <div class="chart-tabs">
                  <button
                    v-for="chart in bottomChartOptions"
                    :key="chart"
                    :class="{ active: bottomChartView === chart }"
                    @click="bottomChartView = chart"
                  >
                    {{ bottomChartLabels[chart] }}
                  </button>
                  <span class="hotkey-hint">(Enter)</span>
                </div>
              </div>
              <div class="chart-container">
                <PowerChart 
                  v-if="bottomChartView === 'grid'"
                  :history="gameState.gridHistory" 
                  :version="gameState.historyVersion" 
                />
                <ProductionChart
                  v-else-if="bottomChartView === 'production'"
                  :history="gameState.productionHistory"
                  :version="gameState.historyVersion"
                />
                <ConsumptionChart
                  v-else-if="bottomChartView === 'consumption'"
                  :history="gameState.consumptionHistory"
                  :version="gameState.historyVersion"
                />
                <WeatherChart 
                  v-else-if="bottomChartView === 'weather'"
                  :history="gameState.weatherHistory" 
                  :forecastArrays="gameState.forecastArrays"
                  :currentTime="gameState.currentTime"
                  :version="gameState.weatherHistoryVersion" 
                />
                <BalancingChart
                  v-else-if="bottomChartView === 'balancing'"
                  :history="gameState.balancingHistory"
                  :version="gameState.historyVersion"
                />
              </div>
            </div>
          </Transition>
        </div>
      </div>
    </div>

    <!-- Tutorial message overlay -->
    <Transition name="fade">
      <div v-if="tutorialMessage" class="tutorial-overlay">
        <!-- Spotlight cutout using CSS mask -->
        <div class="tutorial-backdrop" :class="{ 'has-spotlight': spotlightRect }">
          <div 
            v-if="spotlightRect" 
            class="spotlight-hole"
            :style="{
              top: spotlightRect.top + 'px',
              left: spotlightRect.left + 'px',
              width: spotlightRect.width + 'px',
              height: spotlightRect.height + 'px',
            }"
          ></div>
        </div>
        <div 
          class="tutorial-message" 
          :style="messagePosition"
          @click.stop
        >
          <p>{{ tutorialMessage.text }}</p>
          <div class="message-footer">
            <span v-if="tutorialMessage.waitFor === 'tab_to_da'" class="hint">Press Tab to switch to DA chart</span>
            <span v-else-if="tutorialMessage.waitFor === 'tab_to_fcr'" class="hint">Press Tab to switch to FCR chart</span>
            <span v-else class="hint">Press Space to continue</span>
          </div>
        </div>
      </div>
    </Transition>

    <!-- Day Complete Overlay -->
    <div v-if="isDayComplete && !tutorialMessage" class="day-complete-overlay" @click="proceedToEnd">
      <div class="day-complete-content">
        <h2>Day Complete!</h2>
        <p>Press <kbd>Space</kbd> to continue to end of day breakdown</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.day-screen {
  max-width: 1200px;
  margin: 0 auto;
  padding: 1rem;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

h1 {
  color: var(--gridio-sky-vivid);
  margin: 0;
  font-size: 1.5rem;
  font-weight: 600;
}

.header-stats {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.time-display {
  background: white;
  padding: 0.5rem 1rem;
  border-radius: 12px;
  color: var(--color-gray-700);
  font-family: monospace;
  font-weight: 500;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.frequency-display {
  background: #D1FAE5;
  padding: 0.5rem 1rem;
  border-radius: 12px;
  font-family: monospace;
  font-weight: 600;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  color: #059669;
  transition: all 0.3s;
}

.frequency-display.normal {
  background: #D1FAE5;
  color: #059669;
}

.frequency-display.off_normal {
  background: #FEF3C7;
  color: #D97706;
}

.frequency-display.alert {
  background: #FED7AA;
  color: #C2410C;
}

.frequency-display.emergency {
  background: #FEE2E2;
  color: #DC2626;
  animation: pulse 1s infinite;
}

.frequency-display.blackout {
  background: #7F1D1D;
  color: white;
  animation: pulse 0.5s infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

.controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: white;
  padding: 0.75rem;
  border-radius: 16px;
  margin-bottom: 1rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.speed-controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.speed-controls .label {
  color: var(--color-gray-500);
  margin-right: 0.5rem;
  font-size: 0.875rem;
}

.speed-controls button {
  background: var(--color-gray-50);
  border: 1px solid var(--color-gray-300);
  color: var(--color-gray-700);
  padding: 0.5rem 0.75rem;
  border-radius: 12px;
  font-size: 0.875rem;
  transition: all 0.2s;
}

.speed-controls button.active {
  background: var(--gridio-sky-vivid);
  color: white;
  border-color: var(--gridio-sky-vivid);
}

.speed-controls button:hover:not(.active) {
  border-color: var(--gridio-sky-vivid);
  color: var(--gridio-sky-vivid);
}

.hotkey {
  opacity: 0.6;
  font-size: 0.75em;
}

.pause-btn {
  background: var(--color-gray-100);
  border: 1px solid var(--color-gray-300);
  color: var(--color-gray-700);
  padding: 0.5rem 1rem;
  border-radius: 12px;
  font-size: 0.875rem;
  font-weight: 500;
}

.pause-btn:hover {
  background: var(--color-gray-200);
}

.pause-btn.paused {
  background: var(--gridio-peach-vivid);
  border-color: var(--gridio-peach-vivid);
  color: white;
}

.main-content {
  display: flex;
  gap: 1rem;
}

.charts-column {
  flex: 1;
  min-width: 0;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.section-label {
  font-size: 0.75rem;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-gray-500);
  margin-bottom: 0.5rem;
}

.section-header .section-label {
  margin-bottom: 0;
}

.chart-tabs {
  display: flex;
  gap: 0.25rem;
  align-items: center;
}

.chart-tabs button {
  background: var(--color-gray-100);
  border: 1px solid var(--color-gray-200);
  color: var(--color-gray-600);
  padding: 0.25rem 0.5rem;
  border-radius: 6px;
  font-size: 0.7rem;
  transition: all 0.2s;
}

.chart-tabs button.active {
  background: var(--gridio-sky-vivid);
  color: white;
  border-color: var(--gridio-sky-vivid);
}

.chart-tabs button:hover:not(.active) {
  border-color: var(--gridio-sky-vivid);
  color: var(--gridio-sky-vivid);
}

.hotkey-hint {
  color: var(--color-gray-400);
  font-size: 0.65rem;
  margin-left: 0.25rem;
}

.chart-container {
  background: white;
  border-radius: 16px;
  padding: 1rem;
  margin-bottom: 1rem;
  height: 250px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.advanced-section {
  margin-top: 2rem;
}

.advanced-header {
  width: 100%;
  background: var(--color-gray-50);
  border: 1px solid var(--color-gray-200);
  border-radius: 12px;
  padding: 0.75rem 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  cursor: pointer;
  transition: all 0.2s;
  margin-bottom: 0.5rem;
}

.advanced-header:hover {
  background: var(--color-gray-100);
  border-color: var(--gridio-sky-vivid);
}

.advanced-title {
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--color-gray-600);
}

.chevron {
  transition: transform 0.3s;
  color: var(--color-gray-400);
  font-size: 0.75rem;
}

.chevron.expanded {
  transform: rotate(-180deg);
}

.advanced-content {
  overflow: hidden;
}

.advanced-content .chart-container {
  height: 500px;
}

.expand-enter-active,
.expand-leave-active {
  transition: all 0.3s ease;
  max-height: 800px;
}

.expand-enter-from,
.expand-leave-to {
  opacity: 0;
  max-height: 0;
  margin-top: 0;
}

.day-complete-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.75);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  cursor: pointer;
}

.day-complete-content {
  background: white;
  padding: 3rem 4rem;
  border-radius: 16px;
  text-align: center;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  animation: fadeInUp 0.3s ease-out;
}

@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.day-complete-content h2 {
  color: var(--gridio-sky-vivid);
  font-size: 2rem;
  margin: 0 0 1rem 0;
}

.day-complete-content p {
  color: var(--color-gray-600);
  font-size: 1.125rem;
  margin: 0;
}

.day-complete-content kbd {
  display: inline-block;
  padding: 0.25rem 0.5rem;
  background: var(--color-gray-100);
  border: 1px solid var(--color-gray-300);
  border-radius: 4px;
  font-family: inherit;
  font-size: 1rem;
  font-weight: 600;
}

/* Tutorial styles */
.tutorial-indicator {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 1rem;
  padding: 0.5rem 1rem;
  background: white;
  border-radius: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  margin-bottom: 0.5rem;
  width: fit-content;
  margin-left: auto;
  margin-right: auto;
}

.tutorial-day {
  font-weight: 600;
  color: var(--gridio-sky-vivid);
}

.tutorial-goal {
  color: var(--color-gray-600);
  font-size: 0.875rem;
}

.tutorial-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  min-height: 100%;
  z-index: 2000;
  pointer-events: auto;
}

.tutorial-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.6);
}

.tutorial-backdrop.has-spotlight {
  background: transparent;
}

.spotlight-hole {
  position: absolute;
  border-radius: 12px;
  box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.6);
  pointer-events: none;
}

.tutorial-highlight {
  position: relative;
  z-index: 2001;
}

.bess-wrapper {
  display: contents;
}

.bess-wrapper.tutorial-highlight > * {
  position: relative;
  z-index: 2001;
}

.tutorial-message {
  position: absolute;
  background: white;
  max-width: 400px;
  padding: 1.5rem;
  border-radius: 12px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  z-index: 2002;
}

.tutorial-message p {
  font-size: 1rem;
  line-height: 1.6;
  color: var(--color-gray-700);
  margin: 0 0 1rem;
}

.message-footer {
  text-align: center;
}

.message-footer .hint {
  color: var(--color-gray-500);
  font-size: 0.875rem;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
