<template>
  <div id="title_card" class="data-card overflow-hidden sm:rounded-lg mb-8 pt-5" style="background:transparent">
      <div class="px-4 py-5 sm:px-6">
        <h1 class="font-light text-3xl md:text-4xl xl:text-7xl">{{geo?.countryCode ? getFlag : ''}} <span @click="copy(relayFromUrl)">{{ relayFromUrl }}</span></h1>
        <p class="mt-1 w-auto text-xl text-gray-500" v-if="result?.info?.description">{{ result.info.description }}</p>
        <span class="mt-1 w-auto text-xl text-gray-400" v-if="result?.info?.contact">
          <span v-if="isContactType(result?.info?.contact, 'email')">Contact: <SafeMail :email="result.info.contact" /></span>
          <span v-else>{{ result?.info?.contact }}</span>
        </span>
      </div>
      <a 
      target="_blank" 
      :href="`https://www.ssllabs.com/ssltest/analyze.html?d=${ getHostname(relay) }`"
      class="inline-block py-2 px-3 bg-black/10 first-line:font-bold text-black dark:bg-white/50  dark:text-white ">
        Check SSL
      </a>
    </div>
</template>

<script>
import { defineComponent} from 'vue'
import SharedComputed from '@/shared/computed.js'
import RelayMethods from '@/shared/relays-lib.js'
import { setupStore } from '@/store'
import SafeMail from "@2alheure/vue-safe-mail";

export default defineComponent({
  name: 'DetailHeader',

  components: {
    SafeMail
  },

  setup(){
    return {
      store: setupStore()
    }
  },

  beforeMount(){
    this.relay = this.result.url
    console.log(this.relay)
  },

  data(){
    return {
      relay: null
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

  
})
</script>