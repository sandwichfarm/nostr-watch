<template>
  <!-- <NavComponent /> -->
  <div id="wrapper" :class="loadingComplete()">

    <row container :gutter="12">
      <column :xs="12" :md="12" :lg="12" class="title-card">
        <h1>nostr.watch<sup>alpha</sup></h1>
        <!-- <span>Next ping in {{ nextPing }} seconds</span> -->
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
              :messages="messages"
              :alerts="alerts"
              :connections="connections"
            />

            <RelayListComponent
              section="restricted"
              :relays="relays"
              :result="result"
              :messages="messages"
              :alerts="alerts"
              :connections="connections"
            />

            <RelayListComponent
              section="offline"
              :relays="relays"
              :result="result"
              :messages="messages"
              :alerts="alerts"
              :connections="connections"
            />

          </table>
        </div>
      </column>
    </row>

    <row container :gutter="12">
      <column :xs="12" :md="12" :lg="12" class="processing-card loading">
        <span v-if="(relaysTotal()-relaysConnected()>0)">Processing {{ relaysCompleted() }}/{{ relaysTotal() }}</span>
      </column>
    </row>

    <span class="credit"><a href="http://sandwich.farm">Another 🥪 by sandwich.farm</a>, built with <a href="https://github.com/jb55/nostr-js">nostr-js</a> and <a href="https://github.com/dskvr/nostr-relay-inspector">nostr-relay-inspector</a>, inspired by <a href="https://github.com/fiatjaf/nostr-relay-registry">nostr-relay-registry</a></span>

  </div>
</template>

<script>
import { defineComponent} from 'vue'
import RelayListComponent from './RelayListComponent.vue'
// import NavComponent from './NavComponent.vue'

import { Row, Column } from 'vue-grid-responsive';

import { relays } from '../../relays.yaml'
import { messages as RELAY_MESSAGES, codes as RELAY_CODES } from '../../codes.yaml'

import { Inspector, InspectorObservation } from 'nostr-relay-inspector'
// import { Inspector, InspectorObservation } from '../../lib/nostr-relay-inspector'

import crypto from "crypto"

export default defineComponent({
  title: "nostr.watch registry & netw ork status",
  name: 'RelayTableComponent',
  components: {
    Row,
    Column,
    RelayListComponent,
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
    }
  },

  async mounted() {
    console.log('mounted')
    this.relays.forEach(async relay => {
      this.check(relay)
    })

  },

  computed: {},

  methods: {

    check(relay){

      const opts = {
          checkLatency: true,
          run: true,
          setIP: false,
          setGeo: false,
        }

      let inspect = new Inspector(relay, opts)
        .on('open', (e, result) => {
          this.result[relay] = result
        })
        .on('complete', (instance) => {
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

    setAggregateResult (url) {
      let aggregateTally = 0
      aggregateTally += this.result?.[url]?.check.connect ? 1 : 0
      aggregateTally += this.result?.[url]?.check.read ? 1 : 0
      aggregateTally += this.result?.[url]?.check.write ? 1 : 0
      if (aggregateTally == 3) {
        this.result[url].aggregate = 'public'
      }
      else if (aggregateTally == 0) {
        this.result[url].aggregate = 'offline'
      }
      else {
        this.result[url].aggregate = 'restricted'
      }
    },

    async copy(text) {
      try {
        await navigator.clipboard.writeText(text);
      } catch($e) {
        //console.log('Cannot copy');
      }
    },

    relaysTotal () {
      return this.relays.length
    },

    relaysConnected () {
      return Object.keys(this.result).length
    },

    relaysCompleted () {
      let value = Object.entries(this.result).length
      return value
    },

    sha1 (message) {
      const hash = crypto.createHash('sha1').update(JSON.stringify(message)).digest('hex')
      // //console.log(message, ':', hash)
      return hash
    },

    loadingComplete(){
      return this.relaysTotal()-this.relaysCompleted() == 0 ? 'loaded' : ''
    }
  },

})
</script>
