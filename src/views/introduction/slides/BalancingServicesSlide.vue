<script setup lang="ts">
</script>

<template>
  <div class="slide">
    <div class="icon">💰</div>
    <h2 class="slide-title">Getting Paid to Balance</h2>
    
    <div class="content">
      <p class="intro-text">
        Grid operators pay market participants to provide balancing capacity. 
        The faster you can respond, the more valuable your service.
      </p>
      
      <div class="markets">
        <div class="market-card fcr">
          <div class="market-icon">⚡</div>
          <h3>FCR-N Market</h3>
          <p>Get paid for <strong>capacity</strong> — your ability to respond within seconds when frequency deviates.</p>
        </div>

        <p class="explanation">
      Actors who can quickly adjust their power output or consumption are essential for grid stability.
    </p>
        
        we
      </div>
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
  gap: 1.5rem;
  width: 100%;
  max-width: 500px;
}

.intro-text {
  text-align: center;
  font-size: 1.05rem;
  color: var(--color-gray-700);
  line-height: 1.6;
}

.markets {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.market-card {
  background: white;
  border-radius: 12px;
  padding: 1.25rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  border-left: 4px solid;
}

.market-card.fcr {
  border-color: #F59E0B;
}

.market-card.da {
  border-color: #3b82f6;
}

.market-icon {
  font-size: 1.5rem;
  flex-shrink: 0;
}

.market-card h3 {
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-gray-800);
  margin-bottom: 0.25rem;
}

.market-card p {
  font-size: 0.9rem;
  color: var(--color-gray-600);
  line-height: 1.5;
}

.market-card p strong {
  color: var(--gridio-sky-vivid);
}

.explanation {
  text-align: center;
  color: var(--color-gray-500);
  font-size: 0.9rem;
  line-height: 1.6;
  margin-top: 1rem;
  padding: 0 1rem;
  max-width: 450px;
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
