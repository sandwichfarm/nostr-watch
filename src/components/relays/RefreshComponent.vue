<template>
  <span class="text-white lg:text-sm mr-2 ml-2 mt-1.5 text-xs">
    <span v-if="!store.relays.isProcessing">Checked {{ sinceLast }} ago</span>
    <span v-if="store.relays.isProcessing" class="italic">Checking Now</span>
  </span>
  <span class="text-white text-sm mr-2 mt-1.5" v-if="!store.relays.isProcessing">-</span>
  <span class="text-white text-sm mr-2 mt-1.5" v-if="store.prefs.refresh && !store.relays.isProcessing"> 
    Next check in: {{ untilNext }}
  </span>
  <button 
    v-if="!store.relays.isProcessing"
    class="mr-8 my-1 py-0 px-3 text-xs rounded border-b-3 border-slate-700 bg-slate-500  font-bold text-white hover:border-slate-500 hover:bg-slate-400" 
    :disabled='store.relays.isProcessing' 
    @click="refreshNow()">
      Check{{ relay ? ` ${relay}` : "" }} Now
  </button>
</template>

<style scoped>

</style>

<script>
import { defineComponent, toRefs } from 'vue'
import RelaysLib from '@/shared/relays-lib.js'
import { setupStore } from '@/store'
import { Inspector } from 'nostr-relay-inspector'

const localMethods = {
  timeUntilRefresh(){
    return this.timeSince(Date.now()-(this.store.relays.lastUpdate+this.store.prefs.duration-Date.now())) 
  },
  timeSinceRefresh(){
    return this.timeSince(this.store.relays.lastUpdate)
  },
  setRefreshInterval: function(){
    clearInterval(this.interval)
    this.interval = setInterval(() => {
      if(!this.store.prefs.refresh || !this.windowActive )
        return 

      this.untilNext = this.timeUntilRefresh() 
      this.sinceLast = this.timeSinceRefresh() 
      if(!this.store.relays.isProcessing)
        this.invalidate()
    }, 1000)
  },
  refreshNow(){
    this.disabled = true
    this.invalidate(true)
  },
  handleVisibility(){
    if(document.visibilityState === 'hidden')
      this.windowActive = false 
    else 
      this.windowActive = true
    console.log('window active?', this.windowActive)
  },

  invalidate: async function(force, single){
    if( (!this.isExpired() && !force) ) 
      return

    this.store.relays.startProcessing()

    if(single) {
      await this.check(single) 
    } 
    else {
      const processed = new Set()
      for(let index = 0; index < this.relays.length; index++) {
        const relay = this.relays[index]
        await this.delay(this.averageLatency).then( () => { 
          this.check(relay)
            .then((result) => {
              this.results[result.uri] = result
              this.setCache(result)
              processed.add(result.uri)
              // console.log('processing status', processed, '/', this.relays.length)
              console.log('complete?', result.uri, processed.size, this.relays.length)
              if(processed.size >= this.relays.length)
                this.completeAll()
            })
            .catch( err => console.error(err) )
        }).catch(err => console.error(err))
      }
    } 
  },

  completeAll: function(){
    this.store.relays.finishProcessing()
    this.store.relays.updateNow()
    console.log('all are complete?', this.store.relays.isProcessing)
    // const aggregates = new Object()
    // aggregates.all = this.getSortedAllRelays()
    // aggregates.public = this.getSortedPublicRelays()
    // aggregates.restricted = this.getSortedRestrictedRelays()
    // aggregates.offline = this.getOfflineRelays()
    // this.store.relays.setAggregates(aggregates)
    this.getAverageLatency()
  },

  getDynamicTimeout: function(){
    return this.averageLatency*this.relays.length
  },

  check: async function(relay){
    return new Promise( (resolve, reject) => {
      const opts = {
          checkLatency: true,          
          getInfo: true,
          getIdentities: true,
          // debug: true,
          connectTimeout: this.getDynamicTimeout(),
          readTimeout: this.getDynamicTimeout(),
          writeTimeout: this.getDynamicTimeout(),
          // data: { result: this.store.relays.results[relay] }
        }
      
      if(this.store.user.testEvent)
        opts.testEvent = this.store.user.testEvent

      let socket = new Inspector(relay, opts)

      socket
        .on('complete', (instance) => {
          instance.result.aggregate = this.getAggregate(instance.result)
          instance.relay.close()
          resolve(instance.result)
        })
        .on('close', (relay) => {
          console.log(`${relay.url} has closed`)
        })
        .on('error', () => {
          reject()
        })
        .run()
    })
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
  }
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
    document.addEventListener('visibilitychange', this.handleVisibility, false)
  },
  unmounted(){
    clearInterval(this.interval)
  },
  mounted(){
    if(!this.windowActive)
      return 

    this.relays = this.store.relays.getAll
    this.lastUpdate = this.store.relays.lastUpdate

    console.log('last update', this.lastUpdate)

    clearInterval(this.interval)

    this.untilNext = this.timeUntilRefresh() 
    this.sinceLast = this.timeSinceRefresh() 

    //If user leaves page before processing completes, force invalidate cache
    console.log('is processing?', this.store.relays.isProcessing)
    if(this.store.relays.isProcessing)
      this.invalidate(true)
    else
      this.invalidate()

    this.setRefreshInterval()
  },
  updated(){
    this.untilNext = this.timeUntilRefresh() 
    this.sinceLast = this.timeSinceRefresh() 
  },
  computed: {},
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
      disabled: true,
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

