<template>
  <!-- <NavComponent /> -->
  <LeafletComponent
    :geo="geo"
    :result="result"
  />

  <div id="wrapper">
    
    <row container :gutter="12">
      <column :xs="12" :md="12" :lg="12" class="title-card">
        <h1>nostr.watch<sup>{{version}}</sup></h1>
      </column>
    </row>
    
    <row container :gutter="12">
      <column :xs="12" :md="12" :lg="12" class="title-card">
        <NavComponent :relays="relays" />
      </column>
    </row>

    <row container :gutter="12">
      <column :xs="12" :md="12" :lg="12" class="list">
        <span>Group By:</span>
        <tabs :options="{ useUrlFragment: false }" @clicked="tabClicked" @changed="tabChanged" nav-item-class="nav-item">
            <tab name="None">
              <GroupByNone
                :relays="relays"
                :result="result"
                :geo="geo"
                :messages="messages"
                :alerts="alerts"
                :connections="connections">
              </GroupByNone>
            </tab>
            <tab name="Availability">
              <GroupByAvailability
                section="processing"
                :relays="relays"
                :result="result"
                :geo="geo"
                :messages="messages"
                :alerts="alerts"
                :connections="connections"
                :showJson="false">
                </GroupByAvailability>
            </tab>
        </tabs>
      </column>
    </row>

    <row container :gutter="12">
      <column :xs="12" :md="12" :lg="12" class="list">
        
      </column>
    </row>

    <!-- <row container :gutter="12" v-if="(relaysTotal()-relaysConnected()>0)">
      <column :xs="12" :md="12" :lg="12" class="processing-card loading">
        <span>Processing {{ relaysConnected() }}/{{ relaysTotal() }}</span>
      </column>
    </row> -->
    
    <section id="footer">
      <RefreshComponent 
        :relaysProp="relays"
        v-bind:resultProp="result"
        :messagesProp="messages"
      />

      <span class="credit">
        <!-- <a href="http://sandwich.farm">Another 🥪 by sandwich.farm</a>,  -->
        built with <a href="https://github.com/jb55/nostr-js">nostr-js</a> and <a href="https://github.com/dskvr/nostr-relay-inspector">nostr-relay-inspector</a>, inspired by <a href="https://github.com/fiatjaf/nostr-relay-registry">nostr-relay-registry</a></span>
    </section>
  </div>
</template>
<script>


import { defineComponent } from 'vue'
import { useStorage } from "vue3-storage";

import { Row, Column } from 'vue-grid-responsive';

import RelaysLib from '../lib/relays-lib.js'

import LeafletComponent from '../components/LeafletComponent.vue'
import NavComponent from '../components/NavComponent.vue'
import RefreshComponent from '../components/RefreshComponent.vue'

import { version } from '../../package.json'
import { relays } from '../../relays.yaml'
import { geo } from '../../cache/geo.yaml'

import GroupByNone from './groups/GroupByNone.vue'
import GroupByAvailability from './groups/GroupByAvailability.vue'

export default defineComponent({
  title: "nostr.watch registry & network status",
  name: 'HomePage',

  components: {
    Row,
    Column,
    LeafletComponent,
    NavComponent,
    RefreshComponent,
    GroupByAvailability,
    GroupByNone,

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
    this.lastUpdate = this.getCache('lastUpdate')|| this.lastUpdate
    this.preferences = this.getCache('preferences') || this.preferences

    this.relays.forEach(async relay => {
      this.result[relay] = this.getCache(relay)
      this.messages[relay] = this.getCache(`${relay}_inbox`)
    })
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
  color: #333;
}

li.nav-item a {
  display:inline-block;
  margin-left:9px;
  padding:3px 6px;
}

</style>