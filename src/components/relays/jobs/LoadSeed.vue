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
      <!-- processing -->
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

import { getAverageLatency, getMedianLatency, getMinLatency, getMaxLatency, RelayCheckerResult } from 'nostrwatch-js'

const localMethods = {
  LoadSeed(force, single){
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
    const resultsChunk = new Object()
    await new Promise( resolve => {
      const subid = `${crypto.randomBytes(20).toString('hex')}`
      let   $relay

      this.pool = new RelayPool(['wss://history.nostr.watch'])
      this.pool
        .on('open', relay => {
          $relay = relay
          $relay.subscribe(subid, {
            kinds:    [30304],
            since:    Math.round( (Date.now()-2*60*60*1000) / 1000 ),
            authors:  ['b3b0d247f66bf40c4c9f4ce721abfe1fd3b7529fbc1ea5e64d5f0f8df3a4b6e6'],
            limit: 1000
          })
        })
        .on('event', async ($relay, sub_id, event) => {
          if(subid !== sub_id)
            return
            
          const relay = event.tags[0][1]

          if(!this.store.relays.has(relay))
            this.store.relays.add(relay)

          const data = JSON.parse(event.content)
          // const topics = event?.tags.filter( tag => tag[0] === 't' && tag[1] !== 'relay:read' && tag[1] !== 'relay:write' && tag[1] !== 'relay:online').map( topic => topic[1] )
          let topics = event?.tags.filter( tag => tag[0] === 't' && tag[1] !== 'relay:read' && tag[1] !== 'relay:write' && tag[1] !== 'relay:online').map( topicTag => [ topicTag[1]?.toLowerCase(), topicTag[2] ] )
              topics = Array.from(new Set(topics))              
          const result = {
            url: relay,
            
            check: {
              connect: null,
              read: null,
              write: null,
              latency: data?.latency[this.store.prefs.region]?.final ? true : false,
              averageLatency: data?.latency[this.store.prefs.region]?.average ? true : false
            },
          }

          result.uptime = this.getUptimePercentage(relay)
          
          if(data?.info)
            result.info = data.info

          const regionLatency = data?.latency?.[this.store.prefs.region]

          result.latency = {
            average: regionLatency?.[1] ? getAverageLatency(regionLatency[1]) : null,
            median: regionLatency?.[1] ? getMedianLatency(regionLatency[1]) : null,
            min: regionLatency?.[1] ? getMinLatency(regionLatency[1]) : null,
            max: regionLatency?.[1] ? getMaxLatency(regionLatency[1]) : null,
            data: regionLatency?.[1] || [],
            connect: regionLatency?.[0] || [],
            read: regionLatency?.[1] || [],
            write: regionLatency?.[2] || [],
          }

          try {
            result.latency.overall = [
              getAverageLatency([
                ...result.latency?.connect, 
                ...result.latency?.data, 
                ...result.latency?.write, 
              ])
            ]
          }
          catch(e){""}

          result.latency.average = result.latency.overall

          result.check.connect = true

          if(event?.tags){
            // const connect = event.tags.filter( tag => tag[0] == 'online'),
            const read = event.tags.filter( tag => tag[0] == 'read'),
                  write = event.tags.filter( tag => tag[0] == 'write')
            result.check.read = read?.[0]?.[1] === 'true' ? true : false
            result.check.write = write?.[0]?.[1] === 'true' ? true : false
          }

          if(topics.length)
            result.topics = this.removeIgnoredTopics(topics)
          
          result.aggregate = this.getAggregate(result)

          if(result?.info?.limitation?.payment_required && !this.isLoggedIn){
            result.aggregate = 'restricted'
            result.check.write = false 
            console.log('should be restricted', result.aggregate, result.check.write)
          }

          // this.store.results.mergeDeep({ [relay]: result })

          resultsChunk[relay] = result

          if(this.store.jobs.isProcessed(this.slug, relay))
            return 

          this.store.jobs.addProcessed(this.slug, relay)
        })
        .on('eose', async () => {
          // this.pool.unsubscribe(subid)
          this.store.results.mergeDeep(resultsChunk)
          this.closePool(this.pool)
          await new Promise( resolveDelay => setTimeout( resolveDelay, 1000 ) )
          resolve()
        })
    })

    if(Object.keys(resultsChunk)?.length)
      this.checkOffline()

    this.store.jobs.completeJob(this.slug)
  },
  async checkOffline(){
    const offline = this.store.relays.getAll.filter( relay => !this.store.jobs.processed?.[this.slug]?.includes(relay))

    offline.forEach( relay => {
      const result = structuredClone(RelayCheckerResult)
      result.url = relay
      result.state = 'complete'
      result.aggregate = 'offline'
      this.store.results.set(result)
    })
  },
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
    this.relays = [...this.store.relays.getAll]
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

