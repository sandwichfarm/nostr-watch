<template>
  <span 
    v-if="this.store.jobs.getActiveSlug === slug"
    class="text-inherit">
  <span class="text-inherit">
    <span v-if="!store.jobs.isJobActive(this.slug) && !isSingle" class="hidden text-inherit">
      checked {{ sinceLast }} ago
    </span>
    <span v-if="store.jobs.isJobActive(this.slug) && !isSingle" class="italic text-inherit ml-2 inline-block">
      <svg class="animate-spin mr-1 -mt-0.5 h-4 w-5 inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      {{ this.store.jobs.getProcessed(this.slug).length }}/{{ this.relays.length }} loaded
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

// import { Inspector } from 'nostr-relay-inspector'

const localMethods = {
  LoadSeed(force, single){
    // if( ( this.store.jobs.getLastUpdate('relays/check') || ( this.store.jobs.processed?.['relays/check'] && this.store.jobs.processed?.['relays/check'].length ) ) && !force ) 
    //   return
    if( (!this.isExpired(this.slug, 15*60*1000) && !force) && !this.isSingle ) 
      return
    
    this.queueJob(
      this.slug, 
      async () => {
        this.getFromHistory(single)
      },
      true
    )
  },
  setRefreshInterval: function(){
    clearInterval(this.interval)
    this.interval = setInterval(() => {
      this.lastUpdate = this.store.jobs.getLastUpdate(this.slug)
      this.untilNext = this.timeUntilRefresh()
      this.sinceLast = this.timeSinceRefresh()
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
  async getFromHistory(single){
    this.relays = [...this.store.relays.getAll]
    const relays = this.relays.filter( relay => !this.store.jobs.isProcessed(this.slug, relay) )
    let relayChunks = this.chunk(250, relays),
        resultsChunk = {}
    const promises = []
    for (let i = 0; i < relayChunks.length; i++) {
      
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
              // const topics = event?.tags.filter( tag => tag[0] === 't' && tag[1] !== 'relay:read' && tag[1] !== 'relay:write' && tag[1] !== 'relay:online').map( topic => topic[1] )
              const topics = event?.tags.filter( tag => tag[0] === 't' && tag[1] !== 'relay:read' && tag[1] !== 'relay:write' && tag[1] !== 'relay:online')
              const result = {
                url: relay,
                
                check: {
                  connect: false,
                  read: false,
                  write: false,
                  latency: data?.latency[this.store.prefs.region]?.final ? true : false,
                  averageLatency: data?.latency[this.store.prefs.region]?.average ? true : false
                },
              }

              // if(uptimeLatency)
              result.uptime = this.getUptimePercentage(relay)
              
              if(data?.info)
                result.info = data.info
              
              // if(data?.latency[this.store.prefs.region]) //this one will create the illusion that everything is ok, TODO: Fix daemons and remove.
              result.latency = data?.latency[this.store.prefs.region] 

              if(event?.tags){
                const connect = event.tags.filter( tag => tag[0] == 'online'),
                      read = event.tags.filter( tag => tag[0] == 'read'),
                      write = event.tags.filter( tag => tag[0] == 'write')
                
                // if( connect[0][1] === 'true' && read[0][1] === 'true' && write[0][1] === 'false')
                //   console.log(result.url, 'is restricted')

                result.check = {
                  connect: connect.length && connect[0][1] === 'true' ? true : false,
                  read: read.length && read[0][1] === 'true' ? true : false,
                  write: write.length && write[0][1] === 'true' ? true : false,
                }
              }                  

              if(topics.length)
                result.topics = this.cleanTopics(topics)

              console.log('aggr', this.result.url, this.getAggregate(result), result.check.connect, result.check.read, result.check.write)
              
              result.aggregate = this.getAggregate(result)

              resultsChunk[relay] = result

              if(this.store.jobs.isProcessed(this.slug, relay))
                return 
              this.store.jobs.addProcessed(this.slug, relay)
            }
          })
          .on('eose', async () => {
            // this.pool.unsubscribe(subid)
            this.closePool(this.pool)
            await new Promise( resolveDelay => setTimeout( resolveDelay, 1000 ) )
            resolve()
          })
      })
      console.log('results chunk', Object.keys(resultsChunk).length)
      promises.push(promise)
      this.store.results.mergeLeft(resultsChunk)
      await new Promise( resolveDelay => setTimeout( resolveDelay, 500 ) ) 
    }
    await Promise.all(promises)
    
    this.store.jobs.completeJob(this.slug)
    relayChunks = null
  },
  async checkOffline(){

  },
  timeSinceRefresh(){
    return this.timeSince(this.store.jobs.getLastUpdate(this.slug)) || Date.now()
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
    this.lastUpdate = this.store.jobs.getLastUpdate(this.slug)
    this.untilNext = this.timeUntilRefresh()
    this.sinceLast = this.timeSinceRefresh()
    
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
  computed: Object.assign(SharedComputed, {}),
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

