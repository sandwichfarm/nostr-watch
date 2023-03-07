<template>
  <span 
    v-if="this.store.jobs.getActiveSlug === slug"
    class="text-inherit">
    <span v-if="!isSingle" class="text-inherit">
      <span class="text-inherit">
        <svg class="animate-spin mr-1 -mt-0.5 h-4 w-5 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        getting geo 
        <span v-if="this.store.prefs.runtimeGeo">
          {{ this.store.jobs.getProcessed(this.slug).length }}/{{ this.relays.length }}
        </span>
      </span>
    </span>
    <span v-if="isSingle" class="text-inherit">
      getting geo for {{ this.relay }}
    </span>
    
  </span> 
</template>

<style scoped>

</style>

<script>
import { defineComponent } from 'vue'

import { setupStore } from '@/store'

import RelayMethods from '@/shared/relays-lib.js'
import SharedComputed from '@/shared/computed.js'

import { getGeo, getPrebuiltGeo } from '@/utils'

const LocalMethods = {
  GeoJob(force, single){ 

    if( !this.isExpired(this.slug, 24*60*60*1000) && !force )
      return
    
    this.queueJob(
      this.slug, 
      async () => await this.jobGeo(single),
      true
    )

  },
  async jobGeo(single){
    if( !process.env.VUE_APP_IP_API_KEY || !this.store.prefs.runtimeGeo ){
      console.log('using prebuild geo')
      let geo = await getPrebuiltGeo()
      this.store.relays.geo = geo 
      return this.store.jobs.completeJob(this.slug)
    }
    if(single) {
      getGeo(single).then( geo => {
        if(!geo?.lat)
          return
        this.store.relays.geo = Object.assign(this.store.relays.geo, { [single]: geo } )
      })
    }
    else {
      this.relays = this.store.relays.getAll
      const relays = this.relays.filter( relay => !this.store.jobs.processed[this.slug]?.includes(relay))
      const relayChunks = this.chunk(100, relays)
      //console.log('chunks', )
      let promises = [],
          geoAcc = {}
      for(let c=0;c<relayChunks.length;c++) {
        console.log('geo', 'inside chunk loopp', c)
        const relays = relayChunks[c]
        relays.forEach( async (relay) => {
          const promise = new Promise( resolve => {
            getGeo(relay).then( geo => {
              if(!geo?.lat)
                return resolve()
              geoAcc[relay] = geo
              // console.log('geo for', relay)
              this.store.jobs.addProcessed(this.slug, relay)
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
    }
    this.store.jobs.completeJob(this.slug)
  },
  timeUntilRefresh(){
    return this.timeSince(Date.now()-(this.store.jobs.getLastUpdate(this.slug)+this.store.prefs.duration)) 
  },
  timeSinceRefresh(){
    return this.timeSince(this.store.jobs.getLastUpdate(this.slug)) || Date.now()
  },
}

export default defineComponent({
  name: 'CheckGeo',
  components: {},
  data() {
    return {
      slug: 'relays/geo',
      relays: this.store.relays.getAll,
      interval: null
    }
  },
  setup(){
    return { 
      store : setupStore(),
    }
  },
  created(){
  },
  unmounted(){
    clearInterval(this.interval)
  },
  beforeMount(){},
  mounted(){ 
    if(this.isSingle){
      this.slug = `relays/geo/${this.relayFromUrl}`
      this.GeoJob(true, this.relayFromUrl)
    }
    else if(this.store.jobs.isJobActive(this.slug))
      this.GeoJob(true)
    else
      this.GeoJob() 
  },
  updated(){},
  methods: Object.assign(RelayMethods, LocalMethods),
  computed: Object.assign(SharedComputed, {}),
  props: {},
})
</script>