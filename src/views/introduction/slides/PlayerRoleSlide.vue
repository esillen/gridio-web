<script setup lang="ts">
</script>

<template>
  <div class="slide">
    <div class="icon">🎮</div>
    <h2 class="slide-title">Your Role</h2>
    
    <div class="content">
      <p class="main-text">
        You are a <strong>balance responsible party</strong> — an actor who helps keep the grid stable by adjusting production and consumption.
      </p>
      
      <div class="tasks">
        <div class="task">
          <span class="task-icon">📊</span>
          <span class="task-text">Monitor the grid in real-time</span>
        </div>
        <div class="task">
          <span class="task-icon">⚡</span>
          <span class="task-text">React to changing conditions</span>
        </div>
        <div class="task">
          <span class="task-icon">🎯</span>
          <span class="task-text">Keep frequency close to 50 Hz</span>
        </div>
      </div>
      
      <p class="sub-text">
        Weather changes, demand fluctuates, and generators trip. Your job is to maintain balance through it all.
      </p>
    </div>
    
    <div class="hint">
      Press <kbd>Space</kbd> to start the game
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
  font-size: 3.5rem;
  margin-bottom: 0.5rem;
}

.slide-title {
  font-size: 1.75rem;
  font-weight: 600;
  color: var(--gridio-sky-vivid);
  margin-bottom: 1.5rem;
  text-align: center;
}

.content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
  width: 100%;
  max-width: 450px;
}

.main-text {
  font-size: 1.125rem;
  color: var(--color-gray-700);
  line-height: 1.6;
  text-align: center;
}

.main-text strong {
  color: var(--gridio-sky-vivid);
}

.tasks {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  width: 100%;
}

.task {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  background: white;
  padding: 0.875rem 1.25rem;
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.task-icon {
  font-size: 1.25rem;
}

.task-text {
  font-size: 0.95rem;
  color: var(--color-gray-700);
}

.sub-text {
  font-size: 0.925rem;
  color: var(--color-gray-500);
  line-height: 1.6;
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
