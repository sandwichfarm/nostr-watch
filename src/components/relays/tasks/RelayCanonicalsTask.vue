<template>
  
  <span  
      v-if="this.store.jobs.getActiveSlug === slug"
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
    this.store.jobs.addJob({
      id: id,
      handler: fn,
      unique: unique
    })
  },
  Canonicals(force){
    if( (!this.isExpired(this.slug) && !force) ) 
      return
    
    const subid = crypto.randomBytes(40).toString('hex')

    this.queueJob(
      this.slug, 
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
              const hash = event.tags.filter( tag => tag[0] === 'h')[0][1]
              this.hashes[hash] = event.id
            }
          })

        await this.delay(5000)

        try{
          this.closePool($pool)
        } catch(e){""}

        relays.forEach( relay => {
          const hash = this.hash(relay)
          if( typeof this.hashes[hash] === "undefined" )
            return 
          this.canonicals[relay] = this.hashes[hash] //event.id
        })

        this.store.relays.setCanonicals(this.canonicals)

        this.store.jobs.completeJob(this.slug)
      }, 
      true
    )
  },
  timeUntilRefresh(){
    return this.timeSince(Date.now()-(this.store.jobs.getLastUpdate(this.slug)+this.store.prefs.duration-Date.now())) 
  },
  timeSinceRefresh(){
    return this.timeSince(this.store.jobs.getLastUpdate(this.slug)) || Date.now()
  },
  hash(relay){
    return crypto.createHash('md5').update(relay).digest('hex');
  }
}

export default defineComponent({
  name: 'Canonicals',
  components: {},
  data() {
    return {
      slug: 'relays/canonicals',
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
    this.lastUpdate = this.store.jobs.getLastUpdate(this.slug)
    this.untilNext = this.timeUntilRefresh()
    this.sinceLast = this.timeSinceRefresh()
    
    this.relays = Array.from(new Set(relays))
  },
  mounted(){
    if(this.store.jobs.isJobActive(this.slug))
      this.Canonicals(true)
    else
      this.Canonicals() 
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

