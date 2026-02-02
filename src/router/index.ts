import { createRouter, createWebHistory } from 'vue-router'
import StartOfDayScreen from '../views/StartOfDayScreen.vue'
import DayScreen from '../views/DayScreen.vue'
import EndOfDayScreen from '../views/EndOfDayScreen.vue'
import { gameState } from '../game/GameState'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      component: StartOfDayScreen
    },
    {
      path: '/day',
      component: DayScreen,
      beforeEnter: () => {
        if (gameState.phase !== 'day') {
          return '/'
        }
      }
    },
    {
      path: '/end',
      component: EndOfDayScreen,
      beforeEnter: () => {
        if (gameState.phase !== 'end') {
          return '/'
        }
      }
    }
  ]
})

export default router
