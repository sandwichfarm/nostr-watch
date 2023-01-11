<template>
  <span 
      v-if="this.store.tasks.getActiveSlug === taskSlug"
      class="text-white lg:text-sm mr-2 ml-2 mt-1.5 text-xs">
    <span>Retrieving operator profiles...</span>
  </span>
</template>

<style scoped>

</style>

<script>
import { defineComponent, toRefs } from 'vue'

import crypto from 'crypto'

import { setupStore } from '@/store'

import { RelayPool } from 'nostr'

import SharedMethods from '@/shared/relays-lib.js'
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
    if( !this.isExpired(this.taskSlug) && !force ) 
      return

    this.queueJob(
      this.taskSlug,
      () => {
        const relays = this.store.relays.getAggregateCache('public')

        console.log('public relays', this.store.relays.getAggregateCache('public').length)

        const pool = new RelayPool(relays)
        const subid = crypto.randomBytes(40).toString('hex')
        const uniques = {
          0: new Set(),
          1: new Set(),
          7: new Set(),
        }

        const limits = {
          0: 1,
          1: 20,
          7: 100
        } 

        const kinds = [0,1,7]
        //remove kind 1 for non-single page tasks
        pool
          .on('open', relay => {
            relay.subscribe(subid, { limit:10, kinds:kinds, authors:[this.result.info.pubkey] })
          })
          .on('event', (relay, sub_id, event) => {
            console.log(event)
            if(!kinds.includes(event.kind))
              return
            if(sub_id !== subid)
              return
            const u = uniques[event.kind],
                  l = limits[event.kind]
            if( u.has(event.id) || u.size > l )
              return
            if( !(event instanceof Object) )
              return
            
            if( !( this.events[event.kind] instanceof Object ))
              this.events[event.kind] = new Object()
            this.events[event.kind][event.id] = event
            u.add(event.id)
            if(event.kind === 0)
              this.store.profile.setProfile(JSON.parse(event.content)).catch()
            console.log(`kind: ${event.kind} found`, '... total',  u.size, Object.keys(this.events[event.kind]).length)
            console.log( 'event!', event.content )
          })

        this.store.tasks.completeJob(this.taskSlug)
          // .on('eose', relay => {
          //   relay.close()
          // })
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
}

export default defineComponent({
  name: 'TemplateTask',
  components: {},
  data() {
    return {
      taskSlug: 'relays/operatorprofiles'
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
  methods: Object.assign(localMethods, SharedMethods),
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

