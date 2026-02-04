<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { tutorialController } from './TutorialController'

const router = useRouter()

onMounted(() => {
  tutorialController.start()
  router.replace('/game')
})
</script>

<template>
  <div class="loading">
    <p>Starting tutorial...</p>
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
