<template>
  <span  
      v-if="this.store.jobs.getActiveSlug === slug && isLoggedIn"
      class="text-inherit">
    <span class="text-inherit">looking for your relay list</span>
  </span>
</template>

<style scoped>

</style>

<script>
// import { RelayPool } from 'nostr'

import { defineComponent } from 'vue'

import { setupStore } from '@/store'

import SharedMethods from '@/shared/relays-lib.js'
import UserMethods from '@/shared/user-lib.js'
import SharedComputed from '@/shared/computed.js'

const localMethods = new Object()

localMethods.invalidate = function(force){
  if( !this.isExpired(this.slug, 1000) && !force ) 
    return
  
  if( !this.isLoggedIn() ) 
    return

  if( !this.store.prefs.useKind3 )
    return

  this.addUserRelayListJob()
}

export default defineComponent({
  name: 'TemplateJob',
  components: {},
  data() {
    return {
      slug: 'user/list/relays',
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
  beforeMount(){
    this.lastUpdate = this.store.jobs.getLastUpdate(this.slug)
  },
  mounted(){
    //console.log('job', this.slug, 'is processing:', this.store.jobs.isJobActive(this.slug))
    this.invalidateJob()
  },
  updated(){},
  computed: Object.assign(SharedComputed, {}),
  methods: Object.assign(UserMethods, SharedMethods, localMethods),
  props: {
    resultsProp: {
      type: Object,
      default(){
        return {}
      }
    },
    forceProp: {
      type: Boolean,
      default(){
        return false
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

