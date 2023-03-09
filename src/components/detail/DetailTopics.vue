<template>
  <div class="data-card flex sm:rounded-lg bg-slate-50 dark:bg-black/20 border-slate-200 border mb-8 py-8 px-4" v-if="result?.topics && result?.topics.length">
    <div class="text-slate-800 text-lg md:text-xl lg:text-3xl flex-none w-full block py-1 text-center">
      <span v-for="topic in getTopics" :class="normalizeTopic(topic)" :key="`${result?.url}-${topic[0]}`">
        #{{ topic[0] }}  
      </span>
    </div>
  </div>
</template>

<script>
import { defineComponent} from 'vue'
import SharedComputed from '@/shared/computed.js'
import RelayMethods from '@/shared/relays-lib.js'
import { setupStore } from '@/store'

export default defineComponent({
  name: 'DetailTopics',

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

  },

  computed: Object.assign(SharedComputed, {
    isContactType: function(){
      return (str, match) => {
        if(this.sanitizeAndDetectEmail(str) && match === 'email')
          return true
      }
    },
  }),

  methods: Object.assign(RelayMethods, {

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