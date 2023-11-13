<template>
<div class="flex-none lg:flex-1 justify-center mb-6 lg:mb-0" v-if="result?.info && Object.keys(result?.info)?.length">
  <div class="inline-block rounded-lg shadow-lg h-auto lg:h-full bg-white dark:bg-black/30 max-w-sm text-center">
    <div class="py-6 px-4">
      <h5 class="text-gray-900 dark:text-white/90 text-xl font-medium mb-2">
        Software
      </h5>
      <p class="text-gray-700 text-base mb-4 dark:text-white/60">
        <strong>{{relay}}</strong> is running <strong>{{ getSoftware }}</strong> version <strong>{{ result?.info?.version }}</strong>
      </p>
    </div>
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