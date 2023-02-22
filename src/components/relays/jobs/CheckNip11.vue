<template>
  <span 
    v-if="this.store.jobs.getActiveSlug === slug"
    class="text-inherit">
  <span class="text-inherit">
    <span class="italic text-inherit ml-2 inline-block"> 
      <!-- md:pt-1.5 md:mt-0 -->
      <svg class="animate-spin mr-1 -mt-0.5 h-4 w-5 inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      validating pubkeys
    </span>
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

// import { Inspector } from 'nostr-relay-inspector'

const localMethods = {
  CheckNip11(force){ 
    if( !this.isExpired(this.slug, 24*60*60*1000) && !force )
      return
    this.queueJob(
      this.slug, 
      async () => {
        this.relays = this.store.relays.getAll
        this.relays.forEach( relay => {
          if(!this.store.results.get(relay))
            return
          this.store.results.mergeDeep( { [relay]: this.validatePubkey(relay) } )
        })
        this.store.jobs.completeJob(this.slug)
      },
      true
    )
  },
  validatePubkey(relay){
    const result = this.store.results.get(relay)

    if(!result?.info?.pubkey)
      return 

    result.pubkeyValid = false
    
    if(result.info.pubkey.startsWith('npub')) {
      result.pubkeyError = "pubkey is in npub format, should be hex"
      return result
    }
    if(!result.info.pubkey.match(/[0-9A-Fa-f]{6}/g)) {
      result.pubkeyError = "pubkey is not hex"
      return result
    }

    const pubkey = Uint8Array.from(Buffer.from(result.info.pubkey, 'hex'));
    if(pubkey.length !== 32){
      result.pubkeyError = 'pubkey is expected to be 32'
      return result
    }

    result.pubkeyValid = true

    return result
  },
  closeAll(){
    if(this.inspectors.length)
      this.inspectors.forEach( $inspector => $inspector.close() ) 
  },
}

export default defineComponent({
  name: 'CheckNip11',
  components: {},
  data() {
    return {
      slug: 'relays/nip11', //REMEMBER TO CHANGE!!!\
      relays: [],
      inspectors: [],
      interval: null,
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
    this.closeAll()
  },
  beforeMount(){
    this.relays = this.store.relays.getAll

    this.lastUpdate = this.store.jobs.getLastUpdate(this.slug)
  },
  async mounted(){
    if(this.store.jobs.isJobActive(this.slug))
      this.CheckNip11(true)
    else
      this.CheckNip11()
  },
  updated(){},
  computed: Object.assign(SharedComputed, {}),
  methods: Object.assign(localMethods, RelayMethods),
  props: {},
})
</script>

<style scoped>
 #refresh { font-size: 12pt; color:#666; margin-bottom:15px }
 #refresh button { cursor: pointer; border-radius: 3px; border: 1px solid #a0a0a0; color:#333 }
 #refresh button:hover {color:#000;}
 #refresh button[disabled] {color:#999 !important; border-color:#e0e0e0}
</style>

