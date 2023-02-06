<template>
  <span 
    v-if="this.store.tasks.getActiveSlug === slug"
    class="text-white text-sm lg:text-sm mx-2 mt-1.5">
  <span class="text-white mr-2 ml-2">
    <span class="italic lg:pr-9 text-white  mr-2 ml-2 block md:pt-1.5 md:mt-0">
      <svg class="animate-spin mr-1 -mt-0.5 h-4 w-5 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      {{ this.store.tasks.getProcessed(this.slug).length }}/{{ this.relays.length }} NIPs checked
    </span>
  </span>
  </span> 
</template>

<style scoped>

</style>

<script>
import { defineComponent, toRefs } from 'vue'

import { setupStore } from '@/store'

import RelayMethods from '@/shared/relays-lib.js'
import SharedComputed from '@/shared/computed.js'

import { Inspector } from 'nostr-relay-inspector'

const localMethods = {
  invalidate(force){ 
    if( !this.isExpired(this.slug, 24*60*60*1000) && !force )
      return
    this.queueJob(
      this.slug, 
      async () => {
        const chunkSize = 10
        this.relays = this.getRelays( this.store.relays.getAll )
        let processRelays =  this.relays.filter( relay => !this.store.tasks.processed[this.slug].includes(relay) )
        const relayChunks = this.chunk(chunkSize, processRelays)
        for (let i = 0; i < relayChunks.length; i++) {
          await new Promise( resolveChunk => {
            const relayChunk = relayChunks[i]
            let total = relayChunk.length, 
                completed = 0
            relayChunk.forEach( async (relay) => {  
              const inspector = new Inspector(relay, {
                checkRead: false,
                checkWrite: false,
                checkLatency: false,
                checkAverageLatency: false,
                passiveNipTests: false,
                getInfo: true,
                getIdentities: false,
                run: true,
                connectTimeout: 2*1000
              })
              .on('complete', async (inspect) => {
                let result = {}
                if(!inspect?.result)
                  return
                const res = {}
                result.pubkeyValid = res?.pubkeyValid 
                result.pubkeyError = res?.pubkeyError 
                result.identities = res?.identities
                result = Object.assign(result, this.results[relay])
                this.results[relay] = result
                this.setCache(this.results[relay])
                this.store.tasks.addProcessed(this.slug, relay)
                completed++
                // console.log(`chunk ${i}`, 'completed', completed === total, completed, total )
                if(completed === total)
                  resolveChunk()
                inspect.close()
              })
              .on('error', ()=>{
                completed++
                // console.log(`chunk ${i}`, 'completed', completed === total, completed, total )
                this.store.tasks.addProcessed(this.slug, relay)
                if(completed === total)
                  resolveChunk()
              })
              this.inspectors.push(inspector)
            })
          })
          await new Promise( resolveDelay => setTimeout( resolveDelay, 555 ))
        }
        this.store.tasks.completeJob()
        this.closeAll()
      },
      true
    )
  },
  closeAll(){
    if(this.inspectors.length)
      this.inspectors.forEach( $inspector => $inspector.close() ) 
  },
  timeUntilRefresh(){
    return this.timeSince(Date.now()-(this.store.tasks.getLastUpdate(this.slug)+this.store.prefs.duration)) 
  },
  timeSinceRefresh(){
    return this.timeSince(this.store.tasks.getLastUpdate(this.slug)) || Date.now()
  },
}

export default defineComponent({
  name: 'StatusCheckHistoryNode',
  components: {},
  data() {
    return {
      slug: 'relays/nip11', //REMEMBER TO CHANGE!!!\
      relays: [],
      inspectors: [],
      interval: null
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
  },
  unmounted(){
    this.closeAll()
  },
  beforeMount(){
    this.relays = this.store.relays.getAll

    this.lastUpdate = this.store.tasks.getLastUpdate(this.slug)
    this.untilNext = this.timeUntilRefresh()
    this.sinceLast = this.timeSinceRefresh()
  },
  async mounted(){
    await new Promise( delay => setTimeout( delay, 1) )

    console.log('is processing', this.store.tasks.isProcessing(this.slug))

    if(this.store.tasks.isProcessing(this.slug))
      this.invalidate(true)
    else
      this.invalidate()

    
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

