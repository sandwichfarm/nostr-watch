<template>
<div class="data-card flex sm:rounded-lg bg-slate-50 dark:bg-black/20 border-slate-200 border py-8" v-if="geo">
  <div class="text-slate-800 text-lg md:text-xl lg:text-3xl flex-none w-full block py-1 text-center">
    <span>
      It's <strong>{{ getLocalTime }}</strong> in <strong>{{ geo?.city }}</strong>
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