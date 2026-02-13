<script setup lang="ts">
import { onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { tutorialController, type TutorialDay } from './TutorialController'
import { campaignController } from '../campaign'

const route = useRoute()
const router = useRouter()

onMounted(() => {
  campaignController.stop()
  const dayParam = parseInt(route.query.day as string)
  const day = (dayParam >= 1 && dayParam <= 4 ? dayParam : 1) as TutorialDay
  
  tutorialController.startAtDay(day)
  router.replace(`/game?tutorial=1&day=${day}`)
})
</script>

<template>
  <div class="loading">
    <p>Starting tutorial campaign...</p>
  </div>
</template>

<style scoped>
.loading {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  color: var(--color-gray-500);
}
</style>
