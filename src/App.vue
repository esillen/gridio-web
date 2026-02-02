<script setup lang="ts">
import { watch } from 'vue'
import { useRouter } from 'vue-router'
import { gameState } from './game/GameState'

const router = useRouter()

watch(() => gameState.phase, (phase) => {
  if (phase === 'end') {
    router.push('/end')
  }
})
</script>

<template>
  <RouterView />
</template>
