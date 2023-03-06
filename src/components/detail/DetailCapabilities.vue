<template>
  <div id="status" class="block lg:flex mb-2 py-5 rounded-lg"> <!--something is weird here with margin-->
    <div 
      v-for="type in checkDimensions" 
      :key="type.key" 
      class="text-white text-lg md:text-xl lg:text-2xl block lg:flex-1 py-3" 
      :class="checkClass(type.key)">
      <span>{{type.label}}</span>  
    </div>
  </div>
</template>

<script>
import { defineComponent} from 'vue'
import SharedComputed from '@/shared/computed.js'
import RelayMethods from '@/shared/relays-lib.js'
import { setupStore } from '@/store'

export default defineComponent({
  name: 'DetailCapabilities',

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