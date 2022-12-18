<template>
<section id="refresh">
   <span>Updated {{ refreshData?.sinceLast }} ago <button @click="invalidate(true, this.relay)">Refresh{{ relay ? ` ${relay}` : "" }}</button></span>
   <span v-if="preferences.refresh"> Next refresh in: {{ refreshData?.untilNext }}</span>
</section>
</template>

<style scoped>

</style>

<script>
import { defineComponent, reactive } from 'vue'
import sharedMethods from '../shared'
import { useStorage } from "vue3-storage";

const localMethods = {
    timeUntilRefresh(){
      return this.timeSince(Date.now()-(this.lastUpdate+this.preferences.cacheExpiration-Date.now())) 
    },
    timeSinceRefresh(){
      return this.timeSince(this.lastUpdate)
    },

    nextRefresh: function(){
      return this.timeSince(Date.now()-(this.lastUpdate+this.preferences.cacheExpiration-Date.now()))
    },
    setRefreshInterval: function(){
      this.interval = setInterval(() => {
        this.preferences = this.getState('preferences') || this.preferences

        this.refreshData.untilNext = this.timeUntilRefresh() 
        this.refreshData.sinceLast = this.timeSinceRefresh() 

        if(this.isExpired() && this.preferences.refresh)
          this.invalidate(false, this.relay)

      }, 1000)
    }
}

export default defineComponent({
  name: 'RefreshComponent',
  components: {},
  mounted(){
    clearInterval(this.interval)

    this.storage = useStorage()
    this.lastUpdate = this.getState('lastUpdate')|| this.lastUpdate
    this.preferences = this.getState('preferences') || this.preferences

    this.refreshData = reactive({
      untilNext: this.timeUntilRefresh(),
      sinceLast: this.timeSinceRefresh()
    })

    this.setRefreshInterval()
  },
  updated(){
    this.saveState('preferences')

    if(this.relays && this.isDone())
      this.saveState('lastUpdate')

    this.refreshData.untilNext = this.timeUntilRefresh() 
    this.refreshData.sinceLast = this.timeSinceRefresh() 
  },
  computed: {},
  methods: Object.assign(localMethods, sharedMethods),
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
      }
    }
  },
})
</script>

