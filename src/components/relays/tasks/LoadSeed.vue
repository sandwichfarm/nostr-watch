<template>
  <span 
    v-if="this.store.tasks.getActiveSlug === slug"
    class="text-white lg:text-sm mr-2 ml-2 mt-1.5 text-xs">
    <span v-if="isSingle">Loading {{ relay }} from history node...</span>
    <span v-if="!isSingle">Loading data from history relay</span>
  </span>
  <span 
    v-if="(!store.tasks.isActive || this.store.tasks.getActiveSlug === slug) && !isSingle">
    <span class="text-white lg:text-sm mr-2 ml-2 text-xs mt-1.5 inline-block mr-10" v-if="store.prefs.refresh && !store.tasks.isProcessing(this.slug)"> 
      Next check in: {{ untilNext }}
    </span>
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
import { geo } from '../../../../cache/geo.yaml'

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
        let relays
        const onlineRelays = this.store.relays.getOnline
        if(onlineRelays)
          relays = [...onlineRelays, ...this.store.relays.getOffline]
        else 
          relays = this.store.relays.getAll
        const relayChunks = this.chunk(100, relays)
        const promises = []
        for (let i = 0; i < relayChunks.length; i++) {
          const promise = await new Promise( resolve => {
            const relayChunk = relayChunks[i]
            const pool = new RelayPool(['wss://history.nostr.watch'])
            const subid = `${crypto.randomBytes(40).toString('hex')}-${i}`
            pool
              .on('open', relay => {
                relay.subscribe(subid, {
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
                  this.results[relay] = Object.assign(this.results[relay] || {}, result)
                  this.setCache(result)
                }
              })
              .on('eose', () => {
                this.closePool(pool)
                resolve()
              })
          })
          promises.push(promise)
        }
        await Promise.all(promises)
        this.store.tasks.completeJob()
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
    return this.timeSince(Date.now()-(this.store.tasks.getLastUpdate(this.slug)+this.refreshEvery-Date.now())) 
  },
  timeSinceRefresh(){
    return this.timeSince(this.store.tasks.getLastUpdate(this.slug)) || Date.now()
  },
  chunk(chunkSize, array) {
    return array.reduce(function(previous, current) {
        var chunk;
        if (previous.length === 0 || 
                previous[previous.length -1].length === chunkSize) {
            chunk = [];
            previous.push(chunk);
        }
        else {
            chunk = previous[previous.length -1];
        }
        chunk.push(current);
        return previous;
    }, []); 
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
      refreshEvery: 15*60*1000
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
    this.pool = null
  },
  beforeMount(){
    this.lastUpdate = this.store.tasks.getLastUpdate(this.slug)
    this.untilNext = this.timeUntilRefresh()
    this.sinceLast = this.timeSinceRefresh()
    
    this.store.relays.setGeo(geo)
    this.relays = this.store.relays.getAll

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

