<template>
  <MapSummary 
    :resultsProp="results" 
    :activePageItemProp="activeSubsection" /> 

  <div id="wrapper" class="mx-auto max-w-7xl">  
    <div class="pt-5 px-1 sm:px-6 lg:px-8">
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
          <button 
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
    
    <div 
        v-for="subsection in navSubsection"
        :key="subsection.slug" > 
        <div v-if="subsection.slug == activeSubsection">
        <RelaysResultTable
            :resultsProp="results"
            :subsectionProp="subsection.slug"
            v-bind:relaysCountProp="relaysCount" /> 
        </div>
    </div>
  </div>
</template>

<script>
//vue
import { defineComponent, toRefs } from 'vue'
import {useRoute} from 'vue-router'
//pinia
import { setupStore } from '@/store'
//shared methods
import RelaysLib from '@/shared/relays-lib.js'
import { parseHash } from '@/shared/hash-router.js'
//components
import RelaysFindNav from '@/components/relays/nav/RelaysFindNav.vue'
import RelaysResultTable from '@/components/relays/blocks/RelaysResultTable.vue'
import MapSummary from '@/components/relays/blocks/MapSummary.vue'

const localMethods = {}

export default defineComponent({
  name: 'HomePage',

  components: {
    RelaysResultTable,
    RelaysFindNav,
    MapSummary
  },

  setup(props){
    const {resultsProp: results} = toRefs(props)
    return { 
      store : setupStore(),
      results: results
    }
  },

  props: {
    resultsProp: {
      type: Object,
      default: () => {}
    }
  },

  data() {
    return {
      relays: [],
      timeouts: {},
      intervals: {},
      relaysCount: {},
      // activeSection: this.routeSection || this.store.layout.getActiveItem('relays')?.slug,
      // activeSubsection: this.routeSubsection || this.store.layout.getActiveItem(`relays/${this.activeSection}`)?.slug,
    }
  },

  updated(){},

  beforeMount(){
    this.routeSection = this.parseHash.section || false
    this.routeSubsection = this.parseHash.subsection || false

    if(this.path !== 'relays/find')
      this.$router.push('/relays/find')
  },

  async mounted() {
    this.navSubsection.forEach( item => this.relaysCount[item.slug] = 0 ) //move this
    // this.relaysMountNav()
  },

  computed: {
    path: function() { return useRoute().path },
    activeSection: function(){ return this.store.layout.getActiveItem('relays')?.slug },
    activeSubsection: function(){ return this.store.layout.getActiveItem(`relays/${this.activeSection}`)?.slug },
    navSubsection: function() { return this.store.layout.getNavGroup(`relays/${this.activeSection}`) || [] },
    getRelaysCount: function() { 
      return (subsection) => {
        if(subsection === 'all')
          return this.store.relays.getAll.length 
        if(subsection === 'favorite')
          return this.store.relays.getFavorites.length 
        return this.store.relays.getAll.filter( (relay) => this.results?.[relay]?.aggregate == subsection).length 

      }
    },
    parseHash
  },

  methods: Object.assign(RelaysLib, localMethods), 

})
</script>