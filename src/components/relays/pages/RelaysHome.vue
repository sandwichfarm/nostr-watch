<template>
  <RelaysNav 
    v-bind:resultsProp="results" />

  <RelaysFind
    :resultsProp="results"
    v-if="this.path.startsWith('/relays/find') || this.path == '/relays' || this.path == '/'" /> 
  
  <MapInteractive
    :resultsProp="results"
    v-if="this.path.startsWith('/relays/map')" /> 
  
  <RelayStatistics
    :resultsProp="results"
    v-if="this.path.startsWith('/relays/statistics') /> 
  
  <div id="footer">
    <span class="credit">
      <!-- <a href="http://sandwich.farm">Another 🥪 by sandwich.farm</a>,  -->
      built with <a href="https://github.com/jb55/nostr-js">nostr-js</a> and <a href="https://github.com/dskvr/nostr-relay-inspector">nostr-relay-inspector</a>, inspired by <a href="https://github.com/fiatjaf/nostr-relay-registry">nostr-relay-registry</a></span>
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
import RelaysNav from '@/components/relays/nav/RelaysNav.vue'

import RelaysFind from '@/components/relays/pages/RelaysFind.vue'
import RelayStatistics from '@/components/relays/pages/RelaysStatistics.vue'
import MapInteractive from '@/components/relays/pages/RelaysMap.vue'
//data
import { relays } from '../../../../relays.yaml'
import { geo } from '../../../../cache/geo.yaml'

const localMethods = {
  relaysLoadData(){
    this.store.relays.setRelays(relays)
    this.store.relays.setGeo(geo)

    this.relays = this.store.relays.getAll
    this.lastUpdate = this.store.tasks.getLastUpdate('relays')
    this.preferences = this.store.prefs.get

    // this.relays.forEach(relay => {
    //   this.results[relay] = this.getCache(relay)
    // })
  },
}

export default defineComponent({
  name: 'HomePage',

  components: {
    RelaysNav,
    RelaysFind,
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
    }
  },

  beforeMount(){
    this.routeSubsection = this.parseHash.subsection || false
    this.relaysLoadData()
  },

  async mounted() {
    this.navSubsection.forEach( item => this.relaysCount[item.slug] = 0 ) //move this
    // this.relaysMountNav()
  },

  updated(){},

  unmounted(){
    //console.log('findrelays', 'unmounted()')
    delete this.results
  },



  computed: {
    // activeSection: function(){ return this.store.layout.getActiveItem('relays')?.slug },
    activeSubsection: function(){ return this.navSubsection?.slug },
    navSubsection: function() { return this.store.layout.getNavGroup(`relays/${this.activeSection}`) || [] },
    parseHash
  },

  methods: Object.assign(RelaysLib, localMethods), 

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