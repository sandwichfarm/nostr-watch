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
      Getting Geodata
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
    if( !this.isExpired(this.slug, 1) && !force )
      return
    this.queueJob(
      this.slug, 
      async () => {
        this.relays = this.store.relays.getAll()
        for(let relay in this.relays){
          this.store.relays.geo[relay] = await getGeo(relay)
        }
        this.store.tasks.completeJob()
      },
      true
    )
  },
  validatePubkey(relay){
    if(!this.results?.[relay]?.info?.pubkey)
      return 

    this.results[relay].pubkeyValid = false
    
    if(this.results[relay].info.pubkey.startsWith('npub')) {
      this.results[relay].pubkeyError = "pubkey is in npub format, should be hex"
      return
    }
    if(!this.results[relay].info.pubkey.match(/[0-9A-Fa-f]{6}/g)) {
      this.results[relay].pubkeyError = "pubkey is not hex"
      return
    }
    const pubkey = Uint8Array.from(Buffer.from(this.results[relay].info.pubkey, 'hex'));
    if(pubkey.length !== 32){
      this.results[relay].pubkeyError = 'pubkey is expected to be 32'
      return
    }
    this.results[relay].pubkeyValid = true
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
      slug: 'relays/geo', //REMEMBER TO CHANGE!!!\
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

