<template>
  <span 
    v-if="this.store.tasks.getActiveSlug === slug"
    class="">
  <span class="lg:text-sm mr-2 ml-2">
    <span v-if="!store.tasks.isProcessing(this.slug) && !isSingle" class="hidden lg:inline">Checked {{ sinceLast }} ago</span>
    <span v-if="store.tasks.isProcessing(this.slug) && !isSingle" class="italic lg:pr-9 text-white lg:text-sm mr-2 ml-2 block md:pt-1.5 md:mt-0 text-xs">
      <svg class="animate-spin mr-1 -mt-0.5 h-4 w-5 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      {{ this.store.tasks.getProcessed(this.slug).length }}/{{ this.relays.length }} Relays Loaded
    </span>
  </span>
  <span class="lg:text-sm mr-2 ml-2 hidden lg:inline" v-if="!store.tasks.isProcessing(this.slug)">-</span>
  <span class="lg:text-sm mr-2 ml-2" v-if="store.prefs.refresh && !store.tasks.isProcessing(this.slug)"> 
    Next check in: {{ untilNext }}
  </span>
  <!--<span v-if="isSingle">Loading {{ relay }} from history node...</span>
    <span v-if="!isSingle">Loading data from history relay</span>
  </span>
  <span 
    v-if="(!store.tasks.isActive || this.store.tasks.getActiveSlug === slug) && !isSingle">
    <span 
      v-if="store.prefs.refresh && !store.tasks.isProcessing(this.slug)" 
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

// import { Inspector } from 'nostr-relay-inspector'

const localMethods = {
  invalidate(force, single){
    // if( ( this.store.tasks.getLastUpdate('relays/check') || ( this.store.tasks.processed?.['relays/check'] && this.store.tasks.processed?.['relays/check'].length ) ) && !force ) 
    //   return
    if( !this.isExpired(this.slug, 15*60*1000) && !force ) 
      return
    
    this.queueJob(
      this.slug, 
      async () => {
        this.relays = [...this.store.relays.getAll]
        const relayChunks = this.chunk(250, this.relays)
        const promises = []
        for (let i = 0; i < relayChunks.length; i++) {
          const resultsChunk = {}
          const promise = await new Promise( resolve => {
            const relayChunk = relayChunks[i]
            const subid = `${crypto.randomBytes(40).toString('hex')}-${i}`
            let $relay
            this.pool = new RelayPool(['wss://history.nostr.watch'])
            this.pool
              .on('open', relay => {
                $relay = relay
                $relay.subscribe(subid, {
                  kinds:    [30303],
                  "#d":     single ? [ single ] : relayChunk,
                  authors:  ['b3b0d247f66bf40c4c9f4ce721abfe1fd3b7529fbc1ea5e64d5f0f8df3a4b6e6'],
                })
              })
              .on('event', async (relay, sub_id, event) => {
                if(subid === sub_id){
                  const relay = event.tags[0][1]
                  const data = JSON.parse(event.content)
                  const result = {
                    url: relay,
                    latency: data?.latency[this.store.prefs.region],
                    info: data.info,
                    uptime: this.getUptimePercentage(relay),
                    check: {
                      connect: false,
                      read: false,
                      write: false,
                      latency: data?.latency[this.store.prefs.region]?.final ? true : false,
                      averageLatency: data?.latency[this.store.prefs.region]?.average ? true : false
                    },
                  }

                  if(event?.tags){
                    const connect = event.tags.filter( tag => tag[0] == 'c'),
                          read = event.tags.filter( tag => tag[0] == 'r'),
                          write = event.tags.filter( tag => tag[0] == 'w')
                    result.check = {
                      connect: connect.length && connect[0][1] === 'true' ? true : false,
                      read: read.length && read[0][1] === 'true' ? true : false,
                      write: write.length && write[0][1] === 'true' ? true : false,
                    }
                  }

                  if(!this.results[relay]?.indentities)
                    result.identities = []
                
                  if(data.info?.pubkey)
                    result.identities.push(data.info?.pubkey)

                  if(data?.topics)
                    result.topics = data.topics.filter( topic => !this.store.prefs.ignoreTopics.split(',').includes(topic[0]) )
                    
                  result.aggregate = this.getAggregate(result)
                  resultsChunk[relay] = Object.assign(this.results[relay] || {}, result)
                  // const mergedResult = Object.assign(this.results[relay] || {}, result)
                  // this.results[relay] = mergedResult
                  // this.setCache(mergedResult)
                  if(this.store.tasks.isProcessed(this.slug, relay))
                    return 
                  this.store.tasks.addProcessed(this.slug, relay)
                }
              })
              .on('eose', async () => {
                // this.pool.unsubscribe(subid)
                this.closePool(this.pool)
                await new Promise( resolveDelay => setTimeout( resolveDelay, 1000 ) )
                resolve()
              })
          })
          promises.push(promise)
          Object.keys(resultsChunk).forEach( result => this.setCache(resultsChunk[result]) )
          this.results = Object.assign(this.results, resultsChunk)
          await new Promise( resolveDelay => setTimeout( resolveDelay, 500 ) ) 
          
        }
        await Promise.all(promises)
        this.store.tasks.completeJob(this.slug)
      },
      true
    )
  },
  setRefreshInterval: function(){
    clearInterval(this.interval)
    this.interval = setInterval(() => {
      this.lastUpdate = this.store.tasks.getLastUpdate(this.slug)
      this.untilNext = this.timeUntilRefresh()
      this.sinceLast = this.timeSinceRefresh()
      if(!this.store.tasks.isProcessing(this.slug) && !this.isSingle)
        this.invalidate()
    }, 15*60*1000)
  },
  timeUntilRefresh(){
    console.log(
      'timeuntil', 
      Date.now()-(this.store.tasks.getLastUpdate(this.slug)+this.refreshEvery), 
      this.store.tasks.getLastUpdate(this.slug),

      this.timeSince(Date.now()-(this.store.tasks.getLastUpdate(this.slug)+this.refreshEvery-Date.now()))
    )
    return this.timeSince(
            Date.now()
            -(
              this.store.tasks.getLastUpdate(this.slug)
              +this.refreshEvery-Date.now()
            )
    ) 
  },
  timeSinceRefresh(){
    return this.timeSince(this.store.tasks.getLastUpdate(this.slug)) || Date.now()
  }
}

export default defineComponent({
  name: 'LoadSeed',
  components: {},
  data() {
    return {
      slug: 'relays/seed', //REMEMBER TO CHANGE!!!
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
    this.lastUpdate = this.store.tasks.getLastUpdate(this.slug)
    this.untilNext = this.timeUntilRefresh()
    this.sinceLast = this.timeSinceRefresh()
    
    this.relays = [...this.store.relays.getAll]

    for(let ri=0;ri-this.relays.length;ri++){
      const relay = this.relays[ri],
            cache = this.getCache(relay)
      this.results[relay] = cache
    }
  },
  mounted(){
    if(this.isSingle) {
      this.slug = 'relays/${this.relayFromUrl}'
      this.invalidate(true, this.relayFromUrl)
    }  
    else {
      if(this.store.tasks.isProcessing(this.slug))
        this.invalidate(true)
      else
        this.invalidate()
    }

    if(!this.store.prefs.clientSideProcessing)
      this.setRefreshInterval()
  },
  updated(){},
  computed: Object.assign(SharedComputed, {
    getDynamicTimeout: function(){
      return this.averageLatency*this.relays.length
    },
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

