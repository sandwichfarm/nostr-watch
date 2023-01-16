<template>
  
  <span  
      v-if="this.store.tasks.getActiveSlug === taskSlug && isLoggedIn"
      class="text-white lg:text-sm mr-2 ml-2 mt-1.5 text-xs">
    <span>Getting user kind 3...</span>
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

const localMethods = {
  queueJob: function(id, fn, unique){
    this.store.tasks.addJob({
      id: id,
      handler: fn,
      unique: unique
    })
  },
  invalidate(force){
    if( (!this.isExpired(this.taskSlug) && !force) ) 
      return
    
    if( !this.isLoggedIn )
      return 
    
    if( !this.store.prefs.useKind3 )
      return

    this.queueJob(
      this.taskSlug,
      async () => {
        await this.store.user.setKind3()
          .then( () => {
            Object.keys(this.store.user.kind3).forEach( key => {
              this.store.relays.setFavorite(key)
            })
            this.store.tasks.completeJob()
          })
          .catch( err => {
            console.error('error!', err)
            this.store.tasks.completeJob()
          })
      },
      true
    )
  },
  timeUntilRefresh(){
    return this.timeSince(Date.now()-(this.store.tasks.getLastUpdate(this.taskSlug)+this.store.prefs.duration-Date.now())) 
  },
  timeSinceRefresh(){
    return this.timeSince(this.store.tasks.getLastUpdate(this.taskSlug)) || Date.now()
  },
  hash(relay){
    return crypto.createHash('md5').update(relay).digest('hex');
  }
}

export default defineComponent({
  name: 'TemplateTask',
  components: {},
  data() {
    return {
      taskSlug: 'user/relay/list',
      kind3Remote: new Object(),
      kind3Local: {}
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
    
    this.relays = Array.from(new Set(relays))
  },
  mounted(){
    console.log('task', this.taskSlug, 'is processing:', this.store.tasks.isProcessing(this.taskSlug))
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
  methods: Object.assign(localMethods, UserMethods, SharedMethods),
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

