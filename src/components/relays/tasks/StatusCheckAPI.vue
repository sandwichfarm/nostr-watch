<template>
  <span 
    v-if="this.store.tasks.getActiveSlug === slug"
    class="text-inherit">
    <span class="text-inherit">connecting to api</span>
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
    if( (!this.isExpired(this.slug, 60*1000) && !force) ) 
      return
    this.queueJob(
      this.slug, 
      () => {
        this.timeout = setTimeout( () => {
          this.store.status.api = false
          this.finish()
        }, 5000)
        fetch(`https://api.nostr.watch/v1/online`)
          .then((response) => {
            this.store.status.api = response.ok ? true : false
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
    this.store.tasks.completeJob(this.slug)
    if(clear)
      clearTimeout(this.timeout)
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
      slug: 'status/api' //REMEMBER TO CHANGE!!!
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
    this.lastUpdate = this.store.tasks.getLastUpdate(this.slug)
    this.untilNext = this.timeUntilRefresh()
    this.sinceLast = this.timeSinceRefresh()
  },
  mounted(){
    //console.log('is processing', this.store.tasks.isTaskActive(this.slug))

    this.invalidateTask()
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

<style scoped>
 #refresh { font-size: 12pt; color:#666; margin-bottom:15px }
 #refresh button { cursor: pointer; border-radius: 3px; border: 1px solid #a0a0a0; color:#333 }
 #refresh button:hover {color:#000;}
 #refresh button[disabled] {color:#999 !important; border-color:#e0e0e0}
</style>

