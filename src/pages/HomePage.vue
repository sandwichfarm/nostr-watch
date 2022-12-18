<template>
  <!-- <NavComponent /> -->
  <LeafletComponent
    :geo="geo"
    :result="result"
  />

  <div id="wrapper" :class="loadingComplete()">
    
    <row container :gutter="12">
      <column :xs="12" :md="12" :lg="12" class="title-card">
        <h1>nostr.watch<sup>{{version}}</sup></h1>
      </column>
    </row>
    
    <row container :gutter="12">
      <column :xs="12" :md="12" :lg="12" class="title-card">
        <NavComponent />
      </column>
    </row>

    <row container :gutter="12">
      <column :xs="12" :md="12" :lg="12" class="list">
        <table>
          <RelayListComponent
            :relays="relays"
            :result="result"
            :geo="geo"
            :messages="messages"
            :alerts="alerts"
            :connections="connections"
          />
        </table>
      </column>
    </row>

    <row container :gutter="12" v-if="(relaysTotal()-relaysConnected()>0)">
      <column :xs="12" :md="12" :lg="12" class="processing-card loading">
        <span>Processing {{ relaysConnected() }}/{{ relaysTotal() }}</span>
      </column>
    </row>
    

    <section id="footer">
      <RefreshComponent 
        :relaysProp="relays"
        v-bind:resultProp="result"
        :messagesProp="messages"
      />

      <span class="credit"><a href="http://sandwich.farm">Another 🥪 by sandwich.farm</a>, built with <a href="https://github.com/jb55/nostr-js">nostr-js</a> and <a href="https://github.com/dskvr/nostr-relay-inspector">nostr-relay-inspector</a>, inspired by <a href="https://github.com/fiatjaf/nostr-relay-registry">nostr-relay-registry</a></span>
    </section>
  </div>
</template>
<script>


import { defineComponent } from 'vue'
import { useStorage } from "vue3-storage";

import { Row, Column } from 'vue-grid-responsive';
// import { Inspector, InspectorObservation } from '../../lib/nostr-relay-inspector' 

import sharedMethods from '../shared'

import RelayListComponent from '../components/RelayListComponent.vue'
// import RelayGroupedListComponent from '../components/RelayGroupedListComponent.vue'
import LeafletComponent from '../components/LeafletComponent.vue'
import NavComponent from '../components/NavComponent.vue'
import RefreshComponent from '../components/RefreshComponent.vue'

import { version } from '../../package.json'
import { relays } from '../../relays.yaml'
import { geo } from '../../geo.yaml'

export default defineComponent({
  title: "nostr.watch registry & network status",
  name: 'HomePage',

  components: {
    Row,
    Column,
    RelayListComponent,
    // RelayGroupedListComponent,
    LeafletComponent,
    NavComponent,
    RefreshComponent,
  },

  data() {
    return {
      relays: relays,
      result: {},
      messages: {},
      connections: {},
      alerts: {},
      timeouts: {},
      intervals: {},
      count: 0,
      storage: null,
      geo,
      version: version,
      hasStorage: false,
      // cacheExpiration: 10*60*1000, //10 minutes
    }
  },

  updated(){},

  async mounted() {
    this.storage = useStorage()
    this.lastUpdate = this.getState('lastUpdate')|| this.lastUpdate
    this.preferences = this.getState('preferences') || this.preferences

    this.relays.forEach(async relay => {
      this.result[relay] = this.getState(relay)
      this.messages[relay] = this.getState(`${relay}_inbox`)
    })

    this.invalidate()
  },

  computed: {
    
  },

  methods: sharedMethods

})
</script>

<style scoped>
.list {
  position:relative;
  z-index:1;
}
table {
  border-collapse: collapse !important;
}
</style>