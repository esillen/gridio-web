<script setup lang="ts">
</script>

<template>
  <div class="slide">
    <div class="icon">🔋</div>
    <h2 class="slide-title">Your Role: BESS Trader</h2>
    
    <div class="content">
      <p class="main-text">
        You operate a fleet of <strong>Battery Energy Storage Systems (BESS)</strong> — 
        the perfect tool for grid balancing.
      </p>
      
      <div class="bess-benefits">
        <div class="benefit">
          <span class="benefit-icon">⚡</span>
          <div class="benefit-text">
            <strong>Instant Response</strong>
            <span>Batteries can switch from charging to discharging in milliseconds</span>
          </div>
        </div>
        <div class="benefit">
          <span class="benefit-icon">🔄</span>
          <div class="benefit-text">
            <strong>Two-Way Flexibility</strong>
            <span>Absorb excess power or inject power when needed</span>
          </div>
        </div>
      </div>
      
      <div class="your-job">
        <h3>Your Job</h3>
        <div class="job-items">
          <div class="job-item">
            <span class="job-market da">DA</span>
            <span>Commit to deliver/consume energy each hour</span>
          </div>
          <div class="job-item">
            <span class="job-market fcr">FCR</span>
            <span>Reserve capacity for automatic frequency response</span>
          </div>
        </div>
      </div>
      
      <p class="sub-text">
        Maximize revenue while meeting your commitments. Miss your targets and you'll pay penalties!
      </p>
    </div>
    
    <div class="hint">
      Press <kbd>Space</kbd> to continue
    </div>
  </div>
</template>

<style scoped>
.slide {
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 100%;
  padding: 1rem;
}

.icon {
  font-size: 3rem;
  margin-bottom: 0.5rem;
}

.slide-title {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--gridio-sky-vivid);
  margin-bottom: 1rem;
  text-align: center;
}

.content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.25rem;
  width: 100%;
  max-width: 480px;
}

.main-text {
  font-size: 1.05rem;
  color: var(--color-gray-700);
  line-height: 1.6;
  text-align: center;
}

.main-text strong {
  color: var(--gridio-sky-vivid);
}

.bess-benefits {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  width: 100%;
}

.benefit {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  background: white;
  padding: 0.875rem 1rem;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.benefit-icon {
  font-size: 1.25rem;
  flex-shrink: 0;
}

.benefit-text {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.benefit-text strong {
  font-size: 0.9rem;
  color: var(--color-gray-800);
}

.benefit-text span {
  font-size: 0.825rem;
  color: var(--color-gray-500);
}

.your-job {
  width: 100%;
  background: white;
  border-radius: 12px;
  padding: 1rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.your-job h3 {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--color-gray-700);
  margin-bottom: 0.75rem;
  text-align: center;
}

.job-items {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.job-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.875rem;
  color: var(--color-gray-600);
}

.job-market {
  font-size: 0.75rem;
  font-weight: 700;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  flex-shrink: 0;
}

.job-market.da {
  background: #dbeafe;
  color: #1d4ed8;
}

.job-market.fcr {
  background: #fef3c7;
  color: #b45309;
}

.sub-text {
  font-size: 0.9rem;
  color: var(--color-gray-500);
  line-height: 1.5;
  text-align: center;
}

.hint {
  text-align: center;
  color: var(--color-gray-400);
  font-size: 0.875rem;
  margin-top: auto;
  padding-top: 1rem;
}

kbd {
  background: var(--color-gray-100);
  padding: 0.2em 0.5em;
  border-radius: 4px;
  font-family: inherit;
  font-size: 0.9em;
}
</style>
