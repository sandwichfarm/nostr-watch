<template>
<div class="flex-none lg:flex-1 justify-center mb-6 lg:mb-0"  v-if="geo && Object.keys(geo)?.length">
  <div class="inline-block rounded-lg shadow-lg h-auto lg:h-full bg-white dark:bg-black/30 max-w-sm text-center">
    <div class="py-6 px-4">
      <h5 class="text-gray-900 dark:text-white/90 text-xl font-medium mb-2">
        Network Summary
      </h5>
      <p class="text-gray-700 text-base mb-4 dark:text-white/60">
        The IP of <strong>https://{{ geo?.dns?.name }}</strong> is <strong>{{ geo?.dns?.data }}</strong>
        and appears to be in <strong>{{ geo?.city }} {{ geo?.country }}.</strong>
        The hosting provider is <strong>{{  geo?.as  }}</strong>.
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
    this.geo = this.store.relays.getGeo(this.relay)
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

git add yarn.lock src/components/relays/pages/RelaysDetail.vue  src/components/relays/jobs/RefreshJob.vue src/components/relays/jobs/LoadSeed.vue package.json