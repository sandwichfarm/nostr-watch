<template>
  <span 
      v-if="this.store.jobs.getActiveSlug === slug"
      class="text-white lg:text-sm mr-2 ml-2 mt-1.5 text-xs">
    <span>Retrieving operator profiles...</span>
  </span>
</template>

<style scoped>

</style>

<script>
import { defineComponent } from 'vue'

import crypto from 'crypto'

import { setupStore } from '@/store'

import { RelayPool } from 'nostr'

import SharedMethods from '@/shared/relays-lib.js'
import SharedComputed from '@/shared/computed.js'

const localMethods = {
  RelayOperatorJob(force){
    if( !this.isExpired(this.slug, 1000) && !force ) 
      return

    if( !this.result?.info?.pubkey || typeof this.result.info.pubkey !== 'string' )
      return 

    this.queueJob(
      this.slug,
      () => {
        const pool = new RelayPool([this.relay]),
              subid = crypto.randomBytes(20).toString('hex')
        pool
          .on('open', relay => {
            relay.subscribe(`${subid}-0`, { limit:1, kinds:[0], authors:[this.result.info.pubkey] })
            relay.subscribe(`${subid}-1`, { limit:10, kinds:[1], authors:[this.result.info.pubkey] })
          })
          .on('event', (relay, sub_id, event) => {
            if(subid === `${subid}-0`){
              this.store.profile.setProfile(JSON.parse(event.content)).catch()
            }
            if(subid === `${subid}-1`){
              this.events[event.kind][event.id] = event
            }
            // if(subid === `${subid}-7`){}
          })
        this.store.jobs.completeJob(this.slug)
      },
      true 
    )
  },
}

export default defineComponent({
  name: 'RelayOperatorJob',
  components: {},
  data() {
    return {
      slug: 'relays/detail/operator'
    }
  },
  setup(){
    return { 
      store : setupStore(),
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
    
    this.relays = this.store.relays.all
  },
  mounted(){
    //console.log('job', this.slug, 'is processing:', this.store.jobs.isJobActive(this.slug))
    this.RelayOperatorJob()
  },
  updated(){},
  computed: Object.assign(SharedComputed, {}),
  methods: Object.assign(localMethods, SharedMethods),
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

