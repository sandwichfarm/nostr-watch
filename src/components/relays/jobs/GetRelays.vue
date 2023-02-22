<template>
  <span 
    v-if="this.store.jobs.getActiveSlug === slug"
    class="text-inherit">
    <span class="text-inherit" v-if="this.store.prefs.discoverRelays">finding new relays</span>
  </span>
</template>

<style scoped>

</style>

<script>
import { defineComponent, toRefs } from 'vue'

import { setupStore } from '@/store'

import RelayMethods from '@/shared/relays-lib.js'
import SharedComputed from '@/shared/computed.js'

import { relays } from '../../../../relays.yaml'

const localMethods = {
  GetRelays(force){
    if( (!this.isExpired(this.slug, 60*1000) && !force) ) 
      return
    this.queueJob(
      this.slug, 
      () => {
        if(!this.store.prefs.discoverRelays) {
          this.finish(relays)
        } 
        else {
          // const currentRelaysCount = this.store.relays.getAll.lengtth
          this.timeout = setTimeout( () => {
            this.store.status.api = false
            this.finish(relays)
          }, 5000)
          fetch(`https://api.nostr.watch/v1/online`)
            .then((response) => {
              if (!response.ok) {
                this.store.status.api = false
                this.finish(relays, true)
                return
              }
              response.json()
                .then( json => {
                  this.store.status.api = true
                  this.store.relays.urlsOnline = json
                  this.finish([...json, ...relays], true)
                })
                .catch( () => {
                  this.store.status.api = false
                  this.finish(relays, true)
                })
            })
            .catch( () => { 
              this.store.status.api = false
              this.finish(relays, true)
            })
        }
      },
      true
    )
  },
  finish(_relays, clear){
    
    const newRelays = this.store.relays.addRelays(_relays)

    if(newRelays.length)
      newRelays.forEach( relay => {
        console.log('new relay!', relay)
        // this.queueJob(
        //   slug, 
        //   async () => await this.checkSingle(result.url, slug), 
        //   true
        // )
      })

    this.relays = this.store.relays.getAll

    if(clear)
      clearTimeout(this.timeout)
    
    this.store.jobs.completeJob(this.slug)
  },
}

export default defineComponent({
  name: 'GetRelays',
  components: {},
  data() {
    return {
      slug: 'relays/get', //REMEMBER TO CHANGE!!!
      timeout: null
    }
  },
  setup(props){
    const {relaysProp: relays} = toRefs(props)
    return { 
      store : setupStore(),
      relays: relays
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
  },
  mounted(){
    if(this.store.jobs.isJobActive(this.slug))
      this.GetRelays(true)
    else
      this.GetRelays()
  },
  updated(){},
  computed: Object.assign(SharedComputed, {}),
  methods: Object.assign(localMethods, RelayMethods),
  props: {
    relaysProp: {
      type: Array,
      default(){
        return []
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

