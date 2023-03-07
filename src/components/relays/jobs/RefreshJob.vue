<template>
  <div v-if="this.duration">
    Finished. Took {{ timeSince(Date.now()-this.duration) }}
  </div>
  <div class="hidden lg:inline-block" v-if="!this.duration">
    <div 
      v-if="store.jobs.getActiveSlug?.includes('relays/check/') && !isSingle"
      class="text-white/30">
      checking {{ store.jobs.getActiveSlug.replace('relays/check/', '') }}
    </div>
    <div
        v-if="(!store.jobs.isActive || store.jobs.getActiveSlug === this.slug) && !this.isSingle"
        class="text-inherit">
      <span class="text-inherit">
        <span v-if="!store.jobs.isJobActive(this.slug)" class="hidden lg:inline mr-2">Checked {{ timeSinceRefresh }} ago</span>
        <span v-if="store.jobs.isJobActive(this.slug)" class="italic text-inherit ml-2 inline-block">
          <svg class="-mt-1.5 animate-spin mr-1 h-4 w-5 text-white inline-block" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          {{ this.store.jobs.getProcessed(this.slug).length }}/{{ this.relays.length }} Relays Checked
        </span>
      </span>
      <span class="text-inherit hidden lg:inline mr-1" v-if="!store.jobs.isJobActive(this.slug)">-</span>
      <span class="text-inherit mr-2" v-if="store.prefs.refresh && !store.jobs.isJobActive(this.slug)"> 
        next check in: {{ timeUntilRefresh }}
      </span>
      <button 
        v-if="!store.jobs.isJobActive(this.slug)"
        class=" text-xs -mt-1.5 my-1 py-1 px-3 rounded border-b-3 border-slate-700 bg-slate-500  font-bold text-white hover:border-slate-500 hover:bg-slate-400" 
        :disabled='store.jobs.isJobActive(this.slug)' 
        @click="checkNow()">  
          Check{{ relay ? ` ${relay}` : "" }} Now
      </button>
    </div>
    <span
      v-if="store.jobs.getActiveSlug === this.slug && this.isSingle"
        class="text-inherit ml-2">
        <svg class="animate-spin mr-2 h-4 w-5 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        checking {{ relayFromUrl }}
    </span>
  </div>
</template>

<style scoped>

</style>

<script>
import { defineComponent } from 'vue'

import { setupStore } from '@/store'
import RelaysLib from '@/shared/relays-lib.js'
import SharedComputed from '@/shared/computed.js'

import { RelayChecker, QueuedChecker, getAverageLatency, getMedianLatency, getMinLatency, getMaxLatency } from 'nostrwatch-js'

import { getGeo, getPrebuiltGeo } from '@/utils'


// import { relays } from '../../../../relays.yaml'

const localMethods = {
  async CheckRelaysJob(force, single){
    // console.log('invalidate?', !((!this.isExpired(this.slug, this.getRefreshInterval) && !force) && !this.isSingle), this.windowActive)
    if( (!this.isExpired(this.slug, this.getRefreshInterval) && !force) && !this.isSingle ) 
      return

    if(!this.windowActive)
      return

    

    // console.log('queue job', single, this.slug)
    
    this.queueJob(
      this.slug, 
      async () => await this.checkJob(single), 
      true
    )
  },

  pruneResult: function(result){
    let r = {}

    if(result) {
      r = {
        state: result.state,
        url: result.url,
        aggregate: result.aggregate,
        check: {
          connect: result.check.connect,
          read: result.check.read,
          write: result.check.write,
          latency: result.check.latency,
        },
        latency: {}
      } 
      if(result.latency?.data?.length) {
        r.latency.average = getAverageLatency(result.latency.data)
        r.latency.median = getMedianLatency(result.latency.data)
        r.latency.min = getMinLatency(result.latency.data)
        r.latency.max = getMaxLatency(result.latency.data)
        r.latency.data = result.latency.data
      }
      r.latency.connect = result.latency?.connect? [result.latency?.connect]: result.latency?.connect
      r.latency.write = result.latency?.write? [result.latency?.write]: result.latency.write

      // result.check.connect = r.latency?.connect? result.latency.connect: result.check.connect
      // result.check.read = r.latency?.read? result.latency.read: result.check.read
      // result.check.write = r.latency?.write? result.latency.write: result.check.write
      try {
        r.latency.overall = [
          getAverageLatency([
            ...r.latency?.connect? r.latency.connect: [], 
            ...r.latency?.data? r.latency.data: [], 
            ...r.latency?.write? r.latency.write: [], 
          ])
        ]
      }
      catch(e){""}

      if(r.latency?.connect?.length && !r.check.connect) 
        console.log('wtf', r.url, r.check.connect, r.check, r.latency )

      r.latency.average = r.latency.overall

      if(!result.check.connect && result.latency.connect )
        console.log('hmmm', result.url, !result.check.connect, result.latency.connect, '!result.check.connect && result.latency.connect', !result.check.connect && result.latency.connect)
      
      if(result?.info && Object.keys(result.info).length) //should be null, but is an empty object. Need to fix in nostrwatch-js
        r.info = result.info

      if(result?.pubkeyValid)
        r.pubkeyValid = result.pubkeyValid

      if(result?.pubkeyError)
        r.pubkeyError = result.pubkeyError

      if(result?.info?.limitation?.payment_required && !this.isLoggedIn){
        r.aggregate = 'restricted'
        r.check.write = false 
      }

      if(this.isSingle)
        r.log = result.log

      const uptime = this.getUptimePercentage(result.url)
      r.uptime = uptime
    }
    return r
  },
  checkJob: async function(single){

    if(single)
    {
      await this.setGeo(single)
      await this.checkSingle(single, this.slug)
    } 
    else 
    {
      await this.checkQueue()
    }

    this.completeAll(single)
  },

  queueOpts: function(){
    return {
        maxQueues:          2, //this.store.prefs.firstVisit? 4: 5, 
        concurrency:        11, //this.store.prefs.firstVisit? 5: 10, 
        fastTimeout:        30000, //this.store.prefs.firstVisit? 5000: 10000,
        throttleMillis:     1000,
        RelayChecker:       this.checkerOpts()
      }
  },

  setGeo: async function(relay){
    if( process.env.VUE_APP_IP_API_KEY && this.store.prefs.runtimeGeo ){
      getGeo(relay).then( geo => {
        if(!geo?.lat)
          return
        this.store.relays.geo = Object.assign(this.store.relays.geo, { [relay]: geo } )
      })
    }
    else {
      if(this.hasGeo)
        return
      await this.setGeoFromCache()
    }
  },

  setGeoFromCache: async function(){
    if( Object.keys(this.store.relays.geo.length) === this.store.relays.getAll.length )
      return this.hasGeo = true
    this.store.relays.geo = Object.assign(this.store.relays.geo, await getPrebuiltGeo() )
  },

  checkQueue: async function(relays){
    this.relays = relays? relays: this.store.relays.getAll
    relays = this.sortRelays( this.relays.filter( relay => !this.store.jobs.isProcessed(this.slug, relay) ) )
    
    if(!relays.length)
      return

      console.log('here', this.queueOpts())

    return new Promise( resolve => {
      
      this.queue = new QueuedChecker(relays, this.queueOpts())
      this.queue
        .on('result', result => {
          // console.log("checked:", result.url, result?.check?.connect, result?.latency?.connect)
          if(!result?.url)
            return

          this.setGeo(result.url)
          result.aggregate = this.getAggregate(result)
          console.log('aggregate', result.url, result.aggregate)
          result = this.pruneResult(result)
          this.store.results.mergeDeep({[result.url]: result})
          this.store.jobs.addProcessed(this.slug, result.url)
        })
        .on('complete',async () => {
          console.log('complete?')
          resolve()
        })
    })
  },

  checkSingle: async function(relay, slug){
    await this.check(relay)
      .then((result) =>{
        result.aggregate = this.getAggregate(result)
        result = this.pruneResult(result)
        this.store.results.mergeDeep({ 
          [result.url]: result
        })
        this.completeRelay(result)
      })
      .catch( (err) => console.error(`there was an error: ${err}`) )
    if(this.stop)
      return
    this.store.jobs.completeJob(slug)
  },

  completeRelay: function(result){
    this.store.jobs.addProcessed(this.slug, result.url)
  },

  completeAll: function(){
    if(this.stop)
      return
    this.store.jobs.completeJob(this.slug)
  },

  checkerOpts: function(){
    const advT      =  this.store.prefs.advancedTimeout,
          cTimeout  =  this.store.prefs.connectTimeout,
          rTimeout  =  this.store.prefs.readTimeout,
          wTimeout  =  this.store.prefs.writeTimeout,
          inspectT  =  this.store.prefs.inspectTimeout

    return {
      debug:                true,        
      checkRead:            true, 
      checkWrite:           true,   
      checkLatency:         true,
      checkAverageLatency:  true,
      getInfo:              this.store.prefs.checkNip11 || this.isSingle,
      getIdentities:        false,
      run:                  true,
      connectTimeout:       advT?   cTimeout:   inspectT,
      readTimeout:          advT?   rTimeout:   inspectT,
      writeTimeout:         advT?   wTimeout:     inspectT,
    }
  },

  check: async function(relay){
    // console.log('checking', relay)
    if(this.stop)
      return
    return new Promise( (resolve) => {
      const opts = this.checkerOpts()
      
      if(this.store.user.testEvent)
        opts.testEvent = this.store.user.testEvent

      const $checker = new RelayChecker(relay, opts)

      $checker
        .on('open', () => {})
        .on('complete', (self) => {
          self.result.aggregate = this.getAggregate(self.result)
          resolve(self.result)  
        })
        .on('error', () => {
          resolve()
        })
        
      if(this.isSingle)
        $checker.on('change', (result) => {
          this.store.results.mergeDeep({
            [result.url]: this.pruneResult(result)
          })
        })
      
      // $checker.run()
      
      this.relayCheckers.push($checker)
    })
  },

  setAverageLatency: function(){
    const latencies = new Array()
    this.relays.forEach( relay => {
      latencies.push(this.store.results.get(relay)?.latency?.final)
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

  setRefreshInterval: function(){
    clearInterval(this.interval)
    this.interval = setInterval(() => {
      if( this.store.jobs.isIdle && !this.store.prefs.firstVisit )
        this.lazyChecks()

      if( (!this.store.prefs.refresh || !this.store.prefs.clientSideProcessing) && !this.isSingle )
        return

      if(!this.store.jobs.isJobActive(this.slug) && !this.isSingle)
        this.CheckRelaysJob()
        
    }, 1000)
  },

  checkNow(){
    this.store.jobs.lastUpdate[this.slug] = null
    this.store.jobs.processed[this.slug] = []
    this.CheckRelaysJob(true)
  },

  async lazyChecks(){
    const relays = Object.keys(this.store.results.all).filter( async (relay) => {
      const result = this.store.results.get(relay)
      return ('offline' === result?.aggregate || 'restricted' === result?.aggregate) && result?.uptime > 0
    })
    relays.forEach( async (relay) => {
      const slug = `relays/check/${relay}`,
            expired = (Date.now()-this.store.jobs.getLastUpdate(slug))>this.lazyInterval 
      if(!expired)
        return
      const result = this.store.results.get(relay)
      if('offline' === result?.aggregate && result?.uptime > 90)
        this.queueJob(
          slug, 
          async () => await this.checkSingle(result.url, slug), 
          true
        )
    })
  },

  handleVisibility(){
    if(document.visibilityState === 'hidden')
      this.windowActive = false 
    else 
      this.windowActive = true

    if(this.windowActive) 
      this.store.layout.setActiveTab(this.$tabId)
  },
}

export default defineComponent({

  name: 'CheckRelaysJob',

  components: {},

  setup(){
    return { 
      store : setupStore()
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
      relayCheckers: [],
      stop: false,
      inspectTimeout: 15*1000,
      retry: [],
      retries: 1,
      lazyInterval: 1*60*60*1000,
      duration: null,
      hasGeo: false
      // history: null
    }
  },

  created(){
    clearInterval(this.interval)
    document.addEventListener('visibilitychange', this.handleVisibility, false)
  },

  unmounted(){
    console.log('unmounted!!!')
    clearInterval(this.interval)
    this.relayCheckers.forEach( $checker => $checker?.close())
    this.stop = true
  },

  beforeMount(){
  },

  mounted(){
    if( this.isSingle ){
      const relay = this.relayFromUrl
      this.slug = `relays/check/${relay}`
      this.CheckRelaysJob(true, relay)
    } else {
      this.CheckRelaysJob()
    }
    if(this.store.prefs.clientSideProcessing && !this.isSingle)
      this.setRefreshInterval()
  },

  updated(){},

  computed: Object.assign(SharedComputed, {
    timeUntilRefresh(){
      return this.timeSince(Date.now()-(this.store.jobs.getLastUpdate(this.slug)+this.store.prefs.duration-Date.now())) 
    },
    timeSinceRefresh(){
      return this.timeSince(this.store.jobs.getLastUpdate(this.slug)) || Date.now()
    },
    relayFromSlug: function(){
      return slug => {
        const segments = slug.split('/')
        if(segments.length === 3)
          return segments[2]
      }
    },
    getDynamicTimeout: function(){
      const calculated = this.averageLatency*this.relays.length
      return calculated > 10000 ? calculated : 10000
    },
    getRefreshInterval: function(){
      const relay = this.relayFromUrl
      if( !relay )
        return this.store.prefs.duration
      if( this.store.results.get(relay)?.check?.connect && this.store.results.get(relay)?.check?.read && this.store.results.get(relay)?.check?.write && typeof this.store.results.get(relay)?.latency?.final !== 'undefined' )
        return this.store.results.get(relay).latency.final * 5 
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

      // this.relays = this.store.relays.getAll
      // const relays = this.relays.filter( relay => !this.store.jobs.isProcessed(this.slug, relay) )
      // await 
      // let relayChunks = this.chunk(100, relays)
      // for(let c=0;c<relayChunks.length;c++){
      //   let promises = []
      //   const chunk = relayChunks[c]
      //   for(let index = 0; index < chunk.length; index++) {
      //     await new Promise( resolve => setTimeout(resolve, 100))
      //     const promise = new Promise( resolve => {
      //       const relay = chunk[index] 
      //       this.check(relay)
      //         .then((result) => {
      //           this.store.jobs.addProcessed(this.slug, result.url)
      //           this.store.results.mergeDeep({ [result.url]: this.pruneResult(result) })
      //           resolve()
      //         })
      //         .catch( (err) => { 
      //           console.error(err)
      //           resolve()
      //         })
      //     })
      //     promises.push(promise)
      //   }
      //   await Promise.all(promises)
      // }
</script>

<style scoped>
 #refresh { font-size: 12pt; color:#666; margin-bottom:15px }
 #refresh button { cursor: pointer; border-radius: 3px; border: 1px solid #a0a0a0; color:#333 }
 #refresh button:hover {color:#000;}
 #refresh button[disabled] {color:#999 !important; border-color:#e0e0e0}
</style>
