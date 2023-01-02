// /router/index.js
import { createRouter, createWebHistory } from 'vue-router'
import RelaysHome from '@/components/relays/pages/RelaysHome.vue'
// import ByStatus from '../pages/ByStatus.vue'
import RelaysSingle from '@/components/relays/pages/RelaysSingle.vue'
import RedirectComponent from '@/components/RedirectComponent.vue'

const routes = [
    {
        path: '/relays/add',
        beforeEnter() {
            window.location.href = 'https://github.com/dskvr/nostr-watch/edit/main/relays.yaml'
        },
        component: RedirectComponent
    },
    {
        path: '/relay/:relayUrl(.*)',
        component: RelaysSingle
    },
    {
        path: '/',
        component: RelaysHome
    },
    
    
]

// Create Vue Router Object
const router = createRouter({
    history: createWebHistory(),
    // base: process.env.BASE_URL,
    routes: routes
})

export default router
