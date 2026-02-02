<script setup lang="ts">
import { watch, onMounted, onUnmounted } from 'vue'

const props = defineProps<{
  show: boolean
  canGoLeft?: boolean
  canGoRight?: boolean
}>()

const emit = defineEmits<{
  close: []
  goLeft: []
  goRight: []
}>()

function handleKeydown(e: KeyboardEvent) {
  if (!props.show) return
  
  if (e.key === 'Escape') {
    emit('close')
  } else if (e.key === 'ArrowLeft' && props.canGoLeft) {
    emit('goLeft')
  } else if (e.key === 'ArrowRight' && props.canGoRight) {
    emit('goRight')
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
})

watch(() => props.show, (newShow) => {
  if (newShow) {
    document.body.style.overflow = 'hidden'
  } else {
    document.body.style.overflow = ''
  }
})
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="show" class="modal-overlay" @click="emit('close')">
        <div class="modal-content" @click.stop>
          <button class="close-btn" @click="emit('close')">×</button>
          <button 
            v-if="canGoLeft" 
            class="nav-btn nav-left" 
            @click="emit('goLeft')"
            title="Previous (←)"
          >
            ‹
          </button>
          <button 
            v-if="canGoRight" 
            class="nav-btn nav-right" 
            @click="emit('goRight')"
            title="Next (→)"
          >
            ›
          </button>
          <slot></slot>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 2rem;
  overflow-y: auto;
}

.modal-content {
  background: white;
  border-radius: 16px;
  max-width: 700px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  position: relative;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.close-btn {
  position: absolute;
  top: 1rem;
  right: 1rem;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: none;
  background: var(--color-gray-100);
  color: var(--color-gray-600);
  font-size: 24px;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
  z-index: 1;
}

.close-btn:hover {
  background: var(--color-gray-200);
  color: var(--color-gray-900);
}

.nav-btn {
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border: 2px solid var(--color-gray-300);
  background: white;
  color: var(--color-gray-700);
  font-size: 28px;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  z-index: 10;
}

.nav-left {
  left: 12px;
}

.nav-right {
  right: 12px;
}

.nav-btn:hover {
  background: var(--gridio-sky-vivid);
  border-color: var(--gridio-sky-vivid);
  color: white;
  transform: translateY(-50%) scale(1.15);
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
}

.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-active .modal-content,
.modal-leave-active .modal-content {
  transition: transform 0.2s;
}

.modal-enter-from .modal-content,
.modal-leave-to .modal-content {
  transform: scale(0.95);
}
</style>
