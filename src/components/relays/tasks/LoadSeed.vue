<template>
  <span 
    v-if="this.store.tasks.getActiveSlug === slug"
    class="text-white lg:text-sm mr-2 ml-2 mt-1.5 text-xs">
    <span v-if="isSingle">Loading {{ relay }} from history node...</span>
    <span v-if="!isSingle">Loading data from history relay</span>
  </span>
</template>

<style scoped>

</style>

<script>
import { defineComponent, toRefs } from 'vue'
import crypto from 'crypto'

import { setupStore } from '@/store'

import RelayMethods from '@/shared/relays-lib.js'
import SharedComputed from '@/shared/computed.js'

import { relays } from '../../../../relays.yaml'

import { RelayPool } from 'nostr'
import { geo } from '../../../../cache/geo.yaml'

const localMethods = {
  invalidate(force, single){
    // if( ( this.store.tasks.getLastUpdate('relays/check') || ( this.store.tasks.processed?.['relays/check'] && this.store.tasks.processed?.['relays/check'].length ) ) && !force ) 
    //   return
    if( !this.isExpired(this.slug, 15*60*1000) && !force ) 
      return
    
    this.queueJob(
      this.slug, 
      () => {
        const pool = new RelayPool(['wss://history.nostr.watch'])
        const subid = crypto.randomBytes(40).toString('hex')
        pool
          .on('open', relay => {
            console.log('subscribing')
            relay.subscribe(subid, {
              kinds:    [30303],
              "#d":     single ? [ single ] : relays,
              authors:  ['b3b0d247f66bf40c4c9f4ce721abfe1fd3b7529fbc1ea5e64d5f0f8df3a4b6e6'],
            })
          })
          .on('event', (relay, sub_id, event) => {
            if(subid === sub_id){
              const relay = event.tags[0][1]
              const data = JSON.parse(event.content)
              const result = {
                url: relay,
                check: {
                  connect: data.connect,
                  read: data.read,
                  write: data.write,
                },
                latency: data?.latency[this.store.prefs.region],
                info: data.info,
                uptime: this.getUptimePercentage(relay),
                identities: []
              }
              
              if(data.info?.pubkey)
                result.identities.push(data.info?.pubkey)

              if(data?.topics)
                result.topics = data.topics.filter( topic => !this.store.prefs.ignoreTopics.split(',').includes(topic[0]) )
                
              result.aggregate = this.getAggregate(result)
              this.results[relay] = result
              this.setCache(result)
            }
          })
          .on('eose', () => {
            pool.unsubscribe(subid)
            this.store.tasks.completeJob()
            pool.close()
          })
      },
      true
    )
  },
  setRefreshInterval: function(){
    clearInterval(this.interval)
    this.interval = setInterval(() => {
      if(!this.store.tasks.isProcessing(this.slug) && !this.isSingle)
        this.invalidate()
    }, 60*1000)
  },
  timeUntilRefresh(){
    return this.timeSince(Date.now()-(this.store.tasks.getLastUpdate(this.slug)+this.store.prefs.duration-Date.now())) 
  },
  timeSinceRefresh(){
    return this.timeSince(this.store.tasks.getLastUpdate(this.slug)) || Date.now()
  },
}

export default defineComponent({
  name: 'LoadSeed',
  components: {},
  data() {
    return {
      slug: 'relays/seed' //REMEMBER TO CHANGE!!!
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
    
    this.store.relays.setGeo(geo)
    this.relays = Array.from(new Set(relays))

    for(let ri=0;ri-this.relays.length;ri++){
      const relay = this.relays[ri],
            cache = this.getCache(relay)
      this.results[relay] = cache
    }
  },
  mounted(){
    console.log('is processing', this.store.tasks.isProcessing(this.slug))

    if(this.isSingle) {
      this.invalidate(true, this.relayFromUrl)
    }  
    else {
      if(this.store.tasks.isProcessing(this.slug))
        this.invalidate(true)
      else
        this.invalidate()
    }

    if(!this.store.prefs.clientSideProcessing)
      this.setRefreshInterval()
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

