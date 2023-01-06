<template>
<div class="w-full max-w-lg lg:max-w-xs">
  <label for="relay-filter" class="sr-only">Filter Relays</label>
  <div class="relative">
    <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
      <MagnifyingGlassIcon class="h-5 w-5 text-gray-400" aria-hidden="true" />
    </div>
    <input 
      id="relay-filter" 
      name="relay-filter" 
      placeholder="Filter Relays" type="search"
      class="block w-full rounded-md border border-gray-300 bg-white py-2 pl-10 pr-3 leading-5 placeholder-gray-500 focus:border-indigo-500 focus:placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:text-sm" 
      />
  </div>
</div>
</template>

<script>
//vue 
import { defineComponent } from 'vue'
//pinia 
import { setupStore } from '@/store'
//shared methods 
import RelaysLib from '@/shared/relays-lib.js'
//theme
import { MagnifyingGlassIcon } from '@heroicons/vue/20/solid'

const localMethods = {
  toggle() {
     this.isActive = !this.isActive;
  },
  clearData(){
    this.store.relays.clearResults()
  }
}

export default defineComponent({
  name: 'ToolFilter',
  components: {
    MagnifyingGlassIcon
  },
  setup(){
    return { 
      store : setupStore()
    }
  },
  mounted(){
    // this.preferences = this
  },
  updated(){
    // this.setCache('preferences')
  },
  computed: {},
  methods: Object.assign(localMethods, RelaysLib),
  props: {},
  data() {
    return {
      storage: null,
      refresh: true,
      preferences: {
        refresh: true,
        cacheExpiration: 30*60*1000
      },
      isActive: false,
    }
  },
})

</script>