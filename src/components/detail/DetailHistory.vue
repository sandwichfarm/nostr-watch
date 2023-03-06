<template>
  <div v-if="!pulses && result?.check?.connect" class="py-8 px-8 text-center text-lg">
    We cannot get uptime at this time. Is your relay new or potentially blocking the crawler? No? Maybe nostr.watch is broken. Check https://status.nostr.watch for more information. 
  </div>  

  <div class="mt-3 overflow-hidden mb-8" v-if="this.pulses && Object.keys(this.pulses).length && !isPayToRelay(relay)">
  <div class="px-0 pt-5 sm:px-6">
    <h3 class="text-lg md:text1xl lg:text-2xl xl:text-3xl">
      Readability for the last
      <span class=" text-gray-500 dark:text-gray-400">12hrs: </span> 
      <span :class="getUptimeColor(result)" v-if="result?.uptime">{{ result.uptime }}%</span>
    </h3>
  </div>

  <div class="px-0 py-5 sm:px-0 flex">
    <!-- <span 
      v-for="pulse in this.pulses"
      :key="pulse.date"
      class=" mr-1 flex-1 relative"
      :class="getUptimeTickClass(pulse)">
        <span class="block origin-left-top transform relative -right-2 rotate-90 text-xs text-black/75 w-1" v-if="pulse.latency">{{ pulse.latency }}ms</span>
        <span v-if="!pulse.latency">&nbsp;</span>
      </span> -->

    <span 
      v-for="pulse in this.pulses"
      :key="pulse.date"
      class="mr-1 flex-1">
        <span class="block" :class="getUptimeTickClass(pulse)">
          <span class="hidden lg:block origin-left-top transform relative -right-2 rotate-90 text-xs text-black/75 w-1" v-if="pulse.latency">{{ pulse.latency }}ms</span>
          <span v-if="!pulse.latency">&nbsp;</span>
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
    this.relay = this.result.url
  },

  data(){
    return {
      relay: null,
      pulses: this.store.stats.getPulse(this.relay)
    }
  },

  props: {
    result: {
      type: Object,
      default(){
        return new Object()
      }
    }
  },
  
  components: {

  },

  computed: Object.assign(SharedComputed, {
    
  }),
})
</script>