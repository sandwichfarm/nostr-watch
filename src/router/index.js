// /router/index.js
import { createRouter, createWebHistory } from 'vue-router'

// import RelaysHome from '@/components/relays/pages/RelaysHome.vue'
import RelaysFind from '@/components/relays/pages/RelaysFind.vue'
import RelaysSingle from '@/components/relays/pages/RelaysSingle.vue'
// import RelaysMap from '@/components/relays/pages/RelaysMap.vue'
import RelaysStatistics from '@/components/relays/pages/RelaysStatistics.vue'
import UserPreferences from '@/components/relays/pages/UserPreferences.vue'

import RedirectComponent from '@/components/relays/redirects/RedirectComponent.vue'

const routes = [
    {
        name: 'preferences',
        path: '/preferences',
        component: UserPreferences
    },

    {
        name: 'relaysAdd',
        path: '/relays/add',
        beforeEnter() {
            window.location.href = 'https://github.com/dskvr/nostr-watch/edit/main/relays.yaml'
        },
        component: RedirectComponent
    },
    // {
    //     path: '/relays/statistics',
    //     component: RelaysStatistics
    // },
    {
        name: 'relays',
        path: '/relays',
        redirect: '/relays/find',
        linkActiveClass: 'router-link-active',
        linkExactActiveClass: 'router-link-exact-active',
        children: [
            {
                name: 'relaysStats',
                path: 'statistics',
                component: RelaysStatistics,
                linkActiveClass: 'router-link-active',
                linkExactActiveClass: 'router-link-exact-active',
            },
            // {
            //     path: 'map',
            //     component: RelaysMap,
            // },
            {
                name: 'relaysFind',
                path: 'find',
                component: RelaysFind,
                linkActiveClass: 'router-link-active',
                linkExactActiveClass: 'router-link-exact-active',
            },
            {
                path: 'find/(*.)',
                component: RelaysFind,
                linkActiveClass: 'router-link-active',
                linkExactActiveClass: 'router-link-exact-active',
            },
            
            
        ]
    },
    {
        path: '/relay/:protocol(ws?s)/:relayUrl(.*)',
        component: RelaysSingle
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
