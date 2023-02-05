<template>
  <span 
    v-if="this.store.tasks.getActiveSlug === slug"
    class="text-white lg:text-sm mr-2 ml-2 mt-1.5 text-xs">
    <span>Detecting region</span>
  </span>
</template>

<style scoped>

</style>

<script>
import { defineComponent } from 'vue'

import { setupStore } from '@/store'

import RelayMethods from '@/shared/relays-lib.js'
import SharedComputed from '@/shared/computed.js'

import { daemons } from '@/config/nwd-geo.yaml'

import { getDistance } from 'geolib';
import { getVisitorGeo } from '@/utils'

const localMethods = {
  invalidate(force){
    // if( ( this.store.tasks.getLastUpdate('relays/check') || ( this.store.tasks.processed?.['relays/check'] && this.store.tasks.processed?.['relays/check'].length ) ) && !force ) 
    //   return
    if( !this.isExpired(this.slug, 6*60*60*1000) && !force ) 
      return
    
    console.log('got here', 'past expired')

    this.queueJob(
      this.slug, 
      async () => {
        console.log('got here', 'inside job')
        console.log('got here')
        const visitorGeo = await getVisitorGeo()
        this.store.user.ip = visitorGeo.query
        this.store.prefs.region = this.getClosest(visitorGeo)
        this.store.tasks.completeJob()
      },
      true
    )
  },
  getClosest(visitorGeo){
    const distances = []
    Object.keys(daemons).forEach( region => {
      console.log('type', region, daemons, typeof daemons[region].lon, daemons[region].lon)
      const distance = getDistance(
        { latitude: visitorGeo.lat, longitude: visitorGeo.lon },
        { latitude: daemons[region].lat, longitude: daemons[region].lon }
      )
      distances.push({ region: region, distance: distance })
    })
    distances.sort( (a, b) => {
      return a.distance - b.distance
    })
    return distances[0].region
  },
  setRefreshInterval: function(){
    clearInterval(this.interval)
    this.interval = setInterval(() => {
      if(!this.store.prefs.autoDetectRegion )
        return 

      if(!this.store.tasks.isProcessing(this.slug) && !this.isSingle)
        this.invalidate()
    }, 1000)
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
      slug: 'user/region' //REMEMBER TO CHANGE!!!
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
    this.lastUpdate = this.store.tasks.getLastUpdate(this.slug)
    this.untilNext = this.timeUntilRefresh()
    this.sinceLast = this.timeSinceRefresh()
  },
  mounted(){
    console.log('is processing', this.store.tasks.isProcessing(this.slug))

    if(this.store.tasks.isProcessing(this.slug))
        this.invalidate(true)
      else
        this.invalidate()

    if(!this.store.prefs.autoDetectRegion)
      this.setRefreshInterval()
    
    setTimeout( ()=>{}, 1)
  },
  updated(){},
  computed: Object.assign(SharedComputed, {}),
  methods: Object.assign(localMethods, RelayMethods),
  props: {},
})
</script>

<style scoped>
 #refresh { font-size: 12pt; color:#666; margin-bottom:15px }
 #refresh button { cursor: pointer; border-radius: 3px; border: 1px solid #a0a0a0; color:#333 }
 #refresh button:hover {color:#000;}
 #refresh button[disabled] {color:#999 !important; border-color:#e0e0e0}
</style>