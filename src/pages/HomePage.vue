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
      <column :xs="12" :md="12" :lg="12" class="title-card">
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
    <span>Updated {{ refreshData.sinceLast }} ago</span>
    <span><button @click="invalidate(true)">Update Now</button></span>
    <span><input type="checkbox" id="checkbox" v-model="preferences.refresh" /><label for="">Refresh Automatically</label></span>
    <span v-if="preferences.refresh"> Next refresh in: {{ refreshData.untilNext }}</span>
    <span v-if="preferences.refresh">
      Refresh Every

      <input type="radio" id="1w" :value="1000*60*60*24*7" v-model="cacheExpiration" />
      <label for="1w">1 Week</label>

      <input type="radio" id="1d" :value="1000*60*60*24" v-model="cacheExpiration" />
      <label for="1d">1 day</label>

      <input type="radio" id="30m" :value="1000*60*30" v-model="cacheExpiration" />
      <label for="30m">30 minutes</label>

      <input type="radio" id="10m" :value="1000*60*10" v-model="cacheExpiration" />
      <label for="10m">10 minutes</label>

      <input type="radio" id="1m" :value="1000*60" v-model="cacheExpiration" />
      <label for="1m">1 Minute</label>
    </span>
  </section>

 

  <span class="credit"><a href="http://sandwich.farm">Another 🥪 by sandwich.farm</a>, built with <a href="https://github.com/jb55/nostr-js">nostr-js</a> and <a href="https://github.com/dskvr/nostr-relay-inspector">nostr-relay-inspector</a>, inspired by <a href="https://github.com/fiatjaf/nostr-relay-registry">nostr-relay-registry</a></span>

  </div>
  
  
</template>

<script>


import { defineComponent, reactive} from 'vue'
import { useStorage } from "vue3-storage";
// import { CallbackResult } from "vue3-storage/dist/lib/types";

import crypto from "crypto"
import { Row, Column } from 'vue-grid-responsive';
import { Inspector, InspectorObservation } from 'nostr-relay-inspector'
// import { Inspector, InspectorObservation } from '../../lib/nostr-relay-inspector' 

import RelayListComponent from '../components/RelayListComponent.vue'
// import RelayGroupedListComponent from '../components/RelayGroupedListComponent.vue'
import LeafletComponent from '../components/LeafletComponent.vue'
import NavComponent from '../components/NavComponent.vue'

import { version } from '../../package.json'
import { relays } from '../../relays.yaml'
import { geo } from '../../geo.yaml'
import { messages as RELAY_MESSAGES, codes as RELAY_CODES } from '../../codes.yaml'

import { timeSince } from '../utils'

reactive

export default defineComponent({
  title: "nostr.watch registry & network status",
  name: 'RelayTableComponent',
  components: {
    Row,
    Column,
    RelayListComponent,
    // RelayGroupedListComponent,
    LeafletComponent,
    NavComponent
  },

  data() {
    return {
      relays: relays,
      result: {},
      messages: {},
      connections: {},
      nips: {},
      alerts: {},
      timeouts: {},
      intervals: {},
      lastPing: Date.now(),
      nextPing: Date.now() + (60*1000),
      count: 0,
      storage: null,
      geo,
      version: version,
      hasStorage: false,
      lastUpdate: null,
      refresh: true,
      preferences: {
        refresh: true
      },
      refreshData: {},
      // cacheExpiration: 10*60*1000, //10 minutes
      cacheExpiration: 30*60*1000, //30 minutes
    }
  },



  updated(){
    console.log(`zing - refresh? ${this.preferences.refresh} ${Date.now()} - ${this.lastUpdate} = ${Date.now()-this.lastUpdate} > ${this.cacheExpiration}`)

    this.saveState('preferences')

    Object.keys(this.timeouts).forEach(timeout => clearTimeout(this.timeouts[timeout]))
    Object.keys(this.intervals).forEach(interval => clearInterval(this.intervals[interval]))

    if(this.isDone()) {
      this.saveState('lastUpdate')
      console.log('isDone()', this.getState('lastUpdate') )
    }

    this.refreshData.untilNext = this.timeUntilRefresh() 
    this.refreshData.sinceLast = this.timeSinceRefresh() 

    // if(this.preferences.refresh) 
    //   this.timeouts.invalidate = setTimeout(()=> this.invalidate(), 1000)
  },

  

  async mounted() {

    this.storage = useStorage()
    this.lastUpdate = this.getState('lastUpdate')|| this.lastUpdate
    this.preferences = this.getState('preferences') || this.preferences

    this.relays.forEach(async relay => {
      this.result[relay] = this.getState(relay)
      this.messages[relay] = this.getState(`${relay}_inbox`)
    })

    this.invalidate()

    console.log('last update',-1*(Date.now()-(this.lastUpdate+this.cacheExpiration)))

    this.refreshData = reactive({
      untilNext: this.timeUntilRefresh(),
      sinceLast: this.timeSinceRefresh()
    })

    setInterval(() => {

      this.refreshData.untilNext = this.timeUntilRefresh() 
      this.refreshData.sinceLast = this.timeSinceRefresh() 

      console.log('timesince22222', this.refreshData.untilNext, this.refreshData.sinceLast)

      if(this.isExpired())
        this.invalidate()

    }, 1000)
  },

  computed: {
    
  },

  methods: {

    timeUntilRefresh(){
      return timeSince(Date.now()-(this.lastUpdate+this.cacheExpiration-Date.now())) 
    },
    timeSinceRefresh(){
      return timeSince(this.lastUpdate)
    },

    invalidate(force){
      if(!this.isExpired() && !force) 
        return

      this.relays.forEach(async relay => { 
        await this.check(relay) 
        this.relays[relay] = this.getState(relay)
        this.messages[relay] = this.getState(`${relay}_inbox`) 
      })

      // if(this.preferences.refresh) 
      //   this.timeouts.invalidate = setTimeout(()=> this.invalidate(), 1000)

    },

    nextRefresh(){
      return timeSince(Date.now()-(this.lastUpdate+this.cacheExpiration-Date.now()))
    },

    isExpired(){
      return typeof this.lastUpdate === 'undefined' || Date.now() - this.lastUpdate > this.cacheExpiration
    },

    getState(key){
      return this.storage.getStorageSync(key)
    },

    saveState(type, key, data){
      
      const now = Date.now()

      let store, success, error, instance

      switch(type){
        case 'relay':
          console.log('savestate', 'relay', data || this.result[data])
          if(data)
            data.aggregate = this.getAggregate(key)
          store = {
            key: key,
            data: data || this.result[key],
            // expire: Date.now()+1000*60*60*24*180,
          }
          success = () => {
            if(data)
              this.result[key] = data
          }
          break;
        case 'messages':
          console.log('savestate', 'messages', this.messages[data])
          store = {
            key: `${key}_inbox`,
            data: data || this.messages[key],
            // expire: Date.now()+1000*60*60*24*180,
          }
          success = () => {
            if(data)
              this.messages[key] = data
          }
          break;
        case 'lastUpdate':
          console.log('savestate', 'lastUpdate', now)
          store = {
            key: "lastUpdate",
            data: now
          }
          success = () => {
            // console.log('lastupdate success', successCallback.msg)
            this.lastUpdate = now
          }
          break;
        case 'preferences':
          console.log('savestate', 'preferences', this.preferences)
          store = {
            key: "preferences",
            data: this.preferences
          }
          break;
      }

      if(store)
        instance = this.storage.setStorage(store)

      if(success && store)
        instance.then(success)

      if(error && store)
        instance.catch(error)
    },

    resetState(){
      this.relays.forEach(relay=>{
        this.storage.removeStorage(relay)
      })
    },

    async check(relay){
      return new Promise( (resolve, reject) => {
        // if(!this.isExpired())
        //   return reject(relay)

        const opts = {
            checkLatency: true,
            setIP: false,
            setGeo: false,
            getInfo: true,
            debug: true,
            // data: { result: this.result[relay] }
          }

        let inspect = new Inspector(relay, opts)
          // .on('run', (result) => {
          //   result.aggregate = 'processing'
          // })
          // .on('open', (e, result) => {
          //   this.result[relay] = result
          // })
          .on('complete', (instance) => {
            // console.log('getinfo()', instance.result.info)
            
            this.result[relay] = instance.result
            
            // this.setFlag(relay)
            // this.adjustResult(relay)

            this.result[relay].aggregate = this.getAggregate(relay)

            this.saveState('relay', relay)
            this.saveState('messages', relay,  instance.inbox)
            this.saveState('lastUpdate')
            
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

    adjustResult (relay) {
      this.result[relay].observations.forEach( observation => {
        if (observation.code == "BLOCKS_WRITE_STATUS_CHECK") {
          this.result[relay].check.write = false
          this.result[relay].aggregate = 'public'
        }
      })
    },

    getAggregate (relay) {
      console.log('getAggregate()', this.result?.[relay]?.check.connect, this.result?.[relay]?.check.read, this.result?.[relay]?.check.write)
      let aggregateTally = 0
      aggregateTally += this.result?.[relay]?.check.connect ? 1 : 0
      aggregateTally += this.result?.[relay]?.check.read ? 1 : 0
      aggregateTally += this.result?.[relay]?.check.write ? 1 : 0
      if (aggregateTally == 3) {
        return 'public'
      }
      else if (aggregateTally == 0) {
        return 'offline'
      }
      else {
        return 'restricted'
      }
    },

    relaysTotal () {
      return this.relays.length //TODO: Figure out WHY?
    },

    relaysConnected () {
      return Object.entries(this.result).length
    },

    relaysComplete () {
      return this.relays.filter(relay => this.results?.[relay]?.state == 'complete').length
    },

    sha1 (message) {
      const hash = crypto.createHash('sha1').update(JSON.stringify(message)).digest('hex')
      return hash
    },

    isDone(){
      console.log('is done', this.relaysTotal(), '-', this.relaysConnected(), '<=', 0, this.relaysTotal()-this.relaysConnected() <= 0)
      return this.relaysTotal()-this.relaysComplete() <= 0
    },

    loadingComplete(){
      return this.isDone() ? 'loaded' : ''
    },

    timeSince(date) {
      var seconds = Math.floor((new Date() - date) / 1000);
      var interval = seconds / 31536000;
      if (interval > 1) {
        return Math.floor(interval) + " years";
      }
      interval = seconds / 2592000;
      if (interval > 1) {
        return Math.floor(interval) + " months";
      }
      interval = seconds / 86400;
      if (interval > 1) {
        return Math.floor(interval) + " days";
      }
      interval = seconds / 3600;
      if (interval > 1) {
        return Math.floor(interval) + " hours";
      }
      interval = seconds / 60;
      if (interval > 1) {
        return Math.floor(interval) + " minutes";
      }
      return Math.floor(seconds) + " seconds";
    },
  },

})
</script>
