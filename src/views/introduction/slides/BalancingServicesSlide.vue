<script setup lang="ts">
</script>

<template>
  <div class="slide">
    <div class="icon">⚖️</div>
    <h2 class="slide-title">Balancing Services</h2>
    
    <div class="content">
      <div class="card">
        <h3>FCR — Frequency Containment Reserve</h3>
        <p>Automatic response within seconds. Stabilizes frequency immediately when imbalance occurs.</p>
      </div>
      
      <div class="card">
        <h3>aFRR — Automatic Frequency Restoration</h3>
        <p>Activates within 30 seconds to minutes. Restores frequency back to 50 Hz and relieves FCR.</p>
      </div>
      
      <div class="card">
        <h3>mFRR — Manual Frequency Restoration</h3>
        <p>Activated within 15 minutes for larger, persistent imbalances. Relieves aFRR for sustained events.</p>
      </div>
    </div>
    
    <p class="explanation">
      These reserves work together automatically to keep the grid stable, but they have limited capacity.
    </p>
    
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
  margin-bottom: 1.5rem;
  text-align: center;
}

.content {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: 100%;
  max-width: 500px;
}

.card {
  background: white;
  border-radius: 12px;
  padding: 1rem 1.25rem;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.card h3 {
  font-size: 0.925rem;
  font-weight: 600;
  color: var(--color-gray-800);
  margin-bottom: 0.375rem;
}

.card p {
  font-size: 0.875rem;
  color: var(--color-gray-600);
  line-height: 1.5;
}

.explanation {
  text-align: center;
  color: var(--color-gray-600);
  font-size: 0.925rem;
  line-height: 1.6;
  margin-top: 1.5rem;
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
