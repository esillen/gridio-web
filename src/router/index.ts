import { createRouter, createWebHistory } from 'vue-router'
import LandingPage from '../views/LandingPage.vue'
import IntroductionScreen from '../views/introduction/IntroductionScreen.vue'
import AfterIntroductionScreen from '../views/AfterIntroductionScreen.vue'
import TutorialScreen from '../views/TutorialScreen.vue'
import TutorialNewScreen from '../views/TutorialNewScreen.vue'
import StartOfDayScreen from '../views/StartOfDayScreen.vue'
import InitializingScreen from '../views/InitializingScreen.vue'
import DayScreen from '../views/DayScreen.vue'
import EndOfDayScreen from '../views/EndOfDayScreen.vue'
import { gameState } from '../game/GameState'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      component: LandingPage
    },
    {
      path: '/introduction',
      component: IntroductionScreen
    },
    {
      path: '/after-introduction',
      component: AfterIntroductionScreen
    },
    {
      path: '/tutorial',
      component: TutorialScreen
    },
    {
      path: '/tutorial_new',
      component: TutorialNewScreen
    },
    {
      path: '/game',
      component: StartOfDayScreen
    },
    {
      path: '/initializing',
      component: InitializingScreen,
      beforeEnter: () => {
        if (gameState.phase !== 'initializing') {
          return '/game'
        }
      }
    },
    {
      path: '/day',
      component: DayScreen,
      beforeEnter: () => {
        if (gameState.phase !== 'day' && gameState.phase !== 'day_complete') {
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
