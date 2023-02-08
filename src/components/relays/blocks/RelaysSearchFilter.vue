<template>
<div class="w-full max-w-lg lg:max-w-xs">
  <label for="relay-filter" class="sr-only">Filter Relays</label>
  <div class="relative">
    <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
      <MagnifyingGlassIcon class="h-5 w-5 text-gray-400" aria-hidden="true" />
    </div>
    <input 
      ref="relay_filter"
      id="relay-filter" 
      name="relay-filter" 
      placeholder="Filter Relays" type="search"
      class="block w-full rounded-md border border-gray-300 bg-white py-2 pl-10 pr-3 leading-5 placeholder-gray-500 focus:border-indigo-500 focus:placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:text-sm" 
      />
  </div>
</div>
{{ store.prefs.getFilters }}
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
  },
  handleKeyUp(){

  },
  handleFilter(event){
    this.parseFilter(event.target.value)
  },
  parseFilter(string){
    //console.log('parsing', string)
    const segments = string.split(' ')
    segments.forEach(segment => {
      if(segment.includes('nip:'))
        this.parseNip(segment)
      else {
        this.parseRelay(segment)
      }
    })
    //console.log(this.store.prefs.getFilters)
  },
  parseRelay(maybeRelay){
    const fn = (relays) => {
      return relays.filter( relay => relay.includes(maybeRelay))
    }
    this.store.prefs.addFilter( 'relay', fn )
  },
  parseNip(nip){
    const data = nip.split(':')

    if(data.length != 2)
      return 

    const key = data[0],
          value = data[1]

    key
    
    let not = false
    
    if(data[1].startsWith('!'))
      not = true

    const fn = (relays) => {
       return relays.filter( relay => {
        const exists = this.result?.[relay]?.info?.supported_nips.includes(value)
        return not ? !exists : exists 
      })
    }
    
    this.store.prefs.addFilter( 'relay', fn )
  },
  filterNip(){
    
  },
  filterCountry(){

  },
  filterContinent(){

  } 
}

export default defineComponent({
  name: 'RelaysSearchFilter',
  components: {
    MagnifyingGlassIcon
  },
  setup(){
    return { 
      store : setupStore()
    }
  },
  created(){
  },
  mounted(){
    //console.log('relay_filter ref', this.$refs.relay_filter)
    this.$refs.relay_filter.addEventListener('change', event => this.handleFilter(event))

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
      activeFilters: {}
    }
  },
})

</script>