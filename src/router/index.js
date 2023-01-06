// /router/index.js
import { createRouter, createWebHistory } from 'vue-router'

import RelaysHome from '@/components/relays/pages/RelaysHome.vue'
import RelaysFind from '@/components/relays/pages/RelaysFind.vue'
import RelaysSingle from '@/components/relays/pages/RelaysSingle.vue'
import RelaysMap from '@/components/relays/pages/RelaysMap.vue'
import RelaysStatistics from '@/components/relays/pages/RelaysStatistics.vue'

import RedirectComponent from '@/components/relays/redirects/RedirectComponent.vue'

const routes = [
    {
        path: '/relays/add',
        beforeEnter() {
            window.location.href = 'https://github.com/dskvr/nostr-watch/edit/main/relays.yaml'
        },
        component: RedirectComponent
    },
    {
        path: '/relays',
        component: RelaysHome,
        children: [
            {
                path: 'map',
                component: RelaysMap,
                },
            {
            path: 'find',
            component: RelaysFind,
            },
            {
            path: 'find/(*.)',
            component: RelaysFind,
            },
            
            {
            path: 'statistics',
            component: RelaysStatistics,
            },
        ]
    },
    {
        path: '/relay/:relayUrl(.*)',
        component: RelaysSingle
    },
    {
        path: '/',
        component: RelaysFind
    },
    
    
]

// Create Vue Router Object
const router = createRouter({
    history: createWebHistory(),
    // base: process.env.BASE_URL,
    routes: routes
})

export default router
