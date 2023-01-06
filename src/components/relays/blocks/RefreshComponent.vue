<template>
  <span class="text-white lg:text-sm mr-2 ml-2 mt-1.5 text-xs">
    <span v-if="!store.tasks.isProcessing">Checked {{ sinceLast }} ago</span>
    <span v-if="store.tasks.isProcessing" class="italic lg:pr-9">
      <svg class="animate-spin mr-1 -mt-0.5 h-4 w-5 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      {{ this.store.tasks.getProcessed('relays').length }}/{{ this.relays.length }} Relays Checked
    </span>
  </span>
  <span class="text-white text-sm mr-2 mt-1.5" v-if="!store.tasks.isProcessing">-</span>
  <span class="text-white text-sm mr-2 mt-1.5" v-if="store.prefs.refresh && !store.tasks.isProcessing"> 
    Next check in: {{ untilNext  }}
  </span>
  <button 
    v-if="!store.tasks.isProcessing"
    class="mr-8 my-1 py-0 px-3 text-xs rounded border-b-3 border-slate-700 bg-slate-500  font-bold text-white hover:border-slate-500 hover:bg-slate-400" 
    :disabled='store.tasks.isProcessing' 
    @click="refreshNow()">
      Check{{ relay ? ` ${relay}` : "" }} Now
  </button>
</template>

<style scoped>

</style>

<script>
import { defineComponent, toRefs } from 'vue'

import { setupStore } from '@/store'
import RelaysLib from '@/shared/relays-lib.js'
import SharedComputed from '@/shared/computed.js'

import { Inspector } from 'nostr-relay-inspector'

const localMethods = {

  addToQueue: function(id, fn){
    this.store.tasks.addJob({
      id: id,
      handler: fn.bind(this)
    })
  },

  setRefreshInterval: function(){
    clearInterval(this.interval)
    this.interval = setInterval(() => {
      if(!this.store.prefs.refresh )
        return 

      this.untilNext = this.timeUntilRefresh()
      this.sinceLast = this.timeSinceRefresh()

      if(!this.store.tasks.isProcessing)
        this.invalidate()
    }, 1000)
  },
  refreshNow(){
    this.invalidate(true)
  },
  handleVisibility(){
    if(document.visibilityState === 'hidden')
      this.windowActive = false 
    else 
      this.windowActive = true
  },
  // handleRelaysFind(){
  //   this.addToQueue('relays/find', () => this.invalidate())  
  // },
  // handleRelaysSingle(relayURL){
  //   this.addToQueue('relays/single', () => this.invalidate(false, relayUrl))  
  // },
  invalidate: async function(force, single){
    if( (!this.isExpired && !force) ) 
      return

    this.store.tasks.startProcessing('relays')
    
    const relays = this.relays.filter( relay => !this.store.tasks.isRelayProcessed(relay) )

    // if(this.store.tasks.isActive)
    //   this.store.tasks.setRate('relays/find', 0)
    // else 
    //   this.store.tasks.setRate('relays/find', 2000)

    if(single) {
      await this.check(single)
    } 
    else {
      // const processed = new Set()
      for(let index = 0; index < relays.length; index++) {
        const relay = relays[index]
        await this.check(relay)
      }
    } 
  },

  completeAll: function(){
    this.store.tasks.finishProcessing('relays')
    this.store.relays.updateNow()
    //console.log('all are complete?', this.store.tasks.isProcessing)
    // const aggregates = new Object()
    // aggregates.all = this.getSortedAllRelays()
    // aggregates.public = this.getSortedPublicRelays()
    // aggregates.restricted = this.getSortedRestrictedRelays()
    // aggregates.offline = this.getOfflineRelays()
    // this.store.relays.setAggregates(aggregates)
    this.getAverageLatency()
  },

  

  check: async function(relay){
    await this.delay(this.averageLatency)
        
    return new Promise( (resolve, reject) => {
      const opts = {
          checkLatency: true,          
          getInfo: true,
          getIdentities: true,
          // debug: true,
          connectTimeout: this.getDynamicTimeout,
          readTimeout: this.getDynamicTimeout,
          writeTimeout: this.getDynamicTimeout,
          // data: { result: this.store.relays.results[relay] }
        }
      
      if(this.store.user.testEvent)
        opts.testEvent = this.store.user.testEvent

      let socket = new Inspector(relay, opts)

      socket
        .on('complete', (instance) => {
          instance.result.aggregate = this.getAggregate(instance.result)
          instance.relay.close()
          instance.result.log = instance.log
          resolve(instance.result)
          // console.log('complete?', instance.result.uri, this.store.tasks.getProcessed('relays', relays.length), this.relays.length)
        })
        .on('close', (relay) => {
          console.log(`${relay.url} has closed`)
        })
        .on('error', () => {
          reject()
        })
        .run()
    })
    .then((result) => {
      if(this.store.tasks.isRelayProcessed(result.uri))
        return 
      this.store.tasks.addProcessed('relays', result.uri)

      this.results[result.uri] = result
      this.setCache(result)

      if(this.store.tasks.getProcessed('relays').length >= this.relays.length)
        this.completeAll()
    })
    .catch( err => console.error(err) )

    
  },
  getAverageLatency: function(){
    const latencies = new Array()
    this.relays.forEach( relay => {
      latencies.push(this.results[relay]?.latency?.final)
    })
    this.averageLatency =  this.average(latencies)
  },
  average(arr){
    let sum = 0,
        total = arr.length;
    for (let i = 0;i<total;i++) 
      sum += arr[i];
    return Math.floor(parseFloat(sum/total));
  },
  timeUntilRefresh(){
    return this.timeSince(Date.now()-(this.store.relays.lastUpdate+this.store.prefs.duration-Date.now())) 
  },
  timeSinceRefresh(){
    return this.timeSince(this.store.relays.getLastUpdate)
  },
}

export default defineComponent({
  name: 'RefreshComponent',
  components: {},
  setup(props){
    const {resultsProp: results} = toRefs(props)
    return { 
      store : setupStore(),
      results: results
    }
  },
  created(){
    clearInterval(this.interval)
    // document.addEventListener('visibilitychange', this.handleVisibility, false)
  },
  unmounted(){
    clearInterval(this.interval)
    // document.removeEventListener("visibilitychange", this.handleVisibility, false);
  },
  beforeMount(){
    this.untilNext = this.timeUntilRefresh()
    this.sinceLast = this.timeSinceRefresh()
  },
  mounted(){
    this.relays = this.store.relays.getAll
    this.lastUpdate = this.store.relays.lastUpdate

    if(this.store.tasks.isProcessing)
      this.invalidate(true)
    else
      this.invalidate()

    this.setRefreshInterval()
  },
  updated(){},
  computed: Object.assign(SharedComputed, {
    getDynamicTimeout: function(){
      return this.averageLatency*this.relays.length
    },
  }),
  methods: Object.assign(localMethods, RelaysLib),
  props: {
    resultsProp: {
      type: Object,
      default(){
        return {}
      }
    },
  },
  data() {
    return {
      relay: "",
      relays: [],
      refresh: {},
      untilNext: null,
      lastUpdate: null,
      sinceLast: null,
      interval: null,
      windowActive: true,
      averageLatency: 200
    }
  },
})
</script>

<style scoped>
 #refresh { font-size: 12pt; color:#666; margin-bottom:15px }
 #refresh button { cursor: pointer; border-radius: 3px; border: 1px solid #a0a0a0; color:#333 }
 #refresh button:hover {color:#000;}
 #refresh button[disabled] {color:#999 !important; border-color:#e0e0e0}
</style>

