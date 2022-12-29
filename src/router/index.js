// /router/index.js
import { createRouter, createWebHistory } from 'vue-router'
import HomePage from '../pages/HomePage.vue'
// import ByStatus from '../pages/ByStatus.vue'
import SingleRelay from '../pages/SingleRelay.vue'
import TailwindTest from '../pages/TailwindTest.vue'

const routes = [
    {
        path: '/tw',
        component: TailwindTest
    },
    {
        path: '/relay/:relayUrl(.*)',
        component: SingleRelay
    },
    {
        path: '/',
        component: HomePage
    },
    
]

// Create Vue Router Object
const router = createRouter({
    history: createWebHistory(),
    // base: process.env.BASE_URL,
    routes: routes
})

export default router
