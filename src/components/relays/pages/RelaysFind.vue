<template>
  <RelaysNav />

  <MapSummary 
    v-if="store.prefs.showMaps"
    :resultsProp="results" 
    :activeSubsectionProp="activeSubsection" /> 

  <div id="wrapper" class="mx-auto max-w-7xl mt-8 mb-8 pb-8">  
    <div
      id="subsection_header" class="pt-5 px-1 sm:px-6 lg:px-8" 
          :class="{
            'absolute z-900 w-1/2 top-32': this.store.layout.mapIsExpanded,
          }"
          style="z-index:9999">
      <div class="sm:flex sm:items-center">
        <div class="sm:flex-auto text-left">
            <h1 class="text-4xl capitalize font-semibold text-gray-900 dark:text-white/90">
                <span class="inline-flex rounded bg-green-800 text-sm px-2 py-1 text-white relative -top-2">
                    <!-- {{ getRelaysCount(activeSubsection) }} -->
                    {{ getRelaysCount }}
                </span>
                {{ store.filters.enabled ? 'Filtered' : activeSubsection }} Relays
            </h1>
            <p class="mt-2 text-xl text-gray-700 dark:text-white/60">
                <!-- {{ store.layout.getActiveItem('relays/find') }} -->
                {{ store.layout.getActiveItem('relays/find')?.description }}
            </p>
        </div>
        <div class="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
          <!-- <NostrSync /> -->
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
        <RelaysFindNav 
          v-bind:relaysProp="relays"
          :resultsProp="results" />
      </div>
      <FiltersPartial
        v-if="store.jobs.getLastUpdate('relays/stats')"
        :resultsProp="results"
        v-bind:relaysProp="relays" />
    </div>
    <div id="relays_list_wrapper" v-if="!this.store.layout.mapIsExpanded">
      <RelaysResultTable
        v-bind:relaysProp="relays"
        :resultsProp="results"
        :subsectionProp="activeSubsection" /> 
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
//data
import { relays } from '../../../../relays.yaml'
import { geo } from '../../../../cache/geo.yaml'

//async components
const FiltersPartial = defineAsyncComponent(() =>
    import("@/components/partials/FiltersPartial.vue" /* webpackChunkName: "FiltersPartial" */)
);

// const NostrSync = defineAsyncComponent(() =>
//     import("@/components/relays/partials/NostrSync.vue" /* webpackChunkName: "NostrSync" */)
// );

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

const localMethods = {}

export default defineComponent({
  name: 'RelaysFind',

  components: {
    RelaysNav,
    RelaysFindNav,
    MapSummary,
    RelaysResultTable,
    // NostrSync,
    FiltersPartial,
    // JobQueue
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
      geo: this.store.relays.geo,
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
    
    if(!process.env.VUE_APP_IP_API_KEY)
      this.store.relays.setGeo(geo)

    this.lastUpdate = this.store.jobs.getLastUpdate('relays')
    this.preferences = this.store.prefs.get
  },

  async mounted() {
    //console.log('map expanded', this.store.layout.mapIsExpanded, 'is dark', localStorage.getItem('isDark'))
    this.navSubsection?.forEach( item => this.relaysCount[item.slug] = 0 ) //move this
  },

  computed: Object.assign(SharedComputed, {
    activeSection: function(){ return this.store.layout.getActiveItem('relays')?.slug },
    activeSubsection: function(){ return this.store.layout.getActiveItem(`relays/find`)?.slug },
    navSubsection: function() { 
      const navGroup = this.store.layout.getNavGroup(`relays/find`)
      if(this.store.prefs.checkNip11)
        return navGroup
      else
        return navGroup?.filter( slug => slug !== 'nips' ) || [] 
    },
    getRelaysCount: function() { 
      return this.getRelays( this.store.relays.getRelays(this.activeSubsection, this.store.results.all ) ).length
    },
    isMapDark: function(){
      // return this.store.layout.mapIsExpanded && this.$storage.('isDark') == true
    },
    parseHash
  }),

  methods: Object.assign(RelaysLib, localMethods), 

})
</script>