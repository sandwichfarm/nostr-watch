<template>
  <span 
      v-if="this.store.jobs.getActiveSlug === slug"
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
  invalidate(force){
    if( !this.isExpired(this.slug) && !force ) 
      return

    this.queueJob(
      this.slug,
      () => {
        const relays = this.store.relays.getAggregateCache('public')

        //console.log('public relays', this.store.relays.getAggregateCache('public').length)

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
        //remove kind 1 for non-single page jobs
        pool
          .on('open', relay => {
            relay.subscribe(subid, { limit:10, kinds:kinds, authors:[this.result.info.pubkey] })
          })
          .on('event', (relay, sub_id, event) => {
            //console.log(event)
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
            //console.log(`kind: ${event.kind} found`, '... total',  u.size, Object.keys(this.events[event.kind]).length)
            //console.log( 'event!', event.content )
          })

        this.store.jobs.completeJob(this.slug)
          // .on('eose', relay => {
          //   this.closeRelay(relay)
          // })
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
      slug: 'relays/operatorprofiles'
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
    
    this.relays = this.store.relays.getAll()
  },
  mounted(){
    //console.log('job', this.slug, 'is processing:', this.store.jobs.isJobActive(this.slug))
    this.invalidateJob()
  },
  updated(){},
  computed: Object.assign(SharedComputed, {}),
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

