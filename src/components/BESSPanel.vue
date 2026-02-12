<script setup lang="ts">
import { computed } from 'vue'
import { gameState, type BESSMode, type BESSMarket } from '../game/GameState'

const props = withDefaults(defineProps<{
  chargeDischargeEnabled?: boolean
  marketToggleEnabled?: boolean
  hideControls?: boolean
}>(), {
  chargeDischargeEnabled: true,
  marketToggleEnabled: true,
  hideControls: false,
})

const bessUnits = computed(() => gameState.bessStates)
const totalPower = computed(() => gameState.totalBessPowerMW)

function toggleUnitMode(unitId: string, mode: BESSMode) {
  if (!props.chargeDischargeEnabled) return
  
  const unit = bessUnits.value.find(u => u.id === unitId)
  if (unit?.mode === mode) {
    gameState.setUnitMode(unitId, null)
  } else {
    gameState.setUnitMode(unitId, mode)
  }
}

function handleMarketClick(unitId: string) {
  const unit = bessUnits.value.find(u => u.id === unitId)
  if (!unit) return
  
  // If currently charging/discharging, clicking market button clears the mode
  if (unit.mode !== null) {
    gameState.setUnitMode(unitId, null)
    return
  }
  
  // Otherwise cycle market (if enabled)
  if (props.marketToggleEnabled) {
    gameState.cycleUnitMarket(unitId)
  }
}

function getMarketLabel(market: BESSMarket, autoEffective: 'da' | 'fcr' | 'inactive' | null, mode: BESSMode | null): string {
  // Show charging/discharging state on the market button
  if (mode === 'charge') return 'Charging...'
  if (mode === 'discharge') return 'Discharging...'
  
  if (market === 'da') return 'DA'
  if (market === 'fcr') return 'FCR-N'
  if (market === 'auto') {
    if (autoEffective === 'da') return 'AUTO (DA)'
    if (autoEffective === 'fcr') return 'AUTO (FCR-N)'
    return 'AUTO (—)'
  }
  return 'Inactive'
}

function getSocBarFill(barIndex: number, soc01: number): number {
  // 20 bars, each represents 5% (0.05)
  const barValue = barIndex * 0.05
  const nextBarValue = (barIndex + 1) * 0.05
  
  if (soc01 >= nextBarValue) {
    return 1 // Fully filled
  } else if (soc01 <= barValue) {
    return 0 // Empty
  } else {
    return (soc01 - barValue) / 0.05 // Partially filled
  }
}

function formatPower(mw: number): string {
  if (Math.abs(mw) < 0.1) return '0'
  return mw > 0 ? `+${mw.toFixed(1)}` : mw.toFixed(1)
}
</script>

<template>
  <div class="bess-panel">
    <div class="panel-header">
      <span class="title">Battery Fleet</span>
      <span class="total-power" :class="{ charging: totalPower < 0, discharging: totalPower > 0 }">
        {{ formatPower(totalPower) }} MW
      </span>
    </div>

    <div class="units-list">
      <div v-for="unit in bessUnits" :key="unit.id" class="bess-unit">
        <div class="unit-header">
          <span class="unit-name">{{ unit.name }}</span>
          <span class="unit-spec">{{ unit.maxPowerMW }}MW / {{ unit.capacityMWh }}MWh</span>
        </div>
        <div class="soc-container">
          <div class="soc-meter">
            <div 
              v-for="i in 20" 
              :key="i"
              class="soc-bar"
              :style="{ opacity: getSocBarFill(i - 1, unit.soc01) }"
            ></div>
            <div v-if="unit.currentPowerMW < -0.05" class="bess-flow-icon charging" aria-label="Charging">
              <svg viewBox="0 0 36 14" aria-hidden="true">
                <g stroke="currentColor" stroke-width="1.2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="1.5" y="3" width="6" height="8" rx="1" />
                  <line x1="3" y1="1.5" x2="3" y2="3" />
                  <line x1="6" y1="1.5" x2="6" y2="3" />
                  <rect x="28.5" y="3" width="6" height="8" rx="1" />
                  <line x1="34.5" y1="5" x2="34.5" y2="9" />
                  <line x1="34.5" y1="7" x2="35.8" y2="7" />
                  <line x1="11" y1="7" x2="24" y2="7" />
                  <polyline points="21,4 24,7 21,10" />
                </g>
              </svg>
            </div>
            <div v-else-if="unit.currentPowerMW > 0.05" class="bess-flow-icon discharging" aria-label="Discharging">
              <svg viewBox="0 0 36 14" aria-hidden="true">
                <g stroke="currentColor" stroke-width="1.2" fill="none" stroke-linecap="round" stroke-linejoin="round">
                  <rect x="1.5" y="3" width="6" height="8" rx="1" />
                  <line x1="3" y1="1.5" x2="3" y2="3" />
                  <line x1="6" y1="1.5" x2="6" y2="3" />
                  <rect x="28.5" y="3" width="6" height="8" rx="1" />
                  <line x1="34.5" y1="5" x2="34.5" y2="9" />
                  <line x1="34.5" y1="7" x2="35.8" y2="7" />
                  <line x1="24" y1="7" x2="11" y2="7" />
                  <polyline points="14,4 11,7 14,10" />
                </g>
              </svg>
            </div>
          </div>
          <span class="soc-pct">{{ Math.round(unit.soc01 * 100) }}%</span>
        </div>
        <div class="unit-power" :class="{ charging: unit.currentPowerMW < 0, discharging: unit.currentPowerMW > 0 }">
          {{ formatPower(unit.currentPowerMW) }} MW
        </div>
        <button 
          v-if="!hideControls"
          :class="[
            'market-toggle', 
            unit.mode ? 'mode-active' : `market-${unit.market}`, 
            unit.market === 'auto' && !unit.mode ? `auto-${unit.autoEffectiveMarket}` : '',
            { disabled: !marketToggleEnabled && unit.mode === null }
          ]"
          @click="handleMarketClick(unit.id)"
          :disabled="!marketToggleEnabled && unit.mode === null"
          :title="unit.mode ? 'Click to stop and return to market' : (marketToggleEnabled ? 'Click to cycle: DA → FCR-N → AUTO → Inactive' : 'Market toggle disabled')"
        >
          {{ getMarketLabel(unit.market, unit.autoEffectiveMarket, unit.mode) }}
        </button>
        <div v-if="!hideControls" class="unit-controls">
          <button 
            :class="['unit-ctrl-btn', { active: unit.mode === 'charge', disabled: !chargeDischargeEnabled }]"
            @click="toggleUnitMode(unit.id, 'charge')"
            :disabled="!chargeDischargeEnabled"
            :title="chargeDischargeEnabled ? 'Charge at max power (click again to stop)' : 'Charge disabled'"
          >
            Charge
          </button>
          <button 
            :class="['unit-ctrl-btn', { active: unit.mode === 'discharge', disabled: !chargeDischargeEnabled }]"
            @click="toggleUnitMode(unit.id, 'discharge')"
            :disabled="!chargeDischargeEnabled"
            :title="chargeDischargeEnabled ? 'Discharge at max power (click again to stop)' : 'Discharge disabled'"
          >
            Discharge
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.bess-panel {
  background: white;
  border-radius: 12px;
  padding: 0.75rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  width: 240px;
  flex-shrink: 0;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--color-gray-200);
}

.title {
  font-weight: 600;
  font-size: 0.85rem;
  color: var(--color-gray-700);
}

.total-power {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--color-gray-500);
}

.total-power.charging {
  color: #3b82f6;
}

.total-power.discharging {
  color: #10b981;
}


.units-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.bess-unit {
  background: var(--color-gray-50);
  border-radius: 8px;
  padding: 0.625rem;
}

.unit-header {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  margin-bottom: 0.25rem;
}

.unit-name {
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--color-gray-700);
}

.unit-spec {
  font-size: 0.6rem;
  color: var(--color-gray-500);
}

.soc-container {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.soc-meter {
  display: flex;
  gap: 1px;
  flex: 1;
  position: relative;
}

.soc-bar {
  flex: 1;
  height: 14px;
  background: linear-gradient(to right, #22c55e, #4ade80);
  border-radius: 1px;
  transition: opacity 0.2s;
}

.soc-bar:nth-child(-n+6) {
  background: linear-gradient(to right, #ef4444, #f87171);
}

.soc-bar:nth-child(n+7):nth-child(-n+12) {
  background: linear-gradient(to right, #f59e0b, #fbbf24);
}

.bess-flow-icon {
  position: absolute;
  top: 1px;
  right: 2px;
  width: 34px;
  height: 12px;
  color: #1f2937;
  opacity: 0.9;
  pointer-events: none;
  z-index: 1;
}

.bess-flow-icon svg {
  display: block;
  width: 100%;
  height: 100%;
}

.bess-flow-icon.charging {
  color: #3b82f6;
}

.bess-flow-icon.discharging {
  color: #10b981;
}

.soc-pct {
  font-size: 0.65rem;
  font-weight: 600;
  color: var(--color-gray-600);
  min-width: 32px;
  text-align: right;
}

.unit-power {
  font-size: 0.6rem;
  color: var(--color-gray-500);
  text-align: right;
  margin-top: 0.25rem;
}

.unit-power.charging {
  color: #3b82f6;
}

.unit-power.discharging {
  color: #10b981;
}

.market-toggle {
  width: 100%;
  padding: 0.5rem;
  margin-top: 0.5rem;
  font-size: 0.75rem;
  font-weight: 700;
  border: 2px solid;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.market-toggle.market-da {
  background: #dbeafe;
  border-color: #3b82f6;
  color: #1d4ed8;
}

.market-toggle.market-da:hover {
  background: #bfdbfe;
}

.market-toggle.market-fcr {
  background: #fef3c7;
  border-color: #f59e0b;
  color: #b45309;
}

.market-toggle.market-fcr:hover {
  background: #fde68a;
}

.market-toggle.market-auto {
  background: #f0fdf4;
  border-color: #22c55e;
  color: #166534;
}

.market-toggle.market-auto:hover {
  background: #dcfce7;
}

.market-toggle.market-auto.auto-da {
  background: linear-gradient(135deg, #f0fdf4 0%, #dbeafe 100%);
  border-color: #22c55e;
}

.market-toggle.market-auto.auto-fcr {
  background: linear-gradient(135deg, #f0fdf4 0%, #fef3c7 100%);
  border-color: #22c55e;
}

.market-toggle.market-auto.auto-inactive {
  background: linear-gradient(135deg, #f0fdf4 0%, #f3f4f6 100%);
  border-color: #22c55e;
}

.market-toggle.market-inactive {
  background: var(--color-gray-100);
  border-color: var(--color-gray-400);
  color: var(--color-gray-600);
}

.market-toggle.market-inactive:hover {
  background: var(--color-gray-200);
}

.market-toggle.mode-active {
  background: #3b82f6;
  border-color: #3b82f6;
  color: white;
  animation: pulse 1.5s ease-in-out infinite;
}

.market-toggle.mode-active:hover {
  background: #2563eb;
  border-color: #2563eb;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.8; }
}

.unit-controls {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 3px;
  margin-top: 0.5rem;
}

.unit-ctrl-btn {
  padding: 0.375rem 0.25rem;
  font-size: 0.65rem;
  border: 1px solid var(--color-gray-300);
  border-radius: 4px;
  background: white;
  cursor: pointer;
  transition: all 0.15s;
  color: var(--color-gray-600);
  font-weight: 500;
}

.unit-ctrl-btn:hover {
  border-color: var(--color-gray-400);
  background: var(--color-gray-50);
}

.unit-ctrl-btn.active {
  background: #3b82f6;
  border-color: #3b82f6;
  color: white;
  font-weight: 600;
}

.unit-ctrl-btn.disabled,
.market-toggle.disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.unit-ctrl-btn.disabled:hover,
.market-toggle.disabled:hover {
  background: inherit;
  border-color: inherit;
}
</style>
