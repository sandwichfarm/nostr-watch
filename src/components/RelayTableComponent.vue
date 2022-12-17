<template>
  <!-- <NavComponent /> -->
  <div id="wrapper" :class="loadingComplete()">

    <row container :gutter="12">
      <column :xs="12" :md="12" :lg="12" class="title-card">
        <h1>nostr.watch<sup>{{version}}</sup></h1>
      </column>
    </row>

    <row container :gutter="12">
      <column :xs="12" :md="12" :lg="12">
        <LeafletComponent
          :geo="geo"
          :result="result"
        />
      </column>
    </row>

    <row container :gutter="12">
      <column :xs="12" :md="12" :lg="12">
        <div class="block">
          <table>

            <RelayListComponent
              section="public"
              :relays="relays"
              :result="result"
              :geo="geo"
              :messages="messages"
              :alerts="alerts"
              :connections="connections"
            />

            <RelayListComponent
              section="restricted"
              :relays="relays"
              :result="result"
              :geo="geo"
              :messages="messages"
              :alerts="alerts"
              :connections="connections"
            />

            <RelayListComponent
              section="offline"
              :relays="relays"
              :result="result"
              :geo="geo"
              :messages="messages"
              :alerts="alerts"
              :connections="connections"
            />

            <!-- <RelayListComponent
              section="processing"
              :relays="relays"
              :result="result"
              :messages="messages"
              :alerts="alerts"
              :connections="connections"
              :showJson="false"
            /> -->

          </table>
        </div>
      </column>
    </row>

    <row container :gutter="12">
      <column :xs="12" :md="12" :lg="12" class="processing-card loading">
        <span v-if="(relaysTotal()-relaysConnected()>0)">Processing {{ relaysConnected() }}/{{ relaysTotal() }}</span>
      </column>
    </row>

    <span class="credit"><a href="http://sandwich.farm">Another 🥪 by sandwich.farm</a>, built with <a href="https://github.com/jb55/nostr-js">nostr-js</a> and <a href="https://github.com/dskvr/nostr-relay-inspector">nostr-relay-inspector</a>, inspired by <a href="https://github.com/fiatjaf/nostr-relay-registry">nostr-relay-registry</a></span>

  </div>
</template>

<script>
import { defineComponent} from 'vue'
import RelayListComponent from './RelayListComponent.vue'
import LeafletComponent from './LeafletComponent.vue'
// import NavComponent from './NavComponent.vue'

import { Row, Column } from 'vue-grid-responsive';

import { version } from '../../package.json'

import { relays } from '../../relays.yaml'
import { geo } from '../../geo.yaml'
import { messages as RELAY_MESSAGES, codes as RELAY_CODES } from '../../codes.yaml'

import { Inspector, InspectorObservation } from 'nostr-relay-inspector'
// import { Inspector, InspectorObservation } from '../../lib/nostr-relay-inspector'

import crypto from "crypto"

export default defineComponent({
  title: "nostr.watch registry & network status",
  name: 'RelayTableComponent',
  components: {
    Row,
    Column,
    RelayListComponent,
    LeafletComponent
    // NavComponent
  },

  data() {
    return {
      relays,
      result: {},
      messages: {},
      connections: {},
      nips: {},
      alerts: {},
      timeouts: {},
      lastPing: Date.now(),
      nextPing: Date.now() + (60*1000),
      count: 0,
      geo,
      version: version
    }
  },

  async mounted() {
    console.log('mounted')
    this.relays.forEach(relay => {
      this.check(relay)
    })

  },

  computed: {},

  methods: {

    check(relay){

      const opts = {
          checkLatency: true,
          setIP: false,
          setGeo: false,
        }

      let inspect = new Inspector(relay, opts)
        .on('run', (result) => {
          result.aggregate = 'processing'
        })
        .on('open', (e, result) => {
          this.result[relay] = result
        })
        .on('complete', (instance) => {
          console.log('on_complete', instance.result.aggregate)
          this.result[relay] = instance.result
          this.messages[relay] = instance.inbox
          // this.setFlag(relay)
          this.setAggregateResult(relay)
          this.adjustResult(relay)
        })
        .on('notice', (notice) => {
          const hash = this.sha1(notice)
          let   message_obj = RELAY_MESSAGES[hash]
          let   code_obj = RELAY_CODES[message_obj.code]

          let response_obj = {...message_obj, ...code_obj}

          this.result[relay].observations.push( new InspectorObservation('notice', response_obj.code, response_obj.description, response_obj.relates_to) )

          console.log(this.result[relay].observations)
        })
        .on('close', () => {})
        .on('error', () => {

        })
        .run()

      this.connections[relay] = inspect
    },

    adjustResult (relay) {
      this.result[relay].observations.forEach( observation => {
        if (observation.code == "BLOCKS_WRITE_STATUS_CHECK") {
          this.result[relay].check.write = false
          this.result[relay].aggregate = 'public'
        }
      })
    },

    setAggregateResult (relay) {
      let aggregateTally = 0
      aggregateTally += this.result?.[relay]?.check.connect ? 1 : 0
      aggregateTally += this.result?.[relay]?.check.read ? 1 : 0
      aggregateTally += this.result?.[relay]?.check.write ? 1 : 0
      if (aggregateTally == 3) {
        this.result[relay].aggregate = 'public'
      }
      else if (aggregateTally == 0) {
        this.result[relay].aggregate = 'offline'
      }
      else {
        this.result[relay].aggregate = 'restricted'
      }
    },

    relaysTotal () {
      return this.relays.length-1 //TODO: Figure out WHY?
    },

    relaysConnected () {
      return Object.entries(this.result).length
    },

    relaysComplete () {
      if(!Object.keys(this.results).length) return 0
      return this.relays.filter(relay => this.results?.[relay]?.state == 'complete').length
    },

    sha1 (message) {
      const hash = crypto.createHash('sha1').update(JSON.stringify(message)).digest('hex')
      // //console.log(message, ':', hash)
      return hash
    },

    isDone(){
      return this.relaysTotal()-this.relaysComplete() == 0
    },

    loadingComplete(){
      return this.isDone() ? 'loaded' : ''
    },
  },

})
</script>
