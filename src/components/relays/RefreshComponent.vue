<template>
  <span class="text-white text-sm mr-2 ml-2">
    <span v-if="!disableManualRefresh()">Updated {{ sinceLast }} ago</span>
    <span v-if="disableManualRefresh()">Updating Now</span>
  </span>
  <span class="text-white text-sm mr-2" v-if="store.prefs.refresh"> 
    Next refresh in: {{ untilNext }}
  </span>
  <button class="mr-3 mt-1.5 text-xs rounded border-b-3 border-slate-700 bg-slate-500 py-0.5 px-3 font-bold text-white hover:border-slate-500 hover:bg-slate-400" :disabled='disabled' @click="refreshNow()">Refresh{{ relay ? ` ${relay}` : "" }} Now</button>
</template>

<style scoped>

</style>

<script>
import { defineComponent, toRefs } from 'vue'
import RelaysLib from '@/shared/relays-lib.js'
import { setupStore } from '@/store'

const localMethods = {
    timeUntilRefresh(){
      return this.timeSince(Date.now()-(this.store.relays.lastUpdate+this.store.prefs.duration-Date.now())) 
    },
    timeSinceRefresh(){
      return this.timeSince(this.store.relays.lastUpdate)
    },
    disableManualRefresh: function(){
      //this is a hack.
      const lastUpdate = this.store.relays.lastUpdate
      if(Math.floor( ( Date.now()-lastUpdate )/1000 ) < 20)
        this.disabled = true 
      else
        this.disabled = false
    },
    setRefreshInterval: function(){
      clearInterval(this.interval)
      this.interval = setInterval(() => {
        this.prefs = this.store.prefs.get

        this.untilNext = this.timeUntilRefresh() 
        this.sinceLast = this.timeSinceRefresh() 

        if(this.store.prefs.refresh )
          this.invalidate()

        this.disableManualRefresh()
      }, 1000)
    },
    refreshNow(){
      this.disabled = true
      this.invalidate(true)
    }
}

export default defineComponent({
  name: 'RefreshComponent',
  components: {},
  setup(props){
    const {resultsProp: results} = toRefs(props)
    return { 
      store : setupStore(),
      results: results
    }
  },
  mounted(){
    this.relays = this.store.relays.getAll
    this.lastUpdate = this.store.relays.lastUpdate

    console.log('last update', this.lastUpdate)

    clearInterval(this.interval)

    this.untilNext = this.timeUntilRefresh() 
    this.sinceLast = this.timeSinceRefresh() 

    this.setRefreshInterval()
  },
  updated(){
    this.untilNext = this.timeUntilRefresh() 
    this.sinceLast = this.timeSinceRefresh() 
  },
  computed: {},
  methods: Object.assign(localMethods, RelaysLib),
  props: {
    resultsProp: {
      type: Object,
      default(){
        return {}
      }
    },
  },
  data() {
    return {
      relay: "",
      relays: [],
      refresh: {},
      untilNext: null,
      lastUpdate: null,
      sinceLast: null,
      interval: null,
      disabled: true
    }
  },
})
</script>

<style scoped>
 #refresh { font-size: 12pt; color:#666; margin-bottom:15px }
 #refresh button { cursor: pointer; border-radius: 3px; border: 1px solid #a0a0a0; color:#333 }
 #refresh button:hover {color:#000;}
 #refresh button[disabled] {color:#999 !important; border-color:#e0e0e0}
</style>

