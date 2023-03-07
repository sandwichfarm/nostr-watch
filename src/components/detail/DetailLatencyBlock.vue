<template>
  <div 
          v-if="result.latency?.average"
          id="status" 
          class="flex-none w-full md:w-auto md:flex mb-2 py-5" 
          > <!--something is weird here with margin-->
          <div class="text-white text-lg md:text-xl lg:text-3xl flex-1 block py-6 ">
            <vue-gauge 
              v-if="result.latency?.average"
              class="relative -top-6 -mb-12 m-auto inline-block"
              :refid="'relay-latency'"
              :options="{
                'needleValue':normalizeLatency(result?.latency?.average || result?.latency?.final),
                'arcDelimiters':[33,66],
                'rangeLabel': false,
                'arcColors': ['green', 'orange', 'red'] }">
            </vue-gauge>
          </div>
          <div class="text-black dark:text-white text-lg md:text-xl lg:text-3xl flex-1 block py-6">
            <h3 class="text-black/70 dark:text-white/50 text-lg">Avg. Latency</h3>
            <svg v-if="!result.latency?.average" class="animate-spin mr-1 mt-1 h-6 w-6 text-black dark:text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>{{ result.latency?.average?.[0] }}</span>
          </div>
          <div class="text-black dark:text-white text-lg md:text-xl lg:text-3xl flex-1 block py-6">
            <h3 class="text-black/70 dark:text-white/50 text-lg">Min Latency</h3>
            <svg v-if="!result.latency.min" class="animate-spin mr-1 mt-1 h-6 w-6 text-black dark:text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>{{ result.latency?.min }}</span>
          </div>
          <div class="text-black dark:text-white text-lg md:text-xl lg:text-3xl flex-1 block py-6">
            <h3 class="text-black/70 dark:text-white/50 text-lg">Max Latency</h3>
            <svg v-if="!result.latency.max" class="animate-spin mr-1 mt-1 h-6 w-6 text-black dark:text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>{{ result.latency?.max }}</span>
          </div>
        </div>
</template>

<script>
import { defineComponent, defineAsyncComponent } from 'vue'
import SharedComputed from '@/shared/computed.js'
import { setupStore } from '@/store'

const VueGauge = defineAsyncComponent(() =>
  import('vue-gauge' /* webpackChunkName: "VueGauge" */)
);

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
      relay: null
    }
  },
  components: {
    VueGauge,
  },

  computed: Object.assign(SharedComputed, {
    
  }),

  props: {
     result: {
      type: Object,
      default(){
        return new Object()
      }
    }
  },
})
</script>