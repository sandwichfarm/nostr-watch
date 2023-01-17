<template>
  <RelaysNav 
    v-bind:resultsProp="results" />

  <MapSummary 
    :resultsProp="results" 
    :activeSubsectionProp="activeSubsection" /> 

  <div id="wrapper" class="mx-auto max-w-7xl">  
    <div id="subsection_header" class="pt-5 px-1 sm:px-6 lg:px-8" :class="{
      'absolute z-900 w-1/2 top-32': this.store.layout.mapIsExpanded,
      // 'bg-white/50': !this.isMapDark,
      // 'bg-black/50': this.isMapDark
    }"
      style="z-index:9999">
      <div class="sm:flex sm:items-center">
        <div class="sm:flex-auto text-left">
            <h1 class="text-4xl capitalize font-semibold text-gray-900">
                <span class="inline-flex rounded bg-green-800 text-sm px-2 py-1 text-white relative -top-2">
                    {{ getRelaysCount(activeSubsection) }}
                </span>
                {{ activeSubsection }} Relays
            </h1>
            <p class="mt-2 text-xl text-gray-700">
                <!-- {{ store.layout.getActiveItem('relays/find') }} -->
                {{ store.layout.getActiveItem('relays/find')?.description }}
            </p>
        </div>
        <div class="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
          <NostrSync />
          <button 
            v-if="!store.layout.editorExpanded"
            @click="$router.push('/relays/add')" 
            type="button" 
            class="inline-flex items-center justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-m font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:w-auto">
            Add Relay
          </button>
        </div>
      </div>
      <div class="mt-8 flex flex-col">
        <RelaysFindNav />
      </div>
    </div>
    <div id="relays_list_wrapper" v-if="!this.store.layout.mapIsExpanded">
      <div 
          v-for="subsection in navSubsection"
          :key="subsection.slug" > 
          <div v-if="subsection.slug == activeSubsection">
            <RelaysResultTable
              :resultsProp="results"
              :subsectionProp="subsection.slug" /> 
          </div>
      </div>
    </div>
  </div>
</template>

<script>
//vue
import { defineComponent, defineAsyncComponent } from 'vue'
//pinia
import { setupStore } from '@/store'
//shared methods
import RelaysLib from '@/shared/relays-lib.js'
import SharedComputed from '@/shared/computed.js'
import { parseHash } from '@/shared/hash-router.js'

import NostrSync from '@/components/relays/partials/NostrSync.vue'

//components
// import RelaysFindNav from '@/components/relays/nav/RelaysFindNav.vue'
// import RelaysResultTable from '@/components/relays/blocks/RelaysResultTable.vue'
// import MapSummary from '@/components/relays/blocks/MapSummary.vue'
import { relays } from '../../../../relays.yaml'
import { geo } from '../../../../cache/geo.yaml'

const localMethods = {}

const MapSummary = defineAsyncComponent(() =>
    import("@/components/relays/blocks/MapSummary.vue" /* webpackChunkName: "MapSummary" */)
);

const RelaysNav = defineAsyncComponent(() =>
    import("@/components/relays/nav/RelaysNav.vue" /* webpackChunkName: "RelaysNav" */)
);

const RelaysFindNav = defineAsyncComponent(() =>
    import("@/components/relays/nav/RelaysFindNav.vue" /* webpackChunkName: "RelaysFindNav" */)
);

const RelaysResultTable = defineAsyncComponent(() =>
    import("@/components/relays/blocks/RelaysResultTable.vue" /* webpackChunkName: "RelaysResultTable" */)
);

export default defineComponent({
  name: 'HomePage',

  components: {
    RelaysNav,
    RelaysFindNav,
    MapSummary,
    RelaysResultTable,
    NostrSync,
  },

  setup(){
    // const {resultsProp: results} = toRefs(props)
    return { 
      store : setupStore(),
      // results: results
    }
  },

  props: {
  },

  data() {
    return {
      relays: relays,
      geo: geo,
      timeouts: {},
      intervals: {},
      relaysCount: {},
      results: {}
      // activeSection: this.routeSection || this.store.layout.getActiveItem('relays')?.slug,
      // activeSubsection: this.routeSubsection || this.store.layout.getActiveItem(`relays/${this.activeSection}`)?.slug,
    }
  },

  updated(){},

  watch: {
    results: function(){
      //console.log('results changed.')
    }
  },

  beforeMount(){
    if(this.path !== 'relays/find')
      this.$router.push('/relays/find')

    // this.routeSection = this.parseHash.section || false
    this.routeSubsection = this.parseHash.subsection || false

    this.store.relays.setRelays(relays)
    this.store.relays.setGeo(geo)
    
    this.relays = this.store.relays.getAll
    this.lastUpdate = this.store.tasks.getLastUpdate('relays')
    this.preferences = this.store.prefs.get
  },

  async mounted() {
    console.log('map expanded', this.store.layout.mapIsExpanded, 'is dark', localStorage.getItem('isDark'))
    //console.log("findrelays mounted", this.results)
    this.navSubsection.forEach( item => this.relaysCount[item.slug] = 0 ) //move this

    // this.relays.forEach(relay => {
    //   this.results[relay] = this.getCache(relay)
    // })
    //console.log('RESULTS!', this.navSubsection, this.relays, this.results)
    // this.relaysMountNav()
  },

  computed: Object.assign(SharedComputed, {
    activeSection: function(){ return this.store.layout.getActiveItem('relays')?.slug },
    activeSubsection: function(){ return this.store.layout.getActiveItem(`relays/find`)?.slug },
    navSubsection: function() { return this.store.layout.getNavGroup(`relays/find`) || [] },
    getRelaysCount: function() { 
      return (subsection) => {
        if(subsection === 'all')
          return this.store.relays.getAll.length 
        if(subsection === 'favorite')
          return this.store.relays.getFavorites.length 
        return this.store.relays.getAll.filter( (relay) => this.results?.[relay]?.aggregate == subsection).length 
      }
    },
    isMapDark: function(){
      // return this.store.layout.mapIsExpanded && this.$storage.('isDark') == true
    },
    parseHash
  }),

  methods: Object.assign(RelaysLib, localMethods), 

})
</script>