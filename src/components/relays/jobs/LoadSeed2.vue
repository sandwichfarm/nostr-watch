<template>
  <span 
    v-if="this.store.jobs.getActiveSlug === slug"
    class="text-inherit">
  <span class="text-inherit">
    <span v-if="!store.jobs.isJobActive(this.slug) && !isSingle" class="hidden text-inherit">
      checked {{ timeSinceRefresh }} ago
    </span>
    <span v-if="store.jobs.isJobActive(this.slug) && !isSingle" class="italic text-inherit ml-2 inline-block">
      <svg class="animate-spin mr-1 -mt-0.5 h-4 w-5 inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      processing
      <!-- {{ this.store.jobs.getProcessed(this.slug).length }}/{{ this.relays.length }} loaded -->
    </span>
  </span>
  <span class="text-inherit mr-2 ml-2 hidden lg:inline" v-if="!store.jobs.isJobActive(this.slug)">-</span>
  <span class="text-inherit mr-2 ml-2" v-if="store.prefs.refresh && !store.jobs.isJobActive(this.slug)"> 
    next check in {{ untilNext }}
  </span>
  <!--<span v-if="isSingle">Loading {{ relay }} from history node...</span>
    <span v-if="!isSingle">Loading data from history relay</span>
  </span>
  <span 
    v-if="(!store.jobs.isActive || this.store.jobs.getActiveSlug === slug) && !isSingle">
    <span 
      v-if="store.prefs.refresh && !store.jobs.isJobActive(this.slug)" 
      class="text-white lg:text-sm ml-2 text-xs mt-1.5 inline-block mr-10" >
      Next check in: {{ untilNext }}
    </span> -->
  </span> 
</template>

<style scoped>

</style>

<script>
import { defineComponent, toRefs } from 'vue'
import crypto from 'crypto'

import { setupStore } from '@/store'

import RelayMethods from '@/shared/relays-lib.js'
import SharedComputed from '@/shared/computed.js'

import { RelayPool } from 'nostr'

import { getAverageLatency, getMedianLatency, getMinLatency, getMaxLatency  } from 'nostrwatch-js'

const localMethods = {
  LoadSeed(force, single){
    // if( ( this.store.jobs.getLastUpdate('relays/check') || ( this.store.jobs.processed?.['relays/check'] && this.store.jobs.processed?.['relays/check'].length ) ) && !force ) 
    //   return
    if( (!this.isExpired(this.slug, 15*60*1000) && !force) ) 
      return
    
    this.queueJob(
      this.slug, 
      async () => {
        this.LoadSeedJob(single)
      },
      true
    )
  },
  setRefreshInterval: function(){
    clearInterval(this.interval)
    this.interval = setInterval(() => {
      if(!this.store.jobs.isJobActive(this.slug) && !this.isSingle)
        this.LoadSeed()
    }, 15*60*1000)
  },
  timeUntilRefresh(){
    return this.timeSince(
            Date.now()
            -(
              this.store.jobs.getLastUpdate(this.slug)
              +this.refreshEvery-Date.now()
            )
    ) 
  },
  async LoadSeedJob(){
    this.relays = [...this.store.relays.getAll]

    const subid = `${crypto.randomBytes(20).toString('hex')}-seed`

    let relays = this.relays.filter( relay => !this.store.jobs.isProcessed(this.slug, relay) )  

    await new Promise(resolve => {

    this.pool = new RelayPool(['wss://history.nostr.watch'])
    this.pool
      .on('open', $relay => {
        $relay.subscribe(subid, {
          kinds:    [1411],
          limit:    1,
          "#e":     [this.store.prefs.region],
          authors:  ['b3b0d247f66bf40c4c9f4ce721abfe1fd3b7529fbc1ea5e64d5f0f8df3a4b6e6'],
        })
      })
      .on('event', async ($relay, sub_id, event) => {
        if(subid === sub_id){
          relays = JSON.parse(event.content).online
          relays.forEach( r => { 
            const result = {
              url: relay, 
              latency: {
                connect: r?.[1]? getAverageLatency(r?.[1]): null,
                read: r?.[2]? getAverageLatency(r?.[2]): null,
                write: r?.[3]? getAverageLatency(r?.[3]): null,
                data: r?.[2] || [],
                min: getMinLatency(r?.[2]),
                max: getMaxLatency(r?.[2]),
                average: getAverageLatency(r?.[2]),
                median: getMedianLatency(r?.[2]),
              }
            }
            result.check.connect = result.latency?.connect? true: false
            result.check.read = result.latency?.read? true: false
            result.check.write = result.latency?.write? true: false
            try {
              result.latency.overall = [
                getAverageLatency([
                  ...result.latency?.connect? result.latency.connect: [], 
                  ...result.latency?.data? result.latency.data: [], 
                  ...result.latency?.write? result.latency.write: [], 
                ])
              ]
            }
            catch(e){""}

            result.latency.average = result.latency.overall

            this.store.results.mergeDeep({ [result.url]: result })
            
            if(this.store.jobs.isProcessed(this.slug, result.url))
              return 

            this.store.jobs.addProcessed(this.slug, result.url)
          })
        }
      })
      .on('eose', async () => {
        // this.pool.unsubscribe(subid)
        this.closePool(this.pool)
        await new Promise( resolveDelay => setTimeout( resolveDelay, 1000 ) )
        resolve()
      })

    })
    this.store.jobs.completeJob(this.slug)
  },

}

export default defineComponent({
  name: 'LoadSeed',
  components: {},
  data() {
    return {
      slug: 'relays/seed2', //REMEMBER TO CHANGE!!!
      pool: null,
      untilNext: null,
      refreshEvery: 5*60*1000,
    }
  },
  setup(props){
    const {resultsProp: results} = toRefs(props)
    return { 
      store : setupStore(),
      results: results
    }
  },
  created(){
    clearInterval(this.interval)
  },
  unmounted(){
    clearInterval(this.interval)
    if(this.pool)
      this.closePool(this.pool)
  },
  beforeMount(){
    this.lastUpdate = this.store.jobs.getLastUpdate(this.slug)
    
    this.relays = [...this.store.relays.getAll]

    // for(let ri=0;ri-this.relays.length;ri++){
    //   const relay = this.relays[ri],
    //         cache = this.getCache(relay)
    //   this.store.results.get(relay) = cache
    // }
  },
  mounted(){
    if(this.isSingle) {
      this.slug = `relays/seed/${this.relayFromUrl}`
      this.LoadSeed(true, this.relayFromUrl)
    }  
    else {
      if(this.store.jobs.isJobActive(this.slug))
        this.LoadSeed(true)
      else
        this.LoadSeed()
    }

    if(!this.store.prefs.clientSideProcessing)
      this.setRefreshInterval()
  },
  updated(){},
  computed: Object.assign(SharedComputed, {
    timeSinceRefresh(){
      return this.timeSince(this.store.jobs.getLastUpdate(this.slug)) || Date.now()
    }
  }),
  methods: Object.assign(localMethods, RelayMethods),
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

