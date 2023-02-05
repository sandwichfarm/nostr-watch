<template>
  <span 
    v-if="this.store.tasks.getActiveSlug === taskSlug"
    class="text-white lg:text-sm mr-2 ml-2 mt-1.5 text-xs">
    <span>Connecting to API...</span>
  </span>
</template>

<style scoped>

</style>

<script>
import { defineComponent, toRefs } from 'vue'

import { setupStore } from '@/store'

import RelayMethods from '@/shared/relays-lib.js'
import SharedComputed from '@/shared/computed.js'

const localMethods = {
  invalidate(force){
    if( (!this.isExpired(this.taskSlug, 60*1000) && !force) ) 
      return
    this.queueJob(
      this.taskSlug, 
      () => {
        this.timeout = setTimeout( () => {
          this.store.status.api = false
          this.finish()
        }, 5000)
        fetch(`https://api.nostr.watch/v1/online`)
          .then((response) => {
            this.store.status.api = response.ok
            this.finish(true)
          })
          .catch( () => { 
            this.store.status.api = false
            this.finish(true)
          })
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
      taskSlug: 'status/api' //REMEMBER TO CHANGE!!!
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

