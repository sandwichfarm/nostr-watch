<template>
  <metainfo>
    <template v-slot:title="{ content }">{{ content }}</template>
  </metainfo>

  <RelayControl />

  <LeafletComponent 
    v-bind:relaysProp="filteredRelays" />

  <h1 class="text-3xl capitalize mt-6 mb-3 align-left">{{ active }} Relays</h1>

  <div id="wrapper">  
    <ListClearnet
    v-bind:relaysProp="filteredRelays" />
    
    <div id="footer">
      
      <span class="credit">
        <!-- <a href="http://sandwich.farm">Another 🥪 by sandwich.farm</a>,  -->
        built with <a href="https://github.com/jb55/nostr-js">nostr-js</a> and <a href="https://github.com/dskvr/nostr-relay-inspector">nostr-relay-inspector</a>, inspired by <a href="https://github.com/fiatjaf/nostr-relay-registry">nostr-relay-registry</a></span>
      </div>
  </div>
</template>
<script>


import { defineComponent } from 'vue'

// import { Row, Column } from 'vue-grid-responsive';

import RelaysLib from '../shared/relays-lib.js'

// import HeaderComponent from '../components/HeaderComponent.vue'
import LeafletComponent from '@/components/maps/LeafletComponent.vue'
import RelayControl from '@/components/relays/RelayControl.vue'

import { relays } from '../../relays.yaml'
import { geo } from '../../cache/geo.yaml'

import { setupStore } from '@/store'

import ListClearnet from '@/components/relays/ListClearnet.vue'
// import GroupByAvailability from '../components/GroupByAvailability.vue'

import { useMeta } from 'vue-meta'

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
      result: {},
      filteredRelays: [],
      messages: {},
      connections: {},
      alerts: {},
      timeouts: {},
      intervals: {},
      count: 0,
      storage: null,
      geo,
      active: ''
    }
  },

  updated(){},

  async mounted() {
    this.store.relays.setRelays(relays)
    this.store.relays.setGeo(geo)

    this.relays = this.store.relays.getAll

    this.lastUpdate = this.store.relays.lastUpdate
    this.preferences = this.store.prefs.get

    this.loadPage(this.store.layout.getActive('relays'))

    this.store.layout.$subscribe( (mutation) => {
      if(mutation.events.key == 'relays')
        this.loadPage(mutation.events.newValue)
    })

    this.invalidate()
  },

  computed: {},

  methods: Object.assign(RelaysLib, {
    loadPage: function(section){
      const active = this.active = section
      console.log(`${active} is active`)
      if( 'all' == active )
        this.filteredRelays = this.store.relays.getAll
      if( 'public' == active )
        this.filteredRelays = this.store.relays.getByAggregate('public')
      if( 'restricted' == active )
        this.filteredRelays = this.store.relays.getByAggregate('restricted')
      if( 'offline' == active )
        this.filteredRelays = this.store.relays.getByAggregate('offline')
      // if( 'onion' == active )
        // this.filteredRelays = this.store.relays.getOnion
      console.log('meow', this.active, this.filteredRelays.length)
      this.store.relays.setStat(this.active, this.filteredRelays.length)
    }
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