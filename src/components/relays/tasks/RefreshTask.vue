<template>
  <div
      v-if="(!store.tasks.isActive || store.tasks.getActiveSlug === this.slug) && !this.isSingle"
      class="inline">
    <span class="text-white lg:text-sm mr-2 ml-2 mt-1 text-xs">
      <span v-if="!store.tasks.isProcessing(this.slug)">Checked {{ sinceLast }} ago</span>
      <span v-if="store.tasks.isProcessing(this.slug)" class="italic lg:pr-9 text-white lg:text-sm mr-2 ml-2 block mt-1.5 md:pt-1.5 md:mt-0 text-xs">
        <svg class="animate-spin mr-1 -mt-0.5 h-4 w-5 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        {{ this.store.tasks.getProcessed(this.slug).length }}/{{ this.relays.length }} Relays Checked
      </span>
    </span>
    <span class="text-white lg:text-sm mr-2 ml-2 text-xs" v-if="!store.tasks.isProcessing(this.slug)">-</span>
    <span class="text-white lg:text-sm mr-2 ml-2 text-xs" v-if="store.prefs.refresh && !store.tasks.isProcessing(this.slug)"> 
      Next check in: {{ untilNext  }}
    </span>
    <button 
      v-if="!store.tasks.isProcessing(this.slug)"
      class="mr-8 my-1 py-1 px-3 text-xs rounded border-b-3 border-slate-700 bg-slate-500  font-bold text-white hover:border-slate-500 hover:bg-slate-400" 
      :disabled='store.tasks.isProcessing(this.slug)' 
      @click="refreshNow()">
        Check{{ relay ? ` ${relay}` : "" }} Now
    </button>
  </div>
  <span
    v-if="store.tasks.getActiveSlug === this.slug && this.isSingle"
      class="text-white lg:text-sm mr-2 ml-2 mt-1.5 text-xs mr-11">
      Loading {{ relayFromUrl }}
  </span>
  
</template>

<style scoped>

</style>

<script>
import { defineComponent, toRefs } from 'vue'

import { setupStore } from '@/store'
import RelaysLib from '@/shared/relays-lib.js'
import SharedComputed from '@/shared/computed.js'

import { Inspector } from 'nostr-relay-inspector'

// import { relays } from '../../../../relays.yaml'
import { geo } from '../../../../cache/geo.yaml'

const localMethods = {
  migrateLegacy(){
    let hit = false 
    for(let i=0;i<this.relays.length;i++) {
      const cache = localStorage.getItem(`nostrwatch_${this.relays[i]}`)
      if(!cache) 
        continue
      hit = true 
      break;
    }
    if(hit){
      this.relays.forEach( relay => {
        const oldKey = `nostrwatch_${relay}`
        const oldCache = localStorage.getItem(oldKey)
        if(oldCache instanceof Object)
          this.setCache(oldCache)
        localStorage.removeItem(oldKey)
      })
    }
  },

  queueJob: function(id, fn, unique){
    this.store.tasks.addJob({
      id: id,
      handler: fn,
      unique: unique
    })
  },

  setRefreshInterval: function(){
    clearInterval(this.interval)
    this.interval = setInterval(() => {
      if(!this.store.prefs.refresh )
        return 
      
      this.untilNext = this.timeUntilRefresh()
      this.sinceLast = this.timeSinceRefresh()

      if(this.store.tasks.getProcessed(this.slug).length >= this.relays.length && !this.isSingle){
        this.store.tasks.updateNow(this.slug)
        this.store.tasks.finishProcessing(this.slug)
      }

      if(!this.store.tasks.isProcessing(this.slug) && !this.isSingle)
        this.invalidate()
        
    }, 1000)
  },
  setLatencyInterval: function(){
    this.setLatencyInterval = setInterval( () => {

    })
  },

  refreshNow(){
    this.invalidate(true)
  },

  handleVisibility(){
    if(document.visibilityState === 'hidden')
      this.windowActive = false 
    else 
      this.windowActive = true

    if(this.windowActive) 
      this.store.layout.setActiveTab(this.$tabId)
  },


  invalidate: async function(force, single){
    console.log('invalidate?', !(!this.isExpired(this.taskSlug, this.getRefreshInterval)))

    if( (!this.isExpired(this.taskSlug, this.getRefreshInterval) && !force) ) 
      return

    if(!this.windowActive)
      return

    this.queueJob(this.slug, async () => {
      const relays = this.relays.filter( relay => !this.store.tasks.isProcessed(this.slug, relay) )

      console.log('unprocessed relays', 
        this.relays.filter( relay => !this.store.tasks.getProcessed(this.slug).includes(relay)))

      if(single) {
        await this.check(single)
          .then((result) => this.completeRelay(single, result) )
          .catch( () => this.completeRelay(single) )
      } 
      else {
        for(let index = 0; index < relays.length; index++) {
          await this.delay(this.averageLatency)
          const relay = relays[index]
          this.check(relay)
            .then((result) => this.completeRelay(relay, result) )
            .catch( () => this.completeRelay(relay) ) //wait, what? TODO: fix
        }
      } 
    }, true)
    
  },

  completeRelay: function(relay, result){
    if(this.store.tasks.isProcessed(this.slug, relay))
      return 

    this.store.tasks.addProcessed(this.slug, relay)
    
    if(result)  {
      // console.log('whoops', result)
      this.results[relay] = result
      this.setCache(result)
    }

    if(this.isSingle)
      this.completeAll(true)
    else if(this.store.tasks.getProcessed(this.slug).length >= this.relays.length)
      this.completeAll()
  },

  completeAll: function(single){
    this.store.tasks.completeJob(this.slug)
    // this.setAverageLatency()
    if(single)
      return 

    this.store.relays.setAggregateCache('public', Object.keys(this.results).filter( result => this.results[result].aggregate === 'public' ))
    this.store.relays.setAggregateCache('restricted', Object.keys(this.results).filter( result => this.results[result].aggregate === 'restricted' ))
    this.store.relays.setAggregateCache('offline', Object.keys(this.results).filter( result => this.results[result].aggregate === 'offline' ))
  },

  check: async function(relay){
    return new Promise( (resolve) => {
      const opts = {
          checkRead: true, 
          checkWrite: true,   
          checkLatency: true,
          getInfo: true,
          getIdentities: true,
          run: true,
          debug: true,
          connectTimeout: this.getDynamicTimeout,
          readTimeout: this.getDynamicTimeout,
          writeTimeout: this.getDynamicTimeout,
        }
      
      // if(this.isSingle)
        opts.checkAverageLatency = true
      
      if(this.store.user.testEvent)
        opts.testEvent = this.store.user.testEvent

      let socket = new Inspector(relay, opts)

      socket
        .on('open', () => {
          if(!this.isSingle)
            return
          this.results[this.relayFromUrl].latency.average = null
          this.results[this.relayFromUrl].latency.min = null
          this.results[this.relayFromUrl].latency.max = null
          this.setCache(this.results[this.relayFromUrl])
        })
        .on('complete', (instance) => {
          // console.log('completed?', instance.result)
          instance.result.aggregate = this.getAggregate(instance.result)
          instance.relay.close()
          instance.result.log = instance.log
          resolve(instance.result)
        })
    })
  },

  setAverageLatency: function(){
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
    return this.timeSince(Date.now()-(this.store.tasks.getLastUpdate(this.slug)+this.store.prefs.duration-Date.now())) 
  },
  timeSinceRefresh(){
    return this.timeSince(this.store.tasks.getLastUpdate(this.slug)) || Date.now()
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
      averageLatency: 200,
      pageOpen: 0,
      slug: 'relays/check',
      latencies: []
      // history: null
    }
  },

  created(){
    clearInterval(this.interval)
    document.addEventListener('visibilitychange', this.handleVisibility, false)
  },

  unmounted(){
    clearInterval(this.interval)
  },

  beforeMount(){
    this.lastUpdate = this.store.tasks.getLastUpdate(this.slug)
    this.untilNext = this.timeUntilRefresh()
    this.sinceLast = this.timeSinceRefresh()
    
    this.relays = Array.from(new Set(this.store.relays.getShuffled))
    this.store.relays.setRelays(this.relays)
    this.store.relays.setGeo(geo)

    for(let ri=0;ri-this.relays.length;ri++){
      const relay = this.relays[ri],
            cache = this.getCache(relay)
      this.results[relay] = cache
    }
  },

  mounted(){
    this.migrateLegacy()
    if( this.isSingle ){
      this.slug = 'relays/single'
      this.invalidate(true, this.relayFromUrl)
      // this.runLatencyCheck()
    } else {
      if(this.store.tasks.isProcessing(this.slug))
        this.invalidate(true)
      else
        this.invalidate()
    }
    this.setRefreshInterval()
  },

  updated(){},

  computed: Object.assign(SharedComputed, {
    getDynamicTimeout: function(){
      const calculated = this.averageLatency*this.relays.length
      return calculated > 10000 ? calculated : 10000
    },
    getRefreshInterval: function(){
      const relay = this.relayFromUrl
      console.log('wtf', relay, this.results[relay], this.results[relay]?.check?.connect, this.results[relay]?.check?.read, this.results[relay]?.check?.write, this.results[relay]?.latency?.final )
      if( !relay )
        return this.store.prefs.duration
      if( this.results[relay]?.check?.connect && this.results[relay]?.check?.read && this.results[relay]?.check?.write && typeof this.results[relay]?.latency?.final !== 'undefined' )
        return this.results[relay].latency.final * 5 
      if(this.results[relay]?.check?.connect && this.results[relay]?.check?.read && this.results[relay]?.check?.write)
        return 30*1000
      return this.store.prefs.duration
    }
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

})
</script>

<style scoped>
 #refresh { font-size: 12pt; color:#666; margin-bottom:15px }
 #refresh button { cursor: pointer; border-radius: 3px; border: 1px solid #a0a0a0; color:#333 }
 #refresh button:hover {color:#000;}
 #refresh button[disabled] {color:#999 !important; border-color:#e0e0e0}
</style>

