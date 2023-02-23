<template>
  <span 
    v-if="this.store.jobs.getActiveSlug === slug"
    class="text-inherit">
    <span class="text-inherit" v-if="!isSingle">loading relay topics</span>
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

const LocalMethods = {
  GetTopics(force, single){

    if( !this.store.prefs.clientSideProcessing ) 
      return

    if( !this.isExpired(this.slug, 15*60*1000) && !force ) 
      return
      
    this.queueJob(
      this.slug, 
      async () => {
        const relaysOnline = Object.keys(this.store.results.all).filter( relay => {
          return this.store.results.get(relay)?.check?.connect
        })
        const relayChunks = this.chunk(100, [...relaysOnline])
        let   promises = [],
              chunkResults = {}
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
                  const relay = event.tags.filter( tag => 'd' === tag[0])?.[0]
                  let topics = event?.tags.filter( tag => tag[0] === 't' && tag[1] !== 'relay:read' && tag[1] !== 'relay:write' && tag[1] !== 'relay:online').map( topicTag => [ topicTag[1]?.toLowerCase(), topicTag[2] ] )
                  topics = Array.from(new Set(topics))
                  chunkResults[relay] = {}
                  // console.log(relay, this.removeIgnoredTopics(topics))
                  if(topics && topics.length)
                    chunkResults[relay].topics = this.removeIgnoredTopics(topics)
                }
              })
              .on('eose', () => {
                try{
                  // pool.unsubscribe(subid)
                  if(this.pool)
                    this.closePool(this.pool)
                } catch(e){""}
                
                resolve()
                clearTimeout(timeout)
              })
            
          })
          promises.push(promise) 
          await Promise.all(promises)
          this.store.results.mergeDeep(chunkResults)
          promises = []
        }
        this.store.jobs.completeJob(this.slug)
      },
      true
    )
  },
  setRefreshInterval: function(){
    clearInterval(this.interval)
    this.interval = setInterval(() => {
      if(!this.store.jobs.isJobActive(this.slug) && !this.isSingle){
        //console.log('ok?')
        this.GetTopics()
      }
    }, 1000)
  },
  timeUntilRefresh(){
    return this.timeSince(Date.now()-(this.store.jobs.getLastUpdate(this.slug)+this.refreshEvery-Date.now())) 
  },
  timeSinceRefresh(){
    return this.timeSince(this.store.jobs.getLastUpdate(this.slug)) || Date.now()
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
  name: 'GetTopics',
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
    if(this.pool)
      this.closePool(this.pool)
  },
  beforeMount(){
    this.relays = this.store.relays.getAll
  },
  mounted(){
    if(this.isSingle) {
      this.GetTopics(true, this.relayFromUrl)
    }  
    else {
      if(this.store.jobs.isJobActive(this.slug))
        this.GetTopics(true)
      else
        this.GetTopics()
    }

    if(this.store.prefs.clientSideProcessing)
      this.setRefreshInterval()
  },
  updated(){},
  computed: Object.assign(SharedComputed, {}),
  methods: Object.assign(LocalMethods, RelayMethods),
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