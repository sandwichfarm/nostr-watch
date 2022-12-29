<template>
  <!-- <NavComponent /> -->
  <LeafletComponent />

  <div id="wrapper">

    <metainfo>
      <template v-slot:title="{ content }">{{ content }}</template>
    </metainfo>
    
    <HeaderComponent />
    
    <Row container :gutter="12">
      <Column :xs="12" :md="12" :lg="12" class="list">
        <span>Group By:</span>
        <tabs :options="{ useUrlFragment: false }" @clicked="tabClicked" @changed="tabChanged" nav-item-class="nav-item">
            <tab name="Availability">
              <GroupByAvailability />
            </tab>
            <tab name="None">
              <GroupByNone />
            </tab>
        </tabs>
      </Column>
    </Row>
    
    <div id="footer">
      <RefreshComponent />

      <span class="credit">
        <!-- <a href="http://sandwich.farm">Another 🥪 by sandwich.farm</a>,  -->
        built with <a href="https://github.com/jb55/nostr-js">nostr-js</a> and <a href="https://github.com/dskvr/nostr-relay-inspector">nostr-relay-inspector</a>, inspired by <a href="https://github.com/fiatjaf/nostr-relay-registry">nostr-relay-registry</a></span>
      </div>
  </div>
</template>
<script>


import { defineComponent } from 'vue'

import { Row, Column } from 'vue-grid-responsive';

import RelaysLib from '../shared/relays-lib.js'

import HeaderComponent from '../components/HeaderComponent.vue'
import LeafletComponent from '../components/LeafletComponent.vue'
import RefreshComponent from '../components/RefreshComponent.vue'


import { relays } from '../../relays.yaml'
import { geo } from '../../cache/geo.yaml'

import { setupStore } from '@/store'

import GroupByNone from '../components/GroupByNone.vue'
import GroupByAvailability from '../components/GroupByAvailability.vue'

import { useMeta } from 'vue-meta'

export default defineComponent({
  name: 'HomePage',

  components: {
    Row,
    Column,
    LeafletComponent,
    RefreshComponent,
    GroupByAvailability,
    GroupByNone,
    HeaderComponent
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
      messages: {},
      connections: {},
      alerts: {},
      timeouts: {},
      intervals: {},
      count: 0,
      storage: null,
      geo,
    }
  },

  updated(){},

  async mounted() {
    this.store.relays.setRelays(relays)
    this.store.relays.setGeo(geo)

    this.relays = this.store.relays.getAll

    this.lastUpdate = this.store.relays.lastUpdate
    this.preferences = this.store.prefs.get

    this.invalidate()
  },

  computed: {},

  methods: RelaysLib

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