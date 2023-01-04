<template>
  <metainfo>
    <template v-slot:title="{ content }">{{ content }}</template>
  </metainfo>

  <SubnavComponent 
    v-bind:resultsProp="results" />

  <MapSummary 
    :resultsProp="results" 
    :activePageItemProp="activePageItem"
    v-if="activeNavItem == 'find'" /> 

  <div id="wrapper" class="mx-auto max-w-7xl">  
    <div v-if="activeNavItem == 'find'">
      <div class="pt-5 px-1 sm:px-6 lg:px-8">
        <div class="sm:flex sm:items-center">
        <div class="sm:flex-auto text-left">
            <h1 class="text-4xl capitalize font-semibold text-gray-900">
                <span class="inline-flex rounded bg-green-800 text-sm px-2 py-1 text-white relative -top-2">
                    {{ this.relaysCount[activePageItem] }}
                </span>
                {{ activePageItem }} Relays
            </h1>
            <p class="mt-2 text-xl text-gray-700">
              <!-- {{ store.layout.getActiveItem('relays-find-pagenav') }} -->
              {{ store.layout.getActiveItem('relays-find-pagenav').description }}
            </p>
        </div>
        <div class="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
            <button 
              @click="$router.push('/relays/add')" 
              type="button" 
              class="inline-flex items-center justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-m font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:w-auto">
              Add Relay
            </button>
        </div>
        </div>
        <div class="mt-8 flex flex-col">

        <FindRelaysSubnav />

        </div>
      </div>

      <div 
        v-for="section in navSubsection"
        :key="section.slug"> 
          <!-- <div v-if="section.slug == activePageItem"> -->
          <div :class="section.slug == activePageItem ? 'visible' : 'hidden'">
            <ListClearnet
              :resultsProp="results"
              :activePageItemProp="section.slug"
              v-bind:relaysCountProp="relaysCount"
              /> 
          </div>
      </div>
    </div>


    <RelayStatistics
      :resultsProp="results"
      v-if="activeNavItem == 'statistics'" /> 
    
    <RelayStatistics
      :resultsProp="results"
      v-if="activeNavItem == 'map'" /> 
    
    <div id="footer">
      <span class="credit">
        <!-- <a href="http://sandwich.farm">Another 🥪 by sandwich.farm</a>,  -->
        built with <a href="https://github.com/jb55/nostr-js">nostr-js</a> and <a href="https://github.com/dskvr/nostr-relay-inspector">nostr-relay-inspector</a>, inspired by <a href="https://github.com/fiatjaf/nostr-relay-registry">nostr-relay-registry</a></span>
      </div>
  </div>
</template>
<script>
//vue
import { defineComponent } from 'vue'
import { useHead } from '@vueuse/head'
import { setupStore } from '@/store'
//shared methods
import RelaysLib from '@/shared/relays-lib.js'
//components
import MapSummary from '@/components/relays/MapSummary.vue'
import ListClearnet from '@/components/relays/ListClearnet.vue'
import SubnavComponent from '@/components/relays/SubnavComponent.vue'
import FindRelaysSubnav from '@/components/relays/FindRelaysSubnav.vue'
//data
import { relays } from '../../../../relays.yaml'
import { geo } from '../../../../cache/geo.yaml'

export default defineComponent({
  name: 'HomePage',

  components: {
    MapSummary,
    ListClearnet,
    SubnavComponent,
    FindRelaysSubnav
  },

  setup(){
    useHead({
      title: 'nostr.watch',
      meta: [
        {
          name: `description`,
          content: 'A robust client-side nostr relay monitor. Find fast nostr relays, view them on a map and monitor the network status of nostr.',
        },
      ],
    })
    return { 
      store : setupStore()
    }
  },

  data() {
    return {
      relays: [],
      results: {},
      filteredRelays: [],
      timeouts: {},
      intervals: {},
      activeNavItem: this.store.layout.getActive('relays-subnav') || 'relays',
      activePageItem: this.store.layout.getActive('relays-find-pagenav') || 'find',
      navSubsection: this.store.layout.getNavGroup('relays-find-pagenav'),
      relaysCount: {}
    }
  },

  updated(){},

  async mounted() {
    console.log('active page item', this.activePageItem)
    
    this.store.relays.setRelays(relays)
    this.store.relays.setGeo(geo)

    this.relays = this.store.relays.getAll
    this.lastUpdate = this.store.relays.lastUpdate
    this.preferences = this.store.prefs.get

    this.relays.forEach(relay => {
      this.results[relay] = this.getCache(relay)
    })
    this.store.layout.$subscribe( (mutation) => {
      console.log('layout', 'mutation detected')
      if(mutation.events.key == 'relays-find-pagenav')
        this.activePageItem = mutation.events.newValue
      if(mutation.events.key == 'relays-subnav')
        this.activeNavItem = mutation.events.newValue
    })

    this.store.relays.$subscribe( () => {
      console.log('relays', 'mutation detected')
    })

    this.store.user.$subscribe( () => {
      console.log('users', 'mutation detected')
    })

    this.store.relays.$subscribe( () => {
      console.log('prefs', 'mutation detected')
    })

    this.navSubsection.forEach( item => this.relaysCount[item.slug] = 0 )
    // this.psuedoRouter(this.store.layout.getNavGroup('relays-subnav'))
    this.psuedoRouter()
  },

  computed: {
    
  },

  methods: RelaysLib, 

})
</script>

<style>
.list {
  position:relative;
  z-index:1;
}
table {
  border-collapse: collapse !important;
}

body .tabs-component,
body .tabs-component > ul.tabs-component-tabs,
body .tabs-component > ul.tabs-component-tabs > li.nav-item 
  { display: inline !important; }

ul.tabs-component-tabs {
  padding:0;
}

a {
  text-decoration:none;
}

a {
  color:#333;
}

a:hover {
  color: #000;
}

.nav-item {
  cursor:pointer
}

.nav-item.is-active a {
  background:#f0f0f0;
}

li.nav-item a {
  display:inline-block;
  margin-left:9px;
  padding:3px 6px;
}

</style>