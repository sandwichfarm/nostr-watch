<template>
  <div id="nips" v-if="result?.info?.supported_nips" class="mb-8 py-1 overflow-hidden bg-slate-400 border-slate-200 shadow sm:rounded-lg dark:bg-slate-800">
    <div class="px-1 py-2 sm:px-6">
      <div class="lg:flex">
        <div class="flex-none lg:flex-initial">
          <h3 class="inline-block lg:block text-lg md:text-lg lg:text-xl xl:text-3xl mb-2 px-2 align-middle mt-4 font-black">nips</h3>
        </div>
        <a target="_blank" :href="nipLink(key)" v-for="key in result?.info?.supported_nips" :key="`nip-${key}`" 
        class="hover:bg-slate-300 dark:hover:bg-black/20 hover:shadow pointer-cursor flex-initial gap-4  text-slate-800 text-1xl w-1/5 inline-block py-6 ">
          <code>{{nipFormatted(key)}}</code>
        </a>
      </div>
    </div>
  </div>
</template>

<script>
import { defineComponent} from 'vue'
import SharedComputed from '@/shared/computed.js'
import RelayMethods from '@/shared/relays-lib.js'
import { setupStore } from '@/store'

export default defineComponent({
  name: 'DetailNips',

  components: {

  },

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
    checkClass(key){
      return { 
        'bg-green-800': this.result?.check?.[key] === true,
        'bg-red-800': this.result?.check?.[key] === false,
        'bg-gray-600': this.result?.check?.[key] === null,
        'rounded-tl-lg rounded-bl-lg': key == 'connect',
        'rounded-tr-lg rounded-br-lg': key == 'write',
      }
    },
  }),

  
})
</script>