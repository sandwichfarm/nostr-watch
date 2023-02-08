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
      Getting Geo {{ this.store.tasks.getProcessed(this.slug).length }}/{{ this.relays.length }}
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

import { getGeo } from '@/utils'

// import { Inspector } from 'nostr-relay-inspector'

const localMethods = {
  invalidate(force){ 
    
    if( !process.env.VUE_APP_IP_API_KEY )
      return 

    if( !this.isExpired(this.slug, 24*60*60*1000) && !force )
      return
      
    // alert('ok')
    this.queueJob(
      this.slug, 
      async () => {
        this.relays = this.store.relays.getAll.filter( relay => !this.store.tasks.processed[this.slug].includes(relay))
        const relayChunks = this.chunk(100, this.relays)
        console.log('chunks', )
        let promises = [],
            geoAcc = {}
        for(let c=0;c<relayChunks.length;c++) {
          
          const relays = relayChunks[c]
          relays.forEach( async (relay) => {
            const promise = new Promise( resolve => {
              getGeo(relay).then( geo => {
                if(!geo?.lat)
                  return resolve()
                geoAcc[relay] = geo
                this.store.tasks.addProcessed(this.slug, relay)
                resolve()
              })
            })
            promises.push(promise)
          })
          await Promise.all(promises)
          this.store.relays.geo = Object.assign(this.store.relays.geo, geoAcc)
          promises = []
          geoAcc = {}
        }
        this.store.tasks.completeJob(this.slug)
      },
      true
    )
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
      slug: 'relays/geo',
      relays: this.store.relays.getAll,
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
    clearInterval(this.interval)
  },
  beforeMount(){},
  mounted(){  
    this.invalidateTask()
    // this.interval = setInterval( this.invalidateTask, 1000 )
  },
  updated(){},
  methods: Object.assign(RelayMethods, localMethods),
  computed: Object.assign(SharedComputed, {
    getDynamicTimeout: function(){
      return this.averageLatency*this.relays.length
    },
  }),
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

