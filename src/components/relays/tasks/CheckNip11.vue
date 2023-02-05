<template>
  <span 
    v-if="this.store.tasks.getActiveSlug === taskSlug"
    class="text-white lg:text-sm mr-10 ml-2 mt-1.5 text-xs">
    <svg class="animate-spin mr-1 -mt-0.5 h-4 w-5 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </svg>
    <span>Checking NIP-11</span>
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
    if( (!this.isExpired(this.taskSlug, 24*60*60*1000) && !force) ) 
      return
    this.queueJob(
      this.taskSlug, 
      async () => {
        const relaysOnline = Object.keys(this.results).filter( relay => {
          return this.results[relay]?.check?.connect
        })
        const promises = []
        relaysOnline.forEach(relay => {
          const promise = new Promise( resolve => {
            const result = this.results[relay]
            if(result?.check?.connect) {
              const inspector = new Inspector(relay, {
                checkRead: false,
                checkWrite: false,
                checkLatency: false,
                checkAverageLatency: false,
                passiveNipTests: false,
                getInfo: true,
                getIdentities: false,
                run: true
              })
              inspector
                .on('complete', inspect => {
                  const res = inspect.result 
                  result.pubkeyValid = res.pubkeyValid 
                  result.pubkeyError = res.pubkeyError 
                  result.identities = res.identities
                  this.results[relay] = Object.assign(this.results[relay], result)
                  this.setCache(this.results[relay])
                  this.store.tasks.addProcessed(this.slug, relay)
                  resolve()
                })
                .on('error', ()=>{
                  resolve()
                })
            }
          }) 
          promises.push(promise)
        })
        await Promise.all(promises)
        this.store.tasks.completeJob()
      },
      true
    )
  },
  finish(clear){
    if(clear)
      clearTimeout(this.timeout)
    this.store.tasks.completeJob()
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
      taskSlug: 'relays/nip11' //REMEMBER TO CHANGE!!!
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
    clearInterval(this.interval)
  },
  unmounted(){
    clearInterval(this.interval)
  },
  beforeMount(){
    this.lastUpdate = this.store.tasks.getLastUpdate(this.taskSlug)
    this.untilNext = this.timeUntilRefresh()
    this.sinceLast = this.timeSinceRefresh()
  },
  mounted(){
    console.log('is processing', this.store.tasks.isProcessing(this.taskSlug))

    if(this.store.tasks.isProcessing(this.taskSlug))
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

