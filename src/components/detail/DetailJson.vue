<template>
<div class="hidden lg:block">
  <h2 
    class="text-center text-2xl text-black/50 dark:text-white/50 my-4 font-extrabold cursor-pointer block py-5"
    :class="{ 
      'bg-black/10 dark:bg-black/50': this.store.layout.rawDataIsExpanded,  
      'bg-black/5 dark:bg-black/20': !this.store.layout.rawDataIsExpanded,  
    }"
    @click="this.store.layout.toggleRawData">
    <code>{ ... }</code>
  </h2>
  <div 
    v-if="this.store.layout.rawDataIsExpanded">
    <div>
      <h3 id="json-nip-11" class="text-left text-xl text-black/50 dark:text-white/50 my-4 font-extrabold">NIP-11</h3>
      <pre class="p-4 bg-black/5 dark:bg-black/10 border border-black/20 text-left font-bold text-lg text-black/50 dark:text-white/40">{{ JSON.stringify(this.result.info, null, 4) }}</pre>
    </div>
    <div>
      <h3 id="json-geo" class="text-left text-xl text-black/50 dark:text-white/50 my-4 font-extrabold">GEO</h3>
      <pre class="p-4 bg-black/5 dark:bg-black/10 border border-black/20 text-left font-bold text-lg text-black/50 dark:text-white/40">{{ this.store.relays.geo?.[relay] ? jsonGeo(relay) : 'not found' }}</pre>
    </div>
    <div>
      <h3 id="json-dns" class="text-left text-xl text-black/50 dark:text-white/50 my-4 font-extrabold">DNS</h3>
      <pre class="p-4 bg-black/5 dark:bg-black/10 border border-black/20 text-left font-bold text-lg text-black/50 dark:text-white/40">{{ this.store.relays.geo?.[relay]?.dns ? jsonDNS(relay) : 'not found' }}</pre>
    </div>
    <div>
      <h3 id="json-nostrwatch" class="text-left text-xl text-black/50 dark:text-white/50 my-4 font-extrabold">NOSTR.WATCH</h3>
      <pre class="p-4 bg-black/5 dark:bg-black/10 border border-black/20 text-left font-bold text-lg text-black/50 dark:text-white/40">{{ this.store.results.get(relay) ? jsonCheck(relay) : 'not found' }}</pre>
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