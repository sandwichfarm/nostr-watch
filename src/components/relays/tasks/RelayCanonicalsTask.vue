<template>
  
  <span  
      v-if="this.store.tasks.getActiveSlug === taskSlug"
      class="text-white lg:text-sm mr-2 ml-2 mt-1.5 text-xs">
    <span>Getting canonicals...</span>
  </span>
</template>

<style scoped>

</style>

<script>
import crypto from 'crypto'
import { RelayPool } from 'nostr'

import { defineComponent, toRefs } from 'vue'

import { setupStore } from '@/store'

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
    if( (!this.isExpired(this.taskSlug) && !force) ) 
      return
    
    const subid = crypto.randomBytes(40).toString('hex')

    this.queueJob(
      this.taskSlug, 
      async () => {
        const $pool = new RelayPool(['wss://history.nostr.watch'], { reconnect: false })

        $pool
          .on('open', r => {
            r.subscribe(subid, {
              limit: 1000,
              kinds: [ 1 ],
              "#t": [ 'canonical' ],
              authors:[ 'b3b0d247f66bf40c4c9f4ce721abfe1fd3b7529fbc1ea5e64d5f0f8df3a4b6e6' ]
            })
          })
          .on('event', (relay, _subid, event) => {
            if(_subid.includes(subid)){
              console.log('canonical event', event.id)
              const hash = event.tags.filter( tag => tag[0] === 'h')[0][1]
              this.hashes[hash] = event.id
            }
          })

        await this.delay(5000)

        try{
          // $pool.unsubscribe(subid)
          this.closePool($pool)
        } catch(e){""}

        relays.forEach( relay => {
          const hash = this.hash(relay)
          if( typeof this.hashes[hash] === "undefined" )
            return 
          this.canonicals[relay] = this.hashes[hash] //event.id
        })

        console.log('hashes found', Object.keys(this.hashes).length)
        console.log('canonicals found', Object.keys(this.canonicals).length, this.canonicals)
        console.log('from store', this.store.relays.getCanonicals)

        this.store.relays.setCanonicals(this.canonicals)

        this.store.tasks.completeJob()
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
      taskSlug: 'relays/canonicals',
      canonicals: new Object(),
      hashes: new Object()
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

