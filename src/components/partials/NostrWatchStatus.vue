<template>

  <!-- Faking this for now -->
  <span class="text-xs"
    v-if="this.store.jobs.getLastUpdate('status/history')">
    <span class="text-white/40 inline-block lg:text-sm ml-2 mr-3 text-xs mt-1.5">
      
      <span 
      class="rounded-sm h-3 w-3 inline-block relative"
      :class="{
        'bg-green-700/80': store.status.historyNode === 1, //healthy
        'bg-yellow-500/80': store.status.historyNode === 2, //slow 
        'bg-red-700/80': store.status.historyNode === 0, //unavailable within 5s
      }">
      </span>
      System Status
    </span>
  </span>


  <!-- <span
    v-if="this.store.jobs.getLastUpdate('status/history')">
    <span class="text-white inline-block lg:text-sm ml-2 mr-3 text-xs">
      <span 
      class="rounded-md h-2 w-2 inline-block"
      :class="{
        'bg-green-400': store.status.historyNode === 1, //healthy
        'bg-yellow-400': store.status.historyNode === 2, //slow 
        'bg-red-500': store.status.historyNode === 0, //unavailable within 5s
      }">
      </span>
      History Relay
    </span>
    <span class="text-white inline-block lg:text-sm ml-2 mr-3 text-xs">
      Region: {{ store.prefs.region }}
    </span>
  </span> -->
</template>

<script>
import { defineComponent } from 'vue'

import { setupStore } from '@/store'

export default defineComponent({
  name: 'StatusHistoryNode',
  components: {},
  data() {
    return {}
  },
  setup(){
    return { 
      store : setupStore(),
    }
  },
})
</script>