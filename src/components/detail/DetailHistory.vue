<template>

  {{ pulses }}
  <div 
    v-if="!pulses && result?.check?.connect" 
    class="py-8 px-8 text-center text-lg">

    We cannot get uptime at this time. Is your relay new or potentially blocking the crawler? No? Maybe nostr.watch is broken.
  
  </div>  

  <div 
    class="mt-3 overflow-hidden mb-8">

    <div 
      class="px-0 pt-5 sm:px-6">
      
      <h3 
        class="text-lg md:text1xl lg:text-2xl xl:text-3xl">
      
        {{label}} for the last
      
        <span 
          class=" text-gray-500 dark:text-gray-400">
            12hrs: 
        </span> 
       
        <span 
          :class="getAbilityColor(result, ability)">
            {{getAbilityRate(ability, relay)}}%
        </span>
      
      </h3>

    </div>

    <div 
      class="px-0 py-5 sm:px-0 flex">
      <span 
        v-for="tick in this.pulse"
        :key="tick.date"
        class="mr-1 flex-1">

          <span 
            class="block" 
            :class="getUptimeTickClass(tick)">

            <span 
              class="hidden lg:block origin-left-top transform relative -right-2 rotate-90 text-xs text-black/75 w-1" 
              v-if="tick?.[ability]">
                {{ tick[ability] }}ms
            </span>

            <span 
              v-if="!tick?.[ability]">
                &nbsp;
            </span>

          </span>
          
      </span>

    </div>
  </div>
</template>

<script>
import { defineComponent } from 'vue'
import SharedComputed from '@/shared/computed.js'
import { setupStore } from '@/store'

export default defineComponent({
  name: 'DetailLatencyBlock',

  setup(){
    return {
      store: setupStore()
    }
  },

  beforeMount(){
    this.relay = this.result?.url || this.relayFromUrl
  },

  mounted(){
    // setInterval( () => console.log('pulses', this.pulse), 1000)
  },

  data(){
    return {
      relay: null,
      pulses: null,
    }
  },

  props: {
    result: {
      type: Object,
      default(){
        return new Object()
      }
    },
    ability: {
      type: String,
      default(){
        return ""
      }
    },
    label: {
      type: String,
      default(){
        return ""
      }
    },
    showMillis: {
      type: Boolean,
      default(){
        return true
      }
    }
  },
  
  components: {

  },

  computed: Object.assign(SharedComputed, {
    tickMin: function(){
      return ability => {
        console.log('ticks mapped', this.pulse?.map( t => t?.[ability] ))
        return Math.min.apply(Math, this.pulse?.map( t => t?.[ability] ).filter( t => t ))
      }
    },
    tickMax: function(){
      return ability => {
        return Math.max.apply(Math, this.pulse?.map( t => t?.[ability] ).filter( t => t ) )
      }
    },
    pulse: function(){
      return this.store.stats.getPulse(this.relay)
    },
    getUptimeTickClass: function(){
      return (tick) => {
        return {
          'bg-red-700/80 h-32': !tick?.[this.ability],
          // 'bg-green-400/50': tick.ability,
          [this.normalizeUptimeTick(tick)]: tick?.[this.ability]
        }
      }
    },
    normalizeUptimeTick: function(){
      return (tick) => { 
        const ability = this.ability

        if(!tick?.[ability])
          return

        const val = tick?.[ability],
              minVal = this.tickMin(ability), 
              maxVal = this.tickMax(ability), 
              newMin = 10,
              newMax = 30
        
        console.log(ability, 'min/max', minVal, maxVal)

        const h = Math.round( newMin + (val - minVal) * (newMax - newMin) / (maxVal - minVal))
        const m = 32 - h 

        let color 
        
        if(tick?.[ability]<this.store.prefs.latencyFast) {
          color = 'bg-green-400/60'
        } 
        else if(tick?.[ability]<(this.store.prefs.latencySlow/2)) {
          color = 'bg-yellow-400/50'
        }
        else if(tick?.[ability]<this.store.prefs.latencySlow) {
          color = 'bg-orange-400/50'
        }
        else {
          color = 'bg-red-400/50'
        }

        console.log('normalizeUptimeTick()', ability, color)

        return `h-${h} mt-${m} ${color}`
      }
    },
  }),
})
</script>