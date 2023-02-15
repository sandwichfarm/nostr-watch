<template>
  <span 
    v-if="this.store.jobs.getActiveSlug === slug"
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
  CheckP2R(force){
    if( (!this.isExpired(this.slug, 1) && !force) || this.isSingle ) 
      return  
    this.queueJob(
      this.slug, 
      async () => {
        const relays = this.store.relays.getRelays('paid', this.store.results.all)
        for(let i=0;i<relays.length;i++){
          const relay = relays[i],
                result = {}
          try {
            const hostname = new URL(this.store.results.get(relay).info.payments_url).hostname 
            if(hostname.includes('your-domain.com'))
              result.validP2R = false 
            else 
            result.validP2R = true 
          }
          catch(e){
            result.validP2R = false
          }
          this.store.results.mergeDeep({[relay]: result})
          this.store.jobs.addProcessed(this.slug, relay)
        }
        this.store.jobs.completeJob(this.slug)
      },
      true
    )
  },
  timeUntilRefresh(){
    return this.timeSince(Date.now()-(this.store.jobs.getLastUpdate(this.slug)+this.store.prefs.duration-Date.now())) 
  },
  timeSinceRefresh(){
    return this.timeSince(this.store.jobs.getLastUpdate(this.slug)) || Date.now()
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
    this.lastUpdate = this.store.jobs.getLastUpdate(this.slug)
    this.untilNext = this.timeUntilRefresh()
    this.sinceLast = this.timeSinceRefresh()
  },
  mounted(){    
    this.CheckP2R()
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