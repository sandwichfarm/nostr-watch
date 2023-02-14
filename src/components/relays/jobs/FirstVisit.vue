<template>
  <span 
    v-if="this.store.jobs.getActiveSlug === slug"
    class="text-inherit">
    <span class="text-inherit">Welcome</span>
  </span>
</template>

<style scoped>

</style>

<script>
import { defineComponent } from 'vue'

import { setupStore } from '@/store'

import RelayMethods from '@/shared/relays-lib.js'

import SharedComputed from '@/shared/computed.js'

export default defineComponent({
  name: 'FirstVisit',
  components: {},
  data() {
    return {
      slug: 'initiated' //REMEMBER TO CHANGE!!!
    }
  },
  setup(){
    return { 
      store : setupStore()
    }
  },
  created(){
    clearInterval(this.interval)
  },
  unmounted(){
    clearInterval(this.interval)
  },
  beforeMount(){},
  mounted(){
    this.FirstVisit(this.name)
  },
  updated(){},
  computed: Object.assign(SharedComputed, {}),
  methods: Object.assign({
    FirstVisit(force){
      if( !this.store.prefs.isFirstVisit && !force ) 
        return
      
      this.queueJob(
        this.slug, 
        () => {
          this.store.prefs.firstVisit = false
          this.store.prefs.clientSideProcessing = true
          this.$forceUpdate()
          setTimeout(() => this.completeJob(this.slug), 3000)
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
  }, RelayMethods),
  props: {},
  
})
</script>

<style scoped>
 #refresh { font-size: 12pt; color:#666; margin-bottom:15px }
 #refresh button { cursor: pointer; border-radius: 3px; border: 1px solid #a0a0a0; color:#333 }
 #refresh button:hover {color:#000;}
 #refresh button[disabled] {color:#999 !important; border-color:#e0e0e0}
</style>

