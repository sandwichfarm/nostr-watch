<template>
  <span 
    v-if="this.store.tasks.getActiveSlug === taskSlug"
    class="text-white lg:text-sm mr-2 ml-2 mt-1.5 text-xs">
    <span>Retrieving uptime data...</span>
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
    if( (!this.isExpired(this.taskSlug) && !force) ) 
      return

    const subid = crypto.randomBytes(40).toString('hex')

    // const pool = new RelayPool( relays )
    
    //This should always be alive and not exist in a job, for now, it's fine. 
    this.queueJob(
      this.taskSlug, 
      async () => {
        const heartbeatsByEvent = new Object()
        let total = 48,
            count = 0
        await new Promise( resolve => {
          const pool = new RelayPool( ['wss://nostr.sandwich.farm'] )
          const uniques = new Set()

          pool
            .subscribe(subid, {
              kinds:    [1010],
              limit:    total, //12 hours 
              authors:  ['b3b0d247f66bf40c4c9f4ce721abfe1fd3b7529fbc1ea5e64d5f0f8df3a4b6e6'],
              // since:    Math.floor(this.store.tasks.getLastUpdate(this.taskSlug)/1000)
            })
          
          pool
            .on('event', (relay, sub_id, event) => {
              if(sub_id !== subid)
                return
              
              if(uniques.has(event.created_at))
                return 
              
              uniques.add(event.created_at)

              console.log('heartbeat found', event.id)
            
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
          }, 30000 )
        })
        
        this.parseHeartbeats(heartbeatsByEvent)
      },
      true
    )
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
    })

    console.log(heartbeats)

    this.store.stats.setHeartbeats(heartbeats)

    this.store.tasks.completeJob(this.taskSlug)
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
      taskSlug: 'relays/heartbeat',
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
    this.lastUpdate = this.store.tasks.getLastUpdate(this.taskSlug)
    this.untilNext = this.timeUntilRefresh()
    this.sinceLast = this.timeSinceRefresh()
    
    this.relays = Array.from(new Set(relays))
  },
  mounted(){
    console.log('is processing', this.store.tasks.isProcessing(this.taskSlug))

    if(this.store.tasks.isProcessing(this.taskSlug))
      this.invalidate(true)
    else
      this.invalidate(true)
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

