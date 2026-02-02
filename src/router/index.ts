import { createRouter, createWebHistory } from 'vue-router'
import IntroductionScreen from '../views/IntroductionScreen.vue'
import StartOfDayScreen from '../views/StartOfDayScreen.vue'
import DayScreen from '../views/DayScreen.vue'
import EndOfDayScreen from '../views/EndOfDayScreen.vue'
import { gameState } from '../game/GameState'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      redirect: '/game'
    },
    {
      path: '/introduction',
      component: IntroductionScreen
    },
    {
      path: '/game',
      component: StartOfDayScreen
    },
    {
      path: '/day',
      component: DayScreen,
      beforeEnter: () => {
        if (gameState.phase !== 'day') {
          return '/game'
        }
      }
    },
    {
      path: '/end',
      component: EndOfDayScreen,
      beforeEnter: () => {
        if (gameState.phase !== 'end') {
          return '/game'
        }
      }
    }
  ]
})

export default router
