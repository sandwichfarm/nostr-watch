<template>
  <div class="col-span-1" v-if="result?.log">
    <div class="overflow-x-auto sm:-mx-6 lg:-mx-8">
      <div class="py-2 inline-block min-w-full sm:px-6 lg:px-8">
        <div class="overflow-hidden">
          <table class="min-w-full text-center">
            <thead>
              <tr>
                <th scope="col" class="text-sm font-medium text-gray-900 dark:text-white/50 px-6 py-4 ">
                  <!-- Log -->
                  Status: {{ this.result.state }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(log, index) in result.log" :key="`${log[0]}-${index}`">
                <td class="border-b text-sm text-gray-900 font-medium px-6 py-4 overflow-ellipsis font-mono" :class="getLogClass(log[0])">
                  {{ log[1] }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { defineComponent } from 'vue'
import SharedComputed from '@/shared/computed.js'
import { setupStore } from '@/store'

export default defineComponent({
  name: 'DetailLog',

  setup(){
    return {
      store: setupStore()
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
    getLogClass(){
      return (slug) => { 
        return {
          ['bg-indigo-100 border-indigo-400']: slug.includes('eose'),
          ['bg-red-300 border-red-400 dark:bg-red-400/50 dark:border-red-400/30 dark:text-white/50']: slug.includes('error'),
          ['bg-green-400 border-green-300 dark:bg-green-400/40 dark:border-green-400/20 dark:text-white/50']: slug.includes('success'),
          ['bg-blue-300 border-blue-400 dark:bg-blue-300/50 dark:border-blue-300/30 dark:text-white/50']: slug.includes('notice'),
          ['bg-blue-500 border-blue-400 dark:bg-blue-500/50 dark:border-blue-400/30 dark:text-white/50']: slug.includes('info'),
          ['bg-yellow-300 border-yellow-400 dark:bg-yellow-300/50 dark:bg-yellow-300/30 dark:text-white/50']: slug.includes('timeout'),
        } 
      }
    },
  }),

  
})
</script>