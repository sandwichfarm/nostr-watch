<template>
  <metainfo>
    <template v-slot:title="{ content }">{{ content }}</template>
  </metainfo>

  <RelayControl />

  <LeafletComponent 
    :relaysProp="filteredRelays" />

  <h1 class="text-3xl capitalize mt-6 mb-3 align-left">{{ active }} Relays</h1>

  <div id="wrapper">  
    
    <ListClearnet
      :resultsProp="results"
      :activeNavItemProp="activeNavItem" /> -->

    
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
import RelaysLib from '../shared/relays-lib.js'
//components
import LeafletComponent from '@/components/maps/LeafletComponent.vue'
import RelayControl from '@/components/relays/RelayControl.vue'
import ListClearnet from '@/components/relays/ListClearnet.vue'
//data
import { relays } from '../../relays.yaml'
import { geo } from '../../cache/geo.yaml'

export default defineComponent({
  name: 'HomePage',

  components: {
    // Row,
    // Column,
    LeafletComponent,
    RelayControl,
    // GroupByAvailability,
    ListClearnet
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
      activeNavItem: '',
      sidebar:  this.store.layout.getSidebar
    }
  },

  updated(){},

  async mounted() {
    
    this.store.relays.setRelays(relays)
    this.store.relays.setGeo(geo)

    this.relays = this.store.relays.getAll
    this.lastUpdate = this.store.relays.lastUpdate
    this.preferences = this.store.prefs.get

    this.relays.forEach(relay => {
      this.results[relay] = this.getCache(relay)
    })

    this.activeNavItem = this.store.layout.getActive('relays')

    this.store.layout.$subscribe( (mutation) => {
      if(mutation.events.key == 'relays')
        this.activeNavItem = mutation.events.newValue
    })
    
    this.invalidate()
  },

  computed: {
    
  },

  methods: Object.assign(RelaysLib, {
    loadComponent: function(){

    },
    // relaysGrouped: function(){
      
    //   const relaysGrouped = {
    //     all: this.store.relays.getAll,
    //     public: this.store.relays.getByAggregate('public'),
    //     restricted: this.store.relays.getByAggregate('restricted'),
    //     offline: this.store.relays.getByAggregate('offline')
    //   }

    //   // this.store.relays.setStat('all', relaysGrouped['all'].length)
    //   // this.store.relays.setStat('public', relaysGrouped['public'].length)
    //   // this.store.relays.setStat('restricted', relaysGrouped['restricted'].length)
    //   // this.store.relays.setStat('offline', relaysGrouped['offline'].length)

    //   console.log('active nav item', this.activeNavItem)
    //   this.filteredRelays = relaysGrouped[this.activeNavItem]

    //   return this.filteredRelays
    // }
  }),

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