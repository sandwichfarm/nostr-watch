<template>
  <span class="text-inherit">
    <span class="text-inherit">
      TESTING
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

import { relays } from '../../../../relays.yaml'

const localMethods = {
  invalidate(force){
    if( (!this.isExpired(this.slug) && !force) ) 
      return
    
    this.queueJob(
      this.slug, 
      () => {
        this.$pool
          .subscribe()
      },
      true
    )
  },
}

export default defineComponent({
  name: 'TemplateJob',
  components: {},
  data() {
    return {
      slug: 'relays/*' //REMEMBER TO CHANGE!!!
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
    this.lastUpdate = this.store.jobs.getLastUpdate(this.slug)
    
    this.relays = Array.from(new Set(relays))
  },
  mounted(){
    //console.log('is processing', this.store.jobs.isJobActive(this.slug))

    // if(this.store.jobs.isJobActive(this.slug))
    //   this.invalidate(true)
    // else
    //   this.invalidate()
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

