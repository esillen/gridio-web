<script setup lang="ts">
import { onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { campaignController, type CampaignDay } from './CampaignController'
import { tutorialController } from '../tutorial'

const route = useRoute()
const router = useRouter()

onMounted(() => {
  tutorialController.stop()
  const dayParam = parseInt(route.query.day as string)
  const day = (dayParam >= 1 && dayParam <= 6 ? dayParam : 1) as CampaignDay

  campaignController.startAtDay(day)
  router.replace(`/game?campaign=1&day=${day}`)
})
</script>

<template>
  <div class="loading">
    <p>Starting campaign...</p>
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
