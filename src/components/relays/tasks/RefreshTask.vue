<template>
  <div
      v-if="(!store.tasks.isActive || store.tasks.getActiveSlug === this.slug) && !this.isSingle"
      class="text-inherit">
    <span class="text-inherit">
      <span v-if="!store.tasks.isTaskActive(this.slug)" class="hidden lg:inline mr-2">Checked {{ sinceLast }} ago</span>
      <span v-if="store.tasks.isTaskActive(this.slug)" class="italic text-inherit ml-2 inline-block">
        <svg class="-mt-1.5 animate-spin mr-1 h-4 w-5 text-white inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        {{ this.store.tasks.getProcessed(this.slug).length }}/{{ this.relays.length }} Relays Checked
      </span>
    </span>
    <span class="text-inherit hidden lg:inline mr-1" v-if="!store.tasks.isTaskActive(this.slug)">-</span>
    <span class="text-inherit mr-2" v-if="store.prefs.refresh && !store.tasks.isTaskActive(this.slug)"> 
      next check in: {{ untilNext }}
    </span>
    <button 
      v-if="!store.tasks.isTaskActive(this.slug)"
      class=" text-xs -mt-1.5 my-1 py-1 px-3 rounded border-b-3 border-slate-700 bg-slate-500  font-bold text-white hover:border-slate-500 hover:bg-slate-400" 
      :disabled='store.tasks.isTaskActive(this.slug)' 
      @click="refreshNow()">  
        check{{ relay ? ` ${relay}` : "" }} Now
    </button>
  </div>
  <span
    v-if="store.tasks.getActiveSlug === this.slug && this.isSingle"
      class="text-inherit ml-2">
      <svg class="animate-spin mr-2 h-4 w-5 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      checking {{ relayFromUrl }}
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
      if(!this.store.prefs.refresh || !this.store.prefs.clientSideProcessing)
        return
      
      this.untilNext = this.timeUntilRefresh()
      this.sinceLast = this.timeSinceRefresh()

      // if(this.store.tasks.getProcessed(this.slug).length >= this.relays.length && !this.isSingle){
      //   this.store.tasks.updateNow(this.slug)
      //   this.store.tasks.finishProcessing(this.slug)
      // }

      if(!this.store.tasks.isTaskActive(this.slug) && !this.isSingle)
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
    //console.log('invalidate?', !(!this.isExpired(this.slug, this.getRefreshInterval)))
    if( (!this.isExpired(this.slug, this.getRefreshInterval) && !force) ) 
      return

    if(!this.windowActive)
      return

    this.queueJob(
      this.slug, 
      () => this.checkJob(single), 
      true
    )
  },

  pruneResult: function(relay, result){
    let resultPruned

    if(result)  {
      //console.log('whoops', result)
      resultPruned = {
        url: relay,
        aggregate: result.aggregate,
        check: {
          connect: result.check.connect,
          read: result.check.read,
          write: result.check.write,
          latency: result.check.latency,
          averageLatency: result.check.averageLatency
        },
        latency: result?.latency,
        info: result.info,
        uptime: this.getUptimePercentage(relay),
        identities: result.identities,
        pubkeyValid: result.pubkeyValid,
        pubkeyError: result.pubkeyError,
      }
    }
    return resultPruned
  },

  checkJob: async function(single){
    if(single) {
      await this.check(single)
        .then((result) => this.completeRelay(result) )
        .catch( () => console.log('there was an error') )
      this.completeAll()
    } 
    else {
      this.relays = this.store.relays.getAll
      const relays = this.relays.filter( relay => !this.store.tasks.isProcessed(this.slug, relay) )
      let relayChunks = this.chunk(100, relays)
      for(let c=0;c<relayChunks.length;c++){
        let promises = [],
            resultsChunk = {}
        const chunk = relayChunks[c]
        for(let index = 0; index < chunk.length; index++) {
          const promise = new Promise( resolve => {
          const relay = chunk[index] 
          this.check(relay)
            .then((result) => {
              this.completeRelay(result, resolve)
            })
            .catch( () => { 
              resolve()
            }) //wait, what? TODO: fix
          })
          promises.push(promise)
        }
        await Promise.all(promises)
        this.results = Object.assign({}, resultsChunk, this.results)
        Object.keys(resultsChunk).forEach( relay => { 
          this.setCache(resultsChunk[relay])
        })
      }
      this.completeAll()
    } 
  },

  completeRelay: function(result, resolve){
    this.store.tasks.addProcessed(this.slug, result.url)
    result = this.pruneResult(result.url, result)
    result = Object.assign(this.results[result.url] || {}, result)
    this.setCache(result)
    this.results[result.url] = result
    if(resolve instanceof Function)
      resolve()
  },

  completeAll: function(single){
    this.store.tasks.completeJob(this.slug)
    
    if(single)
      return 

    this.store.relays.setAggregateCache('public', Object.keys(this.results).filter( result => this.results[result].aggregate === 'public' ))
    this.store.relays.setAggregateCache('restricted', Object.keys(this.results).filter( result => this.results[result].aggregate === 'restricted' ))
    this.store.relays.setAggregateCache('offline', Object.keys(this.results).filter( result => this.results[result].aggregate === 'offline' ))
  },

  check: async function(relay){
    if(this.stop)
      return
    return new Promise( (resolve) => {
      const opts = {
          checkRead: true, 
          checkWrite: true,   
          checkLatency: true,
          getInfo: this.store.prefs.checkNip11 || this.isSingle,
          getIdentities: false,
          run: true,
          // debug: true,
          // connectTimeout: this.getDynamicTimeout,
          // readTimeout: this.getDynamicTimeout,
          // writeTimeout: this.getDynamicTimeout,
          connectTimeout: 15*1000,
          readTimeout: 15*1000,
          writeTimeout: 15*1000,
        }
      
      // if(this.isSingle)
      opts.checkAverageLatency = true
      
      if(this.store.user.testEvent)
        opts.testEvent = this.store.user.testEvent

      const $inspector = new Inspector(relay, opts)

<<<<<<< HEAD
      socket
        .on('open', () => {})
=======
      $inspector
        .on('open', () => {          
        })
>>>>>>> 6f65516... find job queue bug and patch
        .on('complete', (instance) => {
          //console.log('completed?', instance.result)
          instance.result.aggregate = this.getAggregate(instance.result)
          instance.result.log = instance.log
          this.closeRelay(instance.relay)
          resolve(instance.result)
        })
        .on('error', () => {
          resolve()
        })
      
      this.inspectors.push($inspector)
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
      relays: this.store.relays.getAll,
      refresh: {},
      untilNext: null,
      lastUpdate: null,
      sinceLast: null,
      interval: null,
      windowActive: true,
      averageLatency: 200,
      pageOpen: 0,
      slug: 'relays/check',
      latencies: [],
      inspectors: [],
      stop: false
      // history: null
    }
  },

  created(){
    clearInterval(this.interval)
    document.addEventListener('visibilitychange', this.handleVisibility, false)
  },

  unmounted(){
    clearInterval(this.interval)
    this.inspectors.forEach( $inspector => $inspector.close())
    this.stop = true
  },

  beforeMount(){
    this.lastUpdate = this.store.tasks.getLastUpdate(this.slug)
    this.untilNext = this.timeUntilRefresh()
    this.sinceLast = this.timeSinceRefresh()

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
      this.invalidateTask()
    }
    if(this.store.prefs.clientSideProcessing && !this.isSingle)
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

