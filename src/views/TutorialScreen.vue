<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()

interface TutorialStep {
  title: string
  description: string
  highlight: string | null
  position: 'center' | 'top' | 'bottom' | 'left' | 'right'
}

const steps: TutorialStep[] = [
  {
    title: 'Welcome to the Tutorial',
    description: 'This tutorial will walk you through the game interface. Press Space to continue through each step.',
    highlight: null,
    position: 'center',
  },
  // Bidding explanation steps
  {
    title: 'Before the Day: Place Your Bids',
    description: 'Before each day, you\'ll place bids on two markets. This is where you commit your battery capacity and make money!',
    highlight: 'bidding-intro',
    position: 'center',
  },
  {
    title: 'Your Fleet Capacity',
    description: 'Your combined BESS fleet has 45 MW power and 70 MWh storage. This is your volume ceiling — you cannot bid more than your fleet can deliver.',
    highlight: 'fleet-capacity',
    position: 'bottom',
  },
  {
    title: 'Day-Ahead (DA) Market',
    description: 'In the DA market, drag up to SELL energy, drag down to BUY energy. You must deliver what you bid or pay a fee.',
    highlight: 'da-bid-chart',
    position: 'bottom',
  },
  {
    title: 'Understanding DA Prices',
    description: 'The numbers above each hour (30, 45, 62...) are prices in €/MWh. Larger, redder numbers = higher prices. Sell when prices are high (morning/evening peaks), buy when low (night/midday).',
    highlight: 'da-prices',
    position: 'bottom',
  },
  {
    title: 'FCR Market',
    description: 'In the FCR market, you reserve capacity for frequency response. You get paid €/MW/h just for being available. When frequency deviates, your batteries must respond automatically.',
    highlight: 'fcr-bid-chart',
    position: 'bottom',
  },
  {
    title: 'Understanding FCR Prices',
    description: 'FCR prices (€/MW/h) tell you how much you earn per MW of capacity reserved. Higher prices often occur during uncertain periods. Unlike DA, you get paid for standby, not energy delivered.',
    highlight: 'fcr-prices',
    position: 'bottom',
  },
  {
    title: 'Prices Are Revealed Early',
    description: 'In real markets, prices aren\'t known until after the auction clears. For gameplay, we show prices upfront so you can plan strategically. Use this to maximize your revenue!',
    highlight: 'fcr-prices',
    position: 'center',
  },
  // Game interface steps
  {
    title: 'Battery Fleet Panel',
    description: 'This panel shows your battery energy storage systems (BESS). Each unit has a state of charge meter and power output display. Note that each battery starts at 50% charge.',
    highlight: 'bess-panel',
    position: 'right',
  },
  {
    title: 'Battery Market Mode',
    description: 'Click the market button (DA/FCR/AUTO) to choose which market each battery serves. AUTO automatically allocates based on your bids. Enough batteries MUST be allocated to the market you bid on (or be on  AUTO) AND have the charge left to participate to avoid penalties.',
    highlight: 'market-toggle',
    position: 'right',
  },
  {
    title: 'Manual Battery Control',
    description: 'Use Charge/Discharge buttons for manual control. Useful for emergencies or repositioning your state of charge.',
    highlight: 'unit-controls',
    position: 'right',
  },
  {
    title: 'Frequency Display',
    description: 'The grid frequency should stay at 50.000 Hz. Green is good. Yellow/orange means the grid is stressed. Red is an emergency.',
    highlight: 'frequency-display',
    position: 'bottom',
  },
  {
    title: 'Time & Speed Controls',
    description: 'Control simulation speed with the buttons or number keys 1-6. Press Space to pause/resume.',
    highlight: 'controls',
    position: 'bottom',
  },
  {
    title: 'Chart Tabs',
    description: 'Switch between different views: System Frequency, DA Bids, FCR Bids, and Imbalance Settlement. Press Tab to cycle.',
    highlight: 'chart-tabs',
    position: 'bottom',
  },
  {
    title: 'Advanced Charts',
    description: 'Click "Advanced Charts" to see detailed breakdowns of production, consumption, weather, and balancing services.',
    highlight: 'advanced-section',
    position: 'top',
  },
  {
    title: 'Ready to Play!',
    description: 'You now know the basics. Place your bids wisely, then watch how your batteries perform. Good luck!',
    highlight: null,
    position: 'center',
  },
]

const currentStepIndex = ref(0)
const currentStep = computed(() => steps[currentStepIndex.value]!)

// Fixed prices for tutorial display (not random)
const daPrices = [28, 25, 22, 35, 42, 58, 72, 65, 48, 38, 32, 45]
const fcrPrices = [18, 22, 25, 28, 32, 35, 30, 26, 24, 20, 18, 22]

function getDAPriceDisplayStyle(h: number) {
  const price = daPrices[h - 1] ?? 30
  const min = Math.min(...daPrices)
  const max = Math.max(...daPrices)
  const t = (price - min) / (max - min)
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

function getFCRPriceDisplayStyle(h: number) {
  const price = fcrPrices[h - 1] ?? 25
  const min = Math.min(...fcrPrices)
  const max = Math.max(...fcrPrices)
  const t = (price - min) / (max - min)
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

function advance() {
  if (currentStepIndex.value < steps.length - 1) {
    currentStepIndex.value++
  } else {
    router.push('/game')
  }
}

function goBack() {
  if (currentStepIndex.value > 0) {
    currentStepIndex.value--
  }
}

const isLastStep = computed(() => currentStepIndex.value === steps.length - 1)

function handleKeydown(e: KeyboardEvent) {
  if (e.key === ' ' || e.key === 'ArrowRight' || e.key === 'Enter') {
    e.preventDefault()
    if (!isLastStep.value) {
      advance()
    }
  } else if (e.key === 'ArrowLeft') {
    e.preventDefault()
    goBack()
  } else if (e.key === 'Escape') {
    router.push('/')
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<template>
  <div class="tutorial-screen">
    <!-- Mock bidding interface (shown for bidding steps) -->
    <div v-if="currentStep.highlight?.startsWith('bidding') || currentStep.highlight?.startsWith('fleet') || currentStep.highlight?.startsWith('da-') || currentStep.highlight?.startsWith('fcr-')" class="mock-bidding-interface">
      <header class="mock-bidding-header">
        <h1>Day-Ahead Bidding</h1>
        <div 
          class="mock-fleet-info"
          :class="{ highlighted: currentStep.highlight === 'fleet-capacity' }"
        >
          <span class="fleet-stat">Fleet: 70 MWh</span>
          <span class="fleet-stat">45 MW</span>
        </div>
      </header>

      <div class="mock-market-tabs">
        <button :class="['mock-tab', { active: currentStep.highlight === 'da-bid-chart' }]">
          DA Market <span class="mock-revenue">+1,240 €</span>
        </button>
        <button :class="['mock-tab', { active: currentStep.highlight === 'fcr-bid-chart' }]">
          FCR Market <span class="mock-revenue">+890 €</span>
        </button>
      </div>

      <div 
        v-if="currentStep.highlight === 'da-bid-chart' || currentStep.highlight === 'da-prices'"
        class="mock-bid-chart-section highlighted"
      >
        <div class="mock-chart-header">
          <span>Day-Ahead Energy (EUR/MWh)</span>
          <span class="mock-hint">Click/drag to bid. Up = sell, Down = buy</span>
        </div>
        <div class="mock-da-chart">
          <div class="mock-zero-line"></div>
          <div v-for="h in 12" :key="h" class="mock-bar-slot">
            <div 
              class="mock-price" 
              :class="{ 'price-highlighted': currentStep.highlight === 'da-prices' }"
              :style="getDAPriceDisplayStyle(h)"
            >{{ daPrices[h - 1] }}</div>
            <div class="mock-bar-area">
              <div v-if="h > 4 && h < 10" class="mock-bar sell" :style="{ height: `${20 + h * 5}%` }"></div>
            </div>
            <div class="mock-hour">{{ (h + 5).toString().padStart(2, '0') }}</div>
          </div>
        </div>
        <div class="mock-scale">
          <span>+45 MW (sell)</span>
          <span>0</span>
          <span>-45 MW (buy)</span>
        </div>
      </div>

      <div 
        v-if="currentStep.highlight === 'fcr-bid-chart' || currentStep.highlight === 'fcr-prices'"
        class="mock-bid-chart-section highlighted"
      >
        <div class="mock-chart-header">
          <span>FCR Capacity (EUR/MW/h)</span>
          <span class="mock-hint">Click/drag to bid symmetric reserve</span>
        </div>
        <div class="mock-fcr-chart">
          <div v-for="h in 12" :key="h" class="mock-bar-slot">
            <div 
              class="mock-price fcr" 
              :class="{ 'price-highlighted': currentStep.highlight === 'fcr-prices' }"
              :style="getFCRPriceDisplayStyle(h)"
            >{{ fcrPrices[h - 1] }}</div>
            <div class="mock-bar-area">
              <div v-if="h > 2 && h < 9" class="mock-bar fcr" :style="{ height: `${30 + h * 7}%` }"></div>
            </div>
            <div class="mock-hour">{{ (h + 5).toString().padStart(2, '0') }}</div>
          </div>
        </div>
        <div class="mock-scale fcr-scale">
          <span>45 MW</span>
          <span>0</span>
        </div>
      </div>

      <div v-if="currentStep.highlight === 'bidding-intro'" class="mock-bidding-placeholder">
        <div class="bidding-intro-visual">
          <div class="market-preview da">
            <span class="market-icon">📊</span>
            <span class="market-name">DA Market</span>
            <span class="market-desc">Sell/buy energy</span>
          </div>
          <div class="market-preview fcr">
            <span class="market-icon">⚡</span>
            <span class="market-name">FCR Market</span>
            <span class="market-desc">Reserve capacity</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Mock game interface (shown for game steps) -->
    <div v-else class="mock-interface">
      <header class="mock-header">
        <h1>Day Simulation</h1>
        <div class="mock-header-stats">
          <div class="mock-frequency" :class="{ highlighted: currentStep.highlight === 'frequency-display' }">
            50.000 Hz
          </div>
          <div class="mock-time">12:30:00 / 24:00:00</div>
        </div>
      </header>

      <div class="mock-controls" :class="{ highlighted: currentStep.highlight === 'controls' }">
        <div class="mock-speed-controls">
          <span class="label">Speed:</span>
          <button class="active">1x</button>
          <button>10x</button>
          <button>50x</button>
          <button>1000x</button>
          <button>10000x</button>
        </div>
        <button class="mock-pause-btn">Pause (Space)</button>
      </div>

      <div class="mock-main-content">
        <div class="mock-bess-panel" :class="{ highlighted: currentStep.highlight === 'bess-panel' }">
          <div class="mock-panel-header">
            <span>Battery Fleet</span>
            <span>+15.0 MW</span>
          </div>
          <div class="mock-bess-unit">
            <div class="mock-unit-header">
              <span>BESS Alpha</span>
              <span>10MW / 20MWh</span>
            </div>
            <div class="mock-soc-meter">
              <div class="mock-soc-fill" style="width: 65%"></div>
            </div>
            <div class="mock-power">+8.5 MW</div>
            <button 
              class="mock-market-toggle"
              :class="{ highlighted: currentStep.highlight === 'market-toggle' }"
            >AUTO (DA)</button>
            <div 
              class="mock-unit-controls"
              :class="{ highlighted: currentStep.highlight === 'unit-controls' }"
            >
              <button>Charge</button>
              <button>Discharge</button>
            </div>
          </div>
          <div class="mock-bess-unit">
            <div class="mock-unit-header">
              <span>BESS Beta</span>
              <span>20MW / 20MWh</span>
            </div>
            <div class="mock-soc-meter">
              <div class="mock-soc-fill" style="width: 45%"></div>
            </div>
            <div class="mock-power">+6.5 MW</div>
            <button class="mock-market-toggle">AUTO (FCR)</button>
            <div class="mock-unit-controls">
              <button>Charge</button>
              <button>Discharge</button>
            </div>
          </div>
        </div>

        <div class="mock-charts-column">
          <div 
            class="mock-chart-tabs"
            :class="{ highlighted: currentStep.highlight === 'chart-tabs' }"
          >
            <button class="active">System Frequency</button>
            <button :class="{ highlighted: currentStep.highlight === 'da-chart' }">DA Bids</button>
            <button :class="{ highlighted: currentStep.highlight === 'fcr-chart' }">FCR Bids</button>
            <button>Imbalance</button>
          </div>
          <div class="mock-chart">
            <div class="mock-chart-placeholder">
              <svg viewBox="0 0 400 100" class="mock-line-chart">
                <path d="M0,50 Q100,30 200,50 T400,45" fill="none" stroke="#10b981" stroke-width="2"/>
                <line x1="0" y1="50" x2="400" y2="50" stroke="#e5e7eb" stroke-dasharray="4"/>
              </svg>
            </div>
          </div>

          <div 
            class="mock-advanced-section"
            :class="{ highlighted: currentStep.highlight === 'advanced-section' }"
          >
            <button class="mock-advanced-header">
              <span>Advanced Charts</span>
              <span>▼</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Tutorial overlay -->
    <div class="tutorial-overlay" :class="[`position-${currentStep.position}`]">
      <div class="tutorial-card">
        <div class="step-indicator">
          Step {{ currentStepIndex + 1 }} of {{ steps.length }}
        </div>
        <h2>{{ currentStep.title }}</h2>
        <p>{{ currentStep.description }}</p>
        <div class="tutorial-nav">
          <button v-if="currentStepIndex > 0" class="nav-btn secondary" @click="goBack">
            ← Back
          </button>
          <button class="nav-btn primary" @click="advance">
            {{ isLastStep ? 'Start Playing →' : 'Next →' }}
          </button>
        </div>
        <div v-if="!isLastStep" class="hint">Press <kbd>Space</kbd> to continue</div>
        <div v-else class="hint final">Click the button above to start</div>
      </div>
    </div>

    <button class="skip-btn" @click="router.push('/game')">
      Skip Tutorial
    </button>
  </div>
</template>

<style scoped>
.tutorial-screen {
  min-height: 100vh;
  background: var(--color-gray-50);
  position: relative;
}

/* Mock interface styles */
.mock-interface {
  max-width: 1200px;
  margin: 0 auto;
  padding: 1rem;
  opacity: 0.6;
  pointer-events: none;
}

.mock-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.mock-header h1 {
  color: var(--gridio-sky-vivid);
  margin: 0;
  font-size: 1.5rem;
  font-weight: 600;
}

.mock-header-stats {
  display: flex;
  gap: 0.5rem;
}

.mock-frequency, .mock-time {
  background: white;
  padding: 0.5rem 1rem;
  border-radius: 12px;
  font-family: monospace;
  font-weight: 500;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.mock-frequency {
  background: #D1FAE5;
  color: #059669;
}

.mock-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: white;
  padding: 0.75rem;
  border-radius: 16px;
  margin-bottom: 1rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.mock-speed-controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.mock-speed-controls .label {
  color: var(--color-gray-500);
  font-size: 0.875rem;
}

.mock-speed-controls button {
  background: var(--color-gray-50);
  border: 1px solid var(--color-gray-300);
  color: var(--color-gray-700);
  padding: 0.5rem 0.75rem;
  border-radius: 12px;
  font-size: 0.875rem;
}

.mock-speed-controls button.active {
  background: var(--gridio-sky-vivid);
  color: white;
  border-color: var(--gridio-sky-vivid);
}

.mock-pause-btn {
  background: var(--color-gray-100);
  border: 1px solid var(--color-gray-300);
  color: var(--color-gray-700);
  padding: 0.5rem 1rem;
  border-radius: 12px;
  font-size: 0.875rem;
}

.mock-main-content {
  display: flex;
  gap: 1rem;
}

.mock-bess-panel {
  background: white;
  border-radius: 12px;
  padding: 0.75rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  width: 240px;
  flex-shrink: 0;
}

.mock-panel-header {
  display: flex;
  justify-content: space-between;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-gray-700);
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--color-gray-200);
  margin-bottom: 0.5rem;
}

.mock-bess-unit {
  background: var(--color-gray-50);
  border-radius: 8px;
  padding: 0.625rem;
  margin-bottom: 0.5rem;
}

.mock-unit-header {
  display: flex;
  justify-content: space-between;
  font-size: 0.7rem;
  margin-bottom: 0.25rem;
}

.mock-soc-meter {
  height: 14px;
  background: var(--color-gray-200);
  border-radius: 2px;
  overflow: hidden;
}

.mock-soc-fill {
  height: 100%;
  background: linear-gradient(to right, #22c55e, #4ade80);
}

.mock-power {
  font-size: 0.6rem;
  color: #10b981;
  text-align: right;
  margin-top: 0.25rem;
}

.mock-market-toggle {
  width: 100%;
  padding: 0.5rem;
  margin-top: 0.5rem;
  font-size: 0.75rem;
  font-weight: 700;
  border: 2px solid #22c55e;
  border-radius: 6px;
  background: #f0fdf4;
  color: #166534;
}

.mock-unit-controls {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 3px;
  margin-top: 0.5rem;
}

.mock-unit-controls button {
  padding: 0.375rem;
  font-size: 0.65rem;
  border: 1px solid var(--color-gray-300);
  border-radius: 4px;
  background: white;
}

.mock-charts-column {
  flex: 1;
}

.mock-chart-tabs {
  display: flex;
  gap: 0.25rem;
  margin-bottom: 0.5rem;
}

.mock-chart-tabs button {
  background: var(--color-gray-100);
  border: 1px solid var(--color-gray-200);
  color: var(--color-gray-600);
  padding: 0.25rem 0.5rem;
  border-radius: 6px;
  font-size: 0.7rem;
}

.mock-chart-tabs button.active {
  background: var(--gridio-sky-vivid);
  color: white;
  border-color: var(--gridio-sky-vivid);
}

.mock-chart {
  background: white;
  border-radius: 16px;
  padding: 1rem;
  height: 200px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.mock-chart-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.mock-line-chart {
  width: 100%;
  height: 80px;
}

.mock-advanced-section {
  margin-top: 1rem;
}

.mock-advanced-header {
  width: 100%;
  background: var(--color-gray-50);
  border: 1px solid var(--color-gray-200);
  border-radius: 12px;
  padding: 0.75rem 1rem;
  display: flex;
  justify-content: space-between;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-gray-600);
}

/* Highlighted elements */
.highlighted {
  opacity: 1 !important;
  position: relative;
  z-index: 10;
  box-shadow: 0 0 0 4px var(--gridio-sky-vivid), 0 0 20px rgba(68, 103, 254, 0.4) !important;
  border-radius: 12px;
  animation: pulse-highlight 2s infinite;
}

@keyframes pulse-highlight {
  0%, 100% { box-shadow: 0 0 0 4px var(--gridio-sky-vivid), 0 0 20px rgba(68, 103, 254, 0.4); }
  50% { box-shadow: 0 0 0 6px var(--gridio-sky-vivid), 0 0 30px rgba(68, 103, 254, 0.6); }
}

/* Tutorial overlay */
.tutorial-overlay {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  pointer-events: none;
}

.tutorial-overlay.position-top {
  align-items: flex-start;
  padding-top: 6rem;
}

.tutorial-overlay.position-bottom {
  align-items: flex-end;
  padding-bottom: 6rem;
}

.tutorial-overlay.position-left {
  justify-content: flex-start;
  padding-left: 300px;
}

.tutorial-overlay.position-right {
  justify-content: flex-end;
  padding-right: 2rem;
}

.tutorial-card {
  background: white;
  border-radius: 16px;
  padding: 1.5rem 2rem;
  max-width: 400px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  pointer-events: auto;
}

.step-indicator {
  font-size: 0.75rem;
  color: var(--color-gray-500);
  margin-bottom: 0.5rem;
}

.tutorial-card h2 {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--gridio-sky-vivid);
  margin-bottom: 0.75rem;
}

.tutorial-card p {
  font-size: 0.95rem;
  color: var(--color-gray-700);
  line-height: 1.6;
  margin-bottom: 1.25rem;
}

.tutorial-nav {
  display: flex;
  gap: 0.75rem;
  justify-content: flex-end;
}

.nav-btn {
  padding: 0.625rem 1.25rem;
  font-size: 0.875rem;
  border: none;
  border-radius: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.nav-btn.primary {
  background: var(--gridio-sky-vivid);
  color: white;
}

.nav-btn.primary:hover {
  background: #3355e0;
}

.nav-btn.secondary {
  background: var(--color-gray-100);
  color: var(--color-gray-700);
}

.nav-btn.secondary:hover {
  background: var(--color-gray-200);
}

.hint {
  text-align: center;
  color: var(--color-gray-400);
  font-size: 0.8rem;
  margin-top: 1rem;
}

.hint.final {
  color: var(--gridio-sky-vivid);
  font-weight: 500;
}

kbd {
  background: var(--color-gray-100);
  padding: 0.2em 0.5em;
  border-radius: 4px;
  font-family: inherit;
  font-size: 0.9em;
}

.skip-btn {
  position: fixed;
  bottom: 1.5rem;
  right: 1.5rem;
  background: none;
  border: none;
  color: var(--color-gray-400);
  font-size: 0.875rem;
  cursor: pointer;
  transition: color 0.2s;
  z-index: 100;
}

.skip-btn:hover {
  color: var(--color-gray-600);
}

/* Mock bidding interface styles */
.mock-bidding-interface {
  max-width: 900px;
  margin: 0 auto;
  padding: 1.5rem;
  opacity: 0.7;
}

.mock-bidding-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.mock-bidding-header h1 {
  color: var(--gridio-sky-vivid);
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0;
}

.mock-fleet-info {
  display: flex;
  gap: 1rem;
  padding: 0.5rem 1rem;
  background: white;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.fleet-stat {
  font-size: 0.85rem;
  color: var(--color-gray-600);
  background: var(--color-gray-100);
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-weight: 500;
}

.mock-market-tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.mock-tab {
  flex: 1;
  padding: 0.75rem;
  border: 2px solid var(--color-gray-200);
  background: white;
  border-radius: 8px;
  font-weight: 500;
  font-size: 0.9rem;
  color: var(--color-gray-600);
  display: flex;
  justify-content: space-between;
}

.mock-tab.active {
  border-color: var(--gridio-sky-vivid);
  color: var(--gridio-sky-vivid);
  background: #f0f4ff;
}

.mock-revenue {
  font-size: 0.8rem;
  font-weight: 600;
  color: #10b981;
}

.mock-bid-chart-section {
  background: white;
  border-radius: 12px;
  padding: 1rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.mock-chart-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 0.75rem;
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--color-gray-700);
}

.mock-hint {
  font-size: 0.75rem;
  color: var(--color-gray-500);
  font-weight: 400;
}

.mock-da-chart, .mock-fcr-chart {
  display: flex;
  gap: 4px;
  height: 180px;
  position: relative;
}

.mock-da-chart .mock-zero-line {
  position: absolute;
  left: 0;
  right: 0;
  top: 50%;
  height: 1px;
  background: var(--color-gray-300);
  z-index: 1;
}

.mock-bar-slot {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.mock-price {
  text-align: center;
  font-size: 0.65rem;
  color: var(--color-gray-600);
  height: 18px;
  transition: all 0.2s;
}

.mock-price.fcr {
  color: #b45309;
}

.mock-price.price-highlighted {
  background: #fef3c7;
  border-radius: 4px;
  padding: 0 2px;
  animation: price-pulse 1.5s infinite;
}

@keyframes price-pulse {
  0%, 100% { background: #fef3c7; }
  50% { background: #fde68a; }
}

.mock-bar-area {
  flex: 1;
  position: relative;
  background: var(--color-gray-50);
  border-radius: 2px;
}

.mock-da-chart .mock-bar-area {
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.mock-fcr-chart .mock-bar-area {
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
}

.mock-bar {
  position: absolute;
  left: 2px;
  right: 2px;
  border-radius: 2px;
}

.mock-bar.sell {
  background: #10b981;
  bottom: 50%;
}

.mock-bar.fcr {
  background: #f59e0b;
  bottom: 0;
}

.mock-hour {
  font-size: 0.6rem;
  color: var(--color-gray-500);
  text-align: center;
  height: 16px;
}

.mock-scale {
  display: flex;
  justify-content: space-between;
  font-size: 0.65rem;
  color: var(--color-gray-500);
  margin-top: 0.5rem;
}

.mock-scale.fcr-scale {
  flex-direction: column;
}

.mock-bidding-placeholder {
  background: white;
  border-radius: 12px;
  padding: 2rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.bidding-intro-visual {
  display: flex;
  gap: 2rem;
  justify-content: center;
}

.market-preview {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 1.5rem 2rem;
  border-radius: 12px;
  border: 2px solid;
}

.market-preview.da {
  border-color: #3b82f6;
  background: #eff6ff;
}

.market-preview.fcr {
  border-color: #f59e0b;
  background: #fffbeb;
}

.market-icon {
  font-size: 2rem;
}

.market-name {
  font-weight: 600;
  color: var(--color-gray-800);
}

.market-desc {
  font-size: 0.85rem;
  color: var(--color-gray-500);
}
</style>
