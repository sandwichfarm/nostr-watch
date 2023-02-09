<template>
  <span  
      v-if="this.store.tasks.getActiveSlug === slug && isLoggedIn"
      class="text-inherit">
    <span class="text-inherit">looking for your contact list</span>
  </span>
</template>

<style scoped>

</style>

<script>
import crypto from 'crypto'
// import { RelayPool } from 'nostr'

import { defineComponent, toRefs } from 'vue'

import { setupStore } from '@/store'

import SharedMethods from '@/shared/relays-lib.js'
import UserMethods from '@/shared/user-lib.js'
import SharedComputed from '@/shared/computed.js'

import { relays } from '../../../../relays.yaml'

const localMethods = new Object()

localMethods.invalidate = function(force){
  if( !this.isExpired(this.slug) && !force ) 
    return
  
  if( !this.isLoggedIn() ) 
    return

  if( !this.store.prefs.useKind3 )
    return
  
  //console.log('wtf?', this.slug, !this.isExpired(this.slug) && !force)

  this.queueKind3(this.slug)
}

localMethods.timeUntilRefresh = function(){
  return this.timeSince(Date.now()-(this.store.tasks.getLastUpdate(this.slug)+this.store.prefs.duration-Date.now())) 
}

localMethods.timeSinceRefresh = function(){
  return this.timeSince(this.store.tasks.getLastUpdate(this.slug)) || Date.now()      
}

localMethods.hash = function(relay){
  return crypto.createHash('md5').update(relay).digest('hex');
}

export default defineComponent({
  name: 'TemplateTask',
  components: {},
  data() {
    return {
      slug: 'user/relay/list',
      kind3Remote: new Object(),
      kind3Local: {}
    }
  },
  setup(props){
    const {resultsProp: results} = toRefs(props)
    const {forceProp: force} = toRefs(props)
    return { 
      store : setupStore(),
      results: results,
      force: force
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
    
    this.relays = Array.from(new Set([...this.store.relays.getAll, ...relays]))
  },
  mounted(){
    //console.log('task', this.slug, 'is processing:', this.store.tasks.isTaskActive(this.slug))
    this.invalidateTask()
  },
  updated(){},
  computed: Object.assign(SharedComputed, {
    getDynamicTimeout: function(){
      return this.averageLatency*this.relays.length
    },
  }),
  methods: Object.assign(localMethods, UserMethods, SharedMethods),
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

