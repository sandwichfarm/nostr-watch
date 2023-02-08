<template>
  <span 
    v-if="this.store.tasks.getActiveSlug === slug"
    class="text-white lg:text-sm mr-2 ml-2 mt-1.5 text-xs">
    <span v-if="!isSingle">Loading trending topics...</span>
  </span>
</template>

<script>
import { defineComponent, toRefs } from 'vue'
import crypto from 'crypto'

import { setupStore } from '@/store'

import RelayMethods from '@/shared/relays-lib.js'
import SharedComputed from '@/shared/computed.js'

// import { relays } from '../../../../relays.yaml'

import { RelayPool } from 'nostr'

const localMethods = {
  invalidate(force, single){
    if( !this.store.prefs.clientSideProcessing ) 
      return
    if( !this.isExpired(this.slug, 15*60*1000) && !force ) 
      return
    
    this.queueJob(
      this.slug, 
      async () => {
        const relaysOnline = Object.keys(this.results).filter( relay => {
          return this.results[relay]?.check?.connect
        })
        const relayChunks = this.chunk(100, [...relaysOnline])
        const promises = []
        for (let i = 0; i < relayChunks.length; i++) {
          const promise = await new Promise( resolve => {
            const timeout = setTimeout(resolve, 10*1000)
            const relayChunk = relayChunks[i]
            this.pool = new RelayPool(['wss://history.nostr.watch'], { reconnect: false })
            const subid = `${crypto.randomBytes(40).toString('hex')}-${i}`
            this.pool
              .on('open', relay => {
                relay.subscribe(subid, {
                  kinds:    [30303],
                  "#d":     single ? [ single ] : relayChunk,
                  authors:  ['b3b0d247f66bf40c4c9f4ce721abfe1fd3b7529fbc1ea5e64d5f0f8df3a4b6e6'],
                })
              })
              .on('event', async (r, sub_id, event) => {
                if(subid === sub_id){
                  const relay = event.tags[0][1]
                  const data = JSON.parse(event.content)
                  
                  if(data?.topics)
                    this.results[relay].topics = data.topics.filter( topic => !this.store.prefs.ignoreTopics.split(',').includes(topic[0]) )

                  this.setCache(this.results[relay])
                }
              })
              .on('eose', () => {
                try{
                  // pool.unsubscribe(subid)
                  this.closePool(this.pool)
                } catch(e){""}
                
                resolve()
                clearTimeout(timeout)
              })
            promises.push(promise)
          })
         
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
      if(!this.store.tasks.isProcessing(this.slug) && !this.isSingle)
        this.invalidate()
    }, 60*60*1000)
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
      slug: 'relays/topics', //REMEMBER TO CHANGE!!!
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
    this.closePool(this.pool)
  },
  beforeMount(){
    this.relays = this.store.relays.getAll
  },
  mounted(){
    if(this.isSingle) {
      this.invalidate(true, this.relayFromUrl)
    }  
    else {
      if(this.store.tasks.isTaskActive(this.slug))
        this.invalidate(true)
      else
        this.invalidate()
    }

    if(this.store.prefs.clientSideProcessing)
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