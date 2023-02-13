<template>
  <span 
    v-if="this.store.tasks.getActiveSlug === slug"
    class="text-inherit">
    <span class="text-inherit" v-if="this.store.prefs.discoverRelays">checking pay-to-relay</span>
  </span>
</template>

<script>
import { defineComponent, toRefs } from 'vue'

import { setupStore } from '@/store'

import RelayMethods from '@/shared/relays-lib.js'
import SharedComputed from '@/shared/computed.js'

const localMethods = {
  invalidateP2R(force){
    const self = this
    if( (!this.isExpired(self.slug, 1) && !force) || self.isSingle ) 
      return
    this.queueJob(
      self.slug, 
      async () => {
        const relays = self.store.relays.getRelays('paid', self.results)
        for(let i=0;i<relays.length;i++){
          const relay = relays[i]
          try {
            const hostname = new URL(this.results[relay].info.payments_url).hostname 
            if(hostname.includes('your-domain.com'))
              this.results[relay].validP2R = false 
            else 
            this.results[relay].validP2R = true 
          }
          catch(e){
            this.results[relay].validP2R = false 
          }
          this.setCache(this.results[relay])
        }
        
        this.store.tasks.completeJob(self.slug)
      },
      true
    )
  },
  timeUntilRefresh(){
    return this.timeSince(Date.now()-(this.store.tasks.getLastUpdate(this.slug)+this.store.prefs.duration-Date.now())) 
  },
  timeSinceRefresh(){
    return this.timeSince(this.store.tasks.getLastUpdate(this.slug)) || Date.now()
  },
}

export default defineComponent({
  name: 'CheckP2R',
  components: {},
  data() {
    return {
      slug: 'relays/check/p2r', //REMEMBER TO CHANGE!!!
      timeout: null
    }
  },
  setup(props){
    const {resultsProp: results} = toRefs(props)
    return { 
      store : setupStore(),
      results: results,
    }
  },
  created(){
    clearInterval(this.interval)
  },
  unmounted(){
    clearInterval(this.interval)
  },
  beforeMount(){
    this.lastUpdate = this.store.tasks.getLastUpdate(this.slug)
    this.untilNext = this.timeUntilRefresh()
    this.sinceLast = this.timeSinceRefresh()
  },
  mounted(){    
    this.invalidateP2R()
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