<template>
<section id="refresh">
  <span>
    Updated {{ refreshData?.sinceLast }} ago 
    <button :disabled='disabled' @click="refreshNow()">Refresh{{ relay ? ` ${relay}` : "" }} Now</button>
  </span>
  <span v-if="preferences.refresh"> 
    Next refresh in: {{ refreshData?.untilNext }}
  </span>
</section>
</template>

<style scoped>

</style>

<script>
import { defineComponent, reactive } from 'vue'
import RelaysLib from '../lib/relays-lib.js'
import { useStorage } from "vue3-storage";

const localMethods = {
    timeUntilRefresh(){
      return this.timeSince(Date.now()-(this.lastUpdate+this.preferences.cacheExpiration-Date.now())) 
    },
    timeSinceRefresh(){
      return this.timeSince(this.lastUpdate)
    },
    disableManualRefresh: function(){
      //this is a hack.
      const lastUpdate = this.getCache('lastUpdate')
      if(Math.floor( ( Date.now()-lastUpdate )/1000 ) < 20)
        this.disabled = true 
      else
        this.disabled = false
    },
    setRefreshInterval: function(){
      clearInterval(this.interval)
      this.interval = setInterval(() => {
        this.preferences = this.getCache('preferences') || this.preferences

        this.refreshData.untilNext = this.timeUntilRefresh() 
        this.refreshData.sinceLast = this.timeSinceRefresh() 

        if(this.isExpired() && this.preferences.refresh)
          this.invalidate(false, this.relay)

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
  mounted(){
    clearInterval(this.interval)

    this.storage = useStorage()
    this.lastUpdate = this.getCache('lastUpdate')|| this.lastUpdate
    this.preferences = this.getCache('preferences') || this.preferences

    this.refreshData = reactive({
      untilNext: this.timeUntilRefresh(),
      sinceLast: this.timeSinceRefresh()
    })

    this.setRefreshInterval()
  },
  updated(){
    this.setCache('preferences')
    
    this.refreshData.untilNext = this.timeUntilRefresh() 
    this.refreshData.sinceLast = this.timeSinceRefresh() 
  },
  computed: {},
  methods: Object.assign(localMethods, RelaysLib),
  props: {
    relay: {
      type: String,
      default(){
        return ""
      }
    },
    relaysProp:{
      type: Array,
      default(){
        return []
      }
    }, 
    messagesProp:{
      type: Object,
      default(){
        return {}
      }
    },
    resultProp: {
      type: Object,
      default(){
        return {}
      }
    },
  },
  data() {
    return {
      relays: this.relaysProp,
      result: this.resultProp,
      messages: this.messagesProp,
      storage: null,
      lastUpdate: null,
      refresh: true,
      refreshData: this.refreshDataProp,
      interval: null,
      preferences: {
        refresh: true,
        cacheExpiration: 30*60*1000
      },
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

