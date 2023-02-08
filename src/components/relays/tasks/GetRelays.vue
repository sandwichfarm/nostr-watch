<template>
  <span 
    v-if="this.store.tasks.getActiveSlug === slug"
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
  invalidate(force){
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
                this.finish(relays, true)
                return
              }
              response.json()
                .then( json => {
                  this.store.relays.urlsOnline = json
                  this.store.relays.addRelays(json)
                  this.finish(json, true)
                })
                .catch( () => {
                  this.finish(relays, true)
                })
            })
            .catch( () => { 
              this.finish(relays, true)
            })
        }
      },
      true
    )
  },
  finish(relays, clear){
    this.store.relays.addRelays(relays)
    if(clear)
      clearTimeout(this.timeout)
    
    this.store.tasks.completeJob(this.slug)
  },
  timeUntilRefresh(){
    return this.timeSince(Date.now()-(this.store.tasks.getLastUpdate(this.slug)+this.store.prefs.duration-Date.now())) 
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
      slug: 'relays/get' //REMEMBER TO CHANGE!!!
    }
  },
  setup(props){
    const {resultsProp: results} = toRefs(props)
    return { 
      store : setupStore(),
      results: results,
      timeout: null
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
    //console.log('is processing', this.store.tasks.isProcessing(this.slug))

    if(this.store.tasks.isProcessing(this.slug))
      this.invalidate(true)
    else
      this.invalidate()

    setTimeout( ()=>{}, 1)
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

