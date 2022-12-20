// /router/index.js
import { createRouter, createWebHistory } from 'vue-router'
import HomePage from '../pages/HomePage.vue'
// import ByStatus from '../pages/ByStatus.vue'
import SingleRelay from '../pages/SingleRelay.vue'

const routes = [
    {
        path: '/relay/:relayUrl(.*)',
        // name: 'nostr.watch - :relayUrl',
        component: SingleRelay
    },
    // {
    //     path: '/availability',
    //     // name: 'nostr.watch',
    //     component: ByStatus
    // },
    //  Added our new route file named profile.vue
    {
        path: '/',
        // name: 'nostr.watch',
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
