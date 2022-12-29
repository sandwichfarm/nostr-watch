<template>
<section id="refresh">
  <span>
    Updated {{ sinceLast }} ago 
    <button :disabled='disabled' @click="refreshNow()">Refresh{{ relay ? ` ${relay}` : "" }} Now</button>
  </span>
  <span v-if="store.prefs.refresh"> 
    Next refresh in: {{ untilNext }}
  </span>
</section>
</template>

<style scoped>

</style>

<script>
import { defineComponent  } from 'vue'
import RelaysLib from '../shared/relays-lib.js'
// import { useStorage } from "vue3-storage";
import { store } from '../store'

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
  setup(){
    return { 
      store : {
        relays: store.useRelaysStore(),
        prefs: store.usePrefsStore() 
      }
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
  props: {},
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

