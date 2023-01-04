<template>
  <metainfo>
    <template v-slot:title="{ content }">{{ content }}</template>
  </metainfo>

  <SubnavComponent 
    v-bind:resultsProp="results" />

  <MapSummary 
    :resultsProp="results" 
    :activePageItemProp="activeSubsection"
    v-if="activeSection == 'find'" /> 

  <div id="wrapper" class="mx-auto max-w-7xl">  
    <div v-if="activeSection == 'find'">
      <div class="pt-5 px-1 sm:px-6 lg:px-8">
        <div class="sm:flex sm:items-center">
        <div class="sm:flex-auto text-left">
            <h1 class="text-4xl capitalize font-semibold text-gray-900">
                <span class="inline-flex rounded bg-green-800 text-sm px-2 py-1 text-white relative -top-2">
                    {{ relaysCount[activeSubsection] }}
                </span>
                {{ activeSubsection }} Relays
            </h1>
            <p class="mt-2 text-xl text-gray-700">
              <!-- {{ store.layout.getActiveItem('relays/find') }} -->
              {{ store.layout.getActiveItem('relays/find')?.description }}
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
        v-for="subsection in navSubsection"
              :key="subsection.slug"> 

          <!-- <div v-if="section.slug == activeSubsection"> -->
          <div :class="subsection.slug == activeSubsection ? 'visible' : 'hidden'">
            <ListClearnet
              :resultsProp="results"
              :subsectionProp="subsection.slug"
              v-bind:relaysCountProp="relaysCount"
              /> 
          </div>
      </div>
    </div>

    <RelayStatistics
      :resultsProp="results"
      v-if="activeSection == 'statistics'" /> 
    
    <MapInteractive
      :resultsProp="results"
      v-if="activeSection == 'map'" /> 
    
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
import { parseHash } from '@/shared/hash-router.js'

//components
import MapSummary from '@/components/relays/MapSummary.vue'
import SubnavComponent from '@/components/relays/SubnavComponent.vue'
import FindRelaysSubnav from '@/components/relays/FindRelaysSubnav.vue'
import ListClearnet from '@/components/relays/ListClearnet.vue'
import RelayStatistics from '@/components/relays/RelayStatistics.vue'
import MapInteractive from '@/components/relays/MapInteractive.vue'
//data
import { relays } from '../../../../relays.yaml'
import { geo } from '../../../../cache/geo.yaml'

const localMethods = {
  relaysLoadData(){
    this.store.relays.setRelays(relays)
    this.store.relays.setGeo(geo)

    this.relays = this.store.relays.getAll
    this.lastUpdate = this.store.relays.lastUpdate
    this.preferences = this.store.prefs.get

    this.relays.forEach(relay => {
      this.results[relay] = this.getCache(relay)
    })
  },
  relaysMountNav(){
    this.store.layout.$subscribe( (mutation) => {
      if(mutation.events.key === 'relays'){
        this.activeSection = mutation.events.newValue
      }
      if(mutation.events.key === 'relays/find'){
        this.activeSubsection = mutation.events.newValue
      }
    })

    this.activeSection = this.routeSection || this.store.layout.getActiveItem('relays')?.slug
    this.activeSubsection = this.routeSubsection || this.store.layout.getActiveItem(`relays/${this.activeSection}`)?.slug

    this.navSubsection.forEach( item => this.relaysCount[item.slug] = 0 )
  }
  // hashRouter: function(){
  //   const route = this.parseRouterHash()
  //   if(route.section)
  //     this.activeSection = route.section
  //   if(route.subsection)
  //     this.activeSubsection = route.subsection
  //   if(route.relay)
  //     this.activeSubsection = route.relay
  // },
}

export default defineComponent({
  name: 'HomePage',

  components: {
    MapSummary,
    ListClearnet,
    SubnavComponent,
    FindRelaysSubnav,
    RelayStatistics,
    MapInteractive
  },

  setup(){
    useHead({
      title: 'nostr.watch',
      meta: [{
          name: `description`,
          content: 'A robust client-side nostr relay monitor. Find fast nostr relays, view them on a map and monitor the network status of nostr.',
        }] 
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
      relaysCount: {},
      activeSection: this.routeSection || this.store.layout.getActiveItem('relays')?.slug,
      activeSubsection: this.routeSubsection || this.store.layout.getActiveItem(`relays/${this.activeSection}`)?.slug,
    }
  },

  updated(){},

  beforeMount(){
    this.routeSection = this.parseHash().section || false
    this.routeSubsection = this.parseHash().subsection || false
  },

  async mounted() {
    this.relaysLoadData()
    this.relaysMountNav()
  },

  computed: {
    navSubsection: function() { return this.store.layout.getNavGroup(`relays/${this.activeSection}`) || [] }
  },

  methods: Object.assign(RelaysLib, localMethods, { parseHash }), 

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