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
    <div>
     <table>
            <RelayGroupedListComponent
              section="public"
              :relays="relays"
              :result="result"
              :geo="geo"
              :messages="messages"
              :alerts="alerts"
              :connections="connections"
            />

            <RelayGroupedListComponent
              section="restricted"
              :relays="relays"
              :result="result"
              :geo="geo"
              :messages="messages"
              :alerts="alerts"
              :connections="connections"
            />

            <RelayGroupedListComponent
              section="offline"
              :relays="relays"
              :result="result"
              :geo="geo"
              :messages="messages"
              :alerts="alerts"
              :connections="connections"
            />

            <RelayGroupedListComponent
              section="processing"
              :relays="relays"
              :result="result"
              :messages="messages"
              :alerts="alerts"
              :connections="connections"
              :showJson="false"
            />

        </table>
      </div>


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


import { defineComponent} from 'vue'
import { useStorage } from "vue3-storage";
// import { CallbackResult } from "vue3-storage/dist/lib/types";

import crypto from "crypto"
import { Row, Column } from 'vue-grid-responsive';
import { Inspector, InspectorObservation, InspectorResult } from 'nostr-relay-inspector'

// import RelayListComponent from '../components/RelayListComponent.vue'
import RelayGroupedListComponent from '../components/RelayGroupedListComponent.vue'
import LeafletComponent from '../components/LeafletComponent.vue'
import NavComponent from '../components/NavComponent.vue'
import RefreshComponent from '../components/RefreshComponent.vue'

import { version as nwVersion } from '../../package.json'
import { relays } from '../../relays.yaml'
import { geo } from '../../geo.yaml'
import { messages as RELAY_MESSAGES, codes as RELAY_CODES } from '../../codes.yaml'

export default defineComponent({
  title: "nostr.watch registry & network status",
  name: 'ByStatus',
  components: {
    Row,
    Column,
    // RelayListComponent,
    RelayGroupedListComponent,
    LeafletComponent,
    NavComponent,
    RefreshComponent
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
      intervals: {},
      lastPing: Date.now(),
      nextPing: Date.now() + (30*60*1000),
      count: 0,
      storage: null,
      geo,
      version: nwVersion,
      hasStorage: false,
      lastUpdate: null,
      cacheExpiration: (30*60*1000),
    }
  },

  updated() {
     Object.keys(this.timeouts).forEach(timeout => clearTimeout(this.timeouts[timeout]))
     Object.keys(this.intervals).forEach(interval => clearInterval(this.intervals[interval]))
  },

  async mounted() {
    this.relays.forEach(relay => {
      this.result[relay] = structuredClone(InspectorResult)
    })

    this.storage = useStorage()
    this.storage.setStorageSync('relays', relays)
    this.lastUpdate = this.storage.getStorageSync('lastUpdate')

    this.relays.forEach(async relay => {
      this.result[relay] = this.storage.getStorageSync(relay)
    })

    if(Object.keys(this.result).length)
      this.hasStorage = true

    if(this.isExpired())
      this.relays.forEach(async relay => await this.check(relay) )

    return true
  },

  computed: {},

  methods: {

    isExpired(){
      return typeof this.lastUpdate === 'undefined' || Date.now() - this.lastUpdate > this.cacheExpiration
    },

    saveState(relay){
      this.storage
        .setStorage({
          key: relay,
          data: this.result[relay]
        })
        .then(successCallback => {
          console.log(successCallback.errMsg);
        })
        .catch(failCallback => {  
          console.log(failCallback.errMsg);
        })

      this.storage
        .setStorage({
          key: "lastUpdate",
          data: Date.now()
        })
        .then(successCallback => {
          console.log(successCallback.errMsg);
          this.lastUpdate = Date.now()
        })
        .catch(failCallback => {
          console.log(failCallback.errMsg);
        })
    },

    resetState(){
      this.relays.forEach(relay=>{
        this.storage.removeStorage(relay)
      })
    },

    async check(relay){
      return new Promise( (resolve, reject) => {
        const opts = {
            checkLatency: true,
            setIP: false,
            setGeo: false,
            debug: true,
          }

        let inspect = new Inspector(relay, opts)
          .on('run', (result) => {
            result
            // result.aggregate = 'processing'
          })
          .on('open', (e, result) => {
            this.result[relay] = result
          })
          .on('complete', (instance) => {
            this.result[relay] = Object.assign(this.result[relay], instance.result)
            this.messages[relay] = instance.inbox
            // this.setFlag(relay)
            this.setAggregateResult(relay)
            // this.adjustResult(relay)
            this.saveState(relay)
            resolve(this.result[relay])

          })
          .on('notice', (notice) => {
            const hash = this.sha1(notice)
            let   message_obj = RELAY_MESSAGES[hash]
            let   code_obj = RELAY_CODES[message_obj.code]

            let response_obj = {...message_obj, ...code_obj}

            this.result[relay].observations.push( new InspectorObservation('notice', response_obj.code, response_obj.description, response_obj.relates_to) )
          })
          .on('close', () => {})
          .on('error', () => {
            reject(this.result[relay])
          })
          .run()

        this.connections[relay] = inspect
      })
    },

    recheck(relay){
      const inspect = this.connections[relay]
      inspect.checkLatency()

    },

    // adjustResult (relay) {
    //   this.result[relay].observations.forEach( observation => {
    //     if (observation.code == "BLOCKS_WRITE_STATUS_CHECK") {
    //       this.result[relay].check.write = false
    //       this.result[relay].aggregate = 'public'
    //     }
    //   })
    // },

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
      return this.relays.length //TODO: Figure out WHY?
    },

    relaysConnected () {
      return Object.entries(this.result).filter(result => result.state == 'complete').length
    },

    sha1 (message) {
      const hash = crypto.createHash('sha1').update(JSON.stringify(message)).digest('hex')
      return hash
    },

    isDone(){
      return this.relaysTotal()-this.relaysConnected() <= 0
    },

    loadingComplete(){
      return this.isDone() ? 'loaded' : ''
    },
  },

})
</script>
<style scoped>
table {
  border-collapse: collapse !important;
}
</style>