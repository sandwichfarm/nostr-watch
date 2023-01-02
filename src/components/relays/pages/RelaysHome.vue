<template>
  <metainfo>
    <template v-slot:title="{ content }">{{ content }}</template>
  </metainfo>

  <SubnavComponent 
    v-bind:resultsProp="results" />

  <MapSummary 
    :resultsProp="results" 
    :activePageItemProp="activePageItem" /> 

  <!-- <h1 class="text-3xl capitalize mt-6 mb-3 align-left">{{ activeNavItem }} Relays</h1> -->

  <div id="wrapper" class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">  
    <ListClearnet
      :resultsProp="results"
      :activePageItemProp="activePageItem" /> 
    
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
import { useMeta } from 'vue-meta'
import { setupStore } from '@/store'
//shared methods
import RelaysLib from '@/shared/relays-lib.js'
//components
import MapSummary from '@/components/relays/MapSummary.vue'
import ListClearnet from '@/components/relays/ListClearnet.vue'
import SubnavComponent from '@/components/relays/SubnavComponent.vue'
//data
import { relays } from '../../../../relays.yaml'
import { geo } from '../../../../cache/geo.yaml'

export default defineComponent({
  name: 'HomePage',

  components: {
    // Row,
    // Column,
    MapSummary,
    // GroupByAvailability,
    ListClearnet,
    SubnavComponent
    // HeaderComponent
  },

  setup(){
    useMeta({
      title: 'nostr.watch',
      description: 'A robust client-side nostr relay monitor. Find fast nostr relays, view them on a map and monitor the network status of nostr.',
      htmlAttrs: { lang: 'en', amp: true }
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
      activeNavItem: this.store.layout.getActive('relays-subnav'),
      activePageItem: this.store.layout.getActive('relays-find-pagenav'),
      sidebar:  this.store.layout.getSidebar
    }
  },

  updated(){},

  async mounted() {

    this.$pool
      .on('open', function(relay){
        console.log('global pool connected!', relay.url)
      })
      .on('error', function(relay){
        console.log('global pool error!', relay.url)
      })

    console.log('params', )

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
      if(mutation.events.key == 'relays-find-pagenav')
        this.activePageItem = mutation.events.newValue
    })
    
    // this.psuedoRouter(this.store.layout.getNavGroup('relays-subnav'))
    this.psuedoRouter()
    
    this.invalidate()
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