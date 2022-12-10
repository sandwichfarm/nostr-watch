// /router/index.js
import { createRouter, createWebHistory } from 'vue-router'
import HomePage from '../pages/HomePage.vue'
import SingleRelay from '../pages/SingleRelay.vue'

const routes = [
    {
        path: '/',
        name: 'nostr.watch',
        component: HomePage
    },
    //  Added our new route file named profile.vue
    {
        path: '/:relayUrl',
        name: 'nostr.watch - :relayUrl',
        component: SingleRelay
    }
]

// Create Vue Router Object
const router = createRouter({
    history: createWebHistory(),
    base: process.env.BASE_URL,
    routes
})

export default router
