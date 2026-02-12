<script setup lang="ts">
import { watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { gameState } from './game/GameState'

const router = useRouter()
const route = useRoute()

watch(() => gameState.phase, (phase) => {
  if (phase === 'end') {
    router.push({ path: '/end', query: route.query })
  }
})
</script>

<template>
  <RouterView />
</template>
