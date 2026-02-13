import { createRouter, createWebHistory } from 'vue-router'
import LandingPage from '../views/LandingPage.vue'
import IntroductionScreen from '../views/introduction/IntroductionScreen.vue'
import AfterIntroductionScreen from '../views/AfterIntroductionScreen.vue'
import TutorialScreen from '../tutorial/TutorialScreen.vue'
import CampaignScreen from '../campaign/CampaignScreen.vue'
import StartOfDayScreen from '../views/StartOfDayScreen.vue'
import InitializingScreen from '../views/InitializingScreen.vue'
import DayScreen from '../views/DayScreen.vue'
import EndOfDayScreen from '../views/EndOfDayScreen.vue'
import SimulationView from '../views/SimulationView.vue'
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
      path: '/campaign',
      component: CampaignScreen
    },
    {
      path: '/game',
      component: StartOfDayScreen
    },
    {
      path: '/initializing',
      component: InitializingScreen,
      beforeEnter: (to) => {
        if (gameState.phase !== 'initializing') {
          return { path: '/game', query: to.query }
        }
      }
    },
    {
      path: '/day',
      component: DayScreen,
      beforeEnter: (to) => {
        if (gameState.phase !== 'day' && gameState.phase !== 'day_complete') {
          return { path: '/game', query: to.query }
        }
      }
    },
    {
      path: '/end',
      component: EndOfDayScreen,
      beforeEnter: (to) => {
        if (gameState.phase !== 'end') {
          return { path: '/game', query: to.query }
        }
      }
    },
    {
      path: '/simulation',
      component: SimulationView
    }
  ]
})

export default router
