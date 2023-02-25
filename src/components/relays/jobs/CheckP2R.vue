<template>
  <span 
    v-if="this.store.jobs.getActiveSlug === slug"
    class="text-inherit">
    <span class="text-inherit" v-if="this.store.prefs.discoverRelays">checking pay-to-relay</span>
  </span>
</template>

<script>
import { defineComponent, toRefs } from 'vue'

import { setupStore } from '@/store'

import RelayMethods from '@/shared/relays-lib.js'
import SharedComputed from '@/shared/computed.js'



const updatedLocalMethods = {
  async checkP2R(force) {
    if ((!this.isExpired(this.slug, 1) && !force) || this.isSingle) return;

    const relays = this.store.relays.getRelays('paid', this.store.results.all);

    for (const relay of relays) {
      const result = {};

      try {
        const hostname = new URL(this.store.results.get(relay).info.payments_url).hostname;
        result.validP2R = !hostname.includes('your-domain.com');
      } catch (e) {
        result.validP2R = false;
      }

      this.store.results.mergeDeep({ [relay]: result });
      this.store.jobs.addProcessed(this.slug, relay);
    }

    this.store.jobs.completeJob(this.slug);
  },
};

export default defineComponent({
  name: 'CheckP2R',
  components: {},
  data() {
    return {
      slug: 'relays/check/p2r', //REMEMBER TO CHANGE!!!
      timeout: null
    }
  },
  setup(props){
    const {resultsProp: results} = toRefs(props)
    return { 
      store : setupStore(),
      results: results,
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
  },
  mounted(){    
    this.CheckP2R()
  },
  updated(){},
  computed: Object.assign(SharedComputed, {}),
  methods: Object.assign(localMethods, RelayMethods),
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