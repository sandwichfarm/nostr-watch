<template>
  <span 
    v-if="this.store.tasks.getActiveSlug === slug"
    class="text-white lg:text-sm mr-11 ml-2 mt-1.5 text-xs">
    <span>
      <svg class="animate-spin mr-1 -mt-0.5 h-4 w-5 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
      Calculating Uptime
    </span>
  </span>
</template>

<style scoped>

</style>

<script>
import { defineComponent, toRefs } from 'vue'

import crypto from 'crypto'
import decodeJson from 'unescape-json'

import { setupStore } from '@/store'

import RelayMethods from '@/shared/relays-lib.js'
import SharedComputed from '@/shared/computed.js'


import { relays } from '../../../../relays.yaml'
import { RelayPool } from 'nostr'

const localMethods = {
  invalidate(force){
    if( (!this.isExpired(this.slug) && !force) ) 
      return
    // const pool = new RelayPool( relays )

    if(this.isSingle)
      this.jobHeartbeats()
    else
      this.queueJob(
        this.slug, 
        this.jobHeartbeats,
        true
      )
  },
  async jobHeartbeats(){
    const subid = crypto.randomBytes(40).toString('hex')
    const heartbeatsByEvent = new Object()
    let total = 48,
        count = 0
    await new Promise( resolve => {
      const pool = new RelayPool( ['wss://history.nostr.watch'] )
      const uniques = new Set()

      pool
        .subscribe(subid, {
          kinds:    [1010],
          limit:    total, //12 hours 
          authors:  ['b3b0d247f66bf40c4c9f4ce721abfe1fd3b7529fbc1ea5e64d5f0f8df3a4b6e6'],
          // since:    Math.floor(this.store.tasks.getLastUpdate(this.slug)/1000)
        })
      
      pool
        .on('event', (relay, sub_id, event) => {
          if(sub_id !== subid)
            return
          
          if(uniques.has(event.created_at))
            return 
          
          uniques.add(event.created_at)

          // console.log('heartbeat found', count, event.id)
        
          heartbeatsByEvent[event.created_at] = decodeJson(event.content).online

          count++

          if(count !== total)
            return 
          
          resolve()
          pool.unsubscribe(subid)
          pool.close()
        })
      setTimeout( () => { 
        resolve()
        pool.unsubscribe(subid)
        pool.close()
      }, 2000 )
    })
    
    this.parseHeartbeats(heartbeatsByEvent)

  },
  parseHeartbeats(data){
    const allTimestamps = Object.keys(data),
          heartbeatsByRelayObj = new Object()

    allTimestamps.forEach( timestamp => {
      data[timestamp].forEach( relayData => {
        const relay = relayData[0],
              latency = relayData[1]

        if( !(heartbeatsByRelayObj[relay] instanceof Object) )
          heartbeatsByRelayObj[relay] = allTimestamps.reduce( (acc, _timestamp) => {
            acc[_timestamp] = false
            return acc
          }, new Object())
        heartbeatsByRelayObj[relay][timestamp] = latency
      })
    })

    const allRelaysInHeartbeats = Object.keys(heartbeatsByRelayObj)

    const heartbeats = new Object()

    allRelaysInHeartbeats.forEach( relay => {
      heartbeats[relay] = new Array()
      console.log(relay, heartbeatsByRelayObj[relay])
      Object.keys(heartbeatsByRelayObj[relay]).forEach( (timestamp_) => {
        heartbeats[relay].push({
          date: timestamp_,
          latency: heartbeatsByRelayObj[relay][timestamp_]
        })
      })
      heartbeats[relay].sort( (h1, h2) => h1.date - h2.date )
      this.store.stats.addHeartbeat(relay, heartbeats[relay])
      this.setUptimePercentage(relay)
    })

    console.log(heartbeats)

    // this.store.stats.addHeartbeats(heartbeats)

    this.store.tasks.completeJob(this.slug)
  },
  timeUntilRefresh(){
    return this.timeSince(Date.now()-(this.store.tasks.getLastUpdate(this.slug)+this.store.prefs.duration-Date.now())) 
  },
  timeSinceRefresh(){
    return this.timeSince(this.store.tasks.getLastUpdate(this.slug)) || Date.now()
  },
  setUptimePercentage(relay){
    const heartbeats = this.store.stats.getHeartbeat(relay)
    if(!heartbeats || !Object.keys(heartbeats).length )
      return
    const totalHeartbeats = Object.keys(heartbeats).length 
    const totalOnline = Object.entries(heartbeats).reduce(
        (acc, value) => value[1].latency ? acc+1 : acc,
        0
    );
    const perc = Math.floor((totalOnline/totalHeartbeats)*100)

    const result = this.getCache(relay)
    if(!result)
      return
    result.uptime = perc 
    this.setCache(result)
  }
}

export default defineComponent({
  name: 'TemplateTask',
  components: {},
  data() {
    return {
      slug: 'relays/heartbeat',
      heartbeats: {},
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
    
    this.relays = Array.from(new Set(relays))
  },
  mounted(){
    console.log('is processing', this.store.tasks.isProcessing(this.slug))

    if(this.store.tasks.isProcessing(this.slug) || this.isSingle)
      this.invalidate(true)
    else
      this.invalidate()
  },
  updated(){
    
  },
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

