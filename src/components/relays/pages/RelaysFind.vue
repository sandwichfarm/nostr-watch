<template>
  <RelaysNav
    v-bind:relaysProp="relays"
    v-bind:resultsProp="results" />

  <MapSummary 
    v-if="store.prefs.showMaps"
    :resultsProp="results" 
    :activeSubsectionProp="activeSubsection" /> 

  <!-- {{  store.relays.getOnline }} -->
  <!-- <div v-if="showBasicData" id="wrapper" class="mx-auto max-w-7xl mt-2">
    <div class="bg-black/5 dark:bg-black/30 text-2xl align-middle h-24">
      welcome to nostr.watch. loading
      <div class="block text-7xl">
      <TasksManager
        v-if="showBasicData"
        v-bind:resultsProp="results" />
      </div>
    </div>
    
  </div> -->

  <div id="wrapper" class="mx-auto max-w-7xl mt-2 mb-8 pb-8">  
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
        <RelaysFindNav 
          v-bind:relaysProp="relays"
          :resultsProp="results" />
      </div>
      <FiltersPartial
        v-if="store.tasks.lastUpdate['relays/stats']"
        :resultsProp="results"
        v-bind:relaysProp="relays" />
    </div>
    <div id="relays_list_wrapper" v-if="!this.store.layout.mapIsExpanded">
      <RelaysResultTable
        :relaysProp="relays"
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
// const TasksManager = defineAsyncComponent(() =>
//     import("@/components/relays/tasks/TasksManager.vue" /* webpackChunkName: "TasksManager" */)
// );
const FiltersPartial = defineAsyncComponent(() =>
    import("@/components/partials/FiltersPartial.vue" /* webpackChunkName: "FiltersPartial" */)
);

const NostrSync = defineAsyncComponent(() =>
    import("@/components/relays/partials/NostrSync.vue" /* webpackChunkName: "NostrSync" */)
);

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
  name: 'HomePage',

  components: {
    RelaysNav,
    RelaysFindNav,
    MapSummary,
    RelaysResultTable,
    NostrSync,
    FiltersPartial,
    // TasksManager
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

    this.lastUpdate = this.store.tasks.getLastUpdate('relays')
    this.preferences = this.store.prefs.get
  },

  async mounted() {
    this.relays = relays
    //console.log('map expanded', this.store.layout.mapIsExpanded, 'is dark', localStorage.getItem('isDark'))
    this.navSubsection.forEach( item => this.relaysCount[item.slug] = 0 ) //move this
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
      return this.getRelays(this.store.relays.getRelays(this.activeSubsection, this.results ) ).length
      // return (subsection) => {
      //   if(subsection === 'all')
      //     return this.store.relays.getAll.length
      //   if(subsection === 'nips')
      //   return this.store.relays.getAll.filter( (relay) => this.results?.[relay]?.info?.supported_nips).length
      //   if(subsection === 'online')
      //     return this.store.relays.getAll.filter( (relay) => this.results?.[relay]?.check?.connect).length  
      //   if(subsection === 'favorite')
      //     return this.store.relays.getFavorites.length 
      //   return this.store.relays.getAll.filter( (relay) => this.results?.[relay]?.aggregate == subsection).length 
      // }
    },
    isMapDark: function(){
      // return this.store.layout.mapIsExpanded && this.$storage.('isDark') == true
    },
    parseHash
  }),

  methods: Object.assign(RelaysLib, localMethods), 

})
</script>