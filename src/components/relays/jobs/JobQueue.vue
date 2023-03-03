<template>
<span class="inline-block mr-12 pt-1.5">
  <span class="text-white/40 lg:text-sm mx-2 text-xs font-bold">
    <GetRelays
      v-if="!isSingle"
      v-bind:relaysProp="relays" />

    <DetectRegion 
      v-if="store.prefs.autoDetectRegion && !store.prefs.disableGeoDetection" />

    <StatusCheckHistoryNode />

    <GetPulse />

    <LoadSeed
      v-if="!store.prefs.clientSideProcessing" />

    <CheckNip11
      v-if="
        (
          (
            !store.prefs.clientSideProcessing 
            ||( !store.prefs.clientSideProcessing 
                && isSingle 
              ) 
          ) 
          && store.prefs.checkNip11
        )
        && !isSingle
      " />
      
    <CheckGeo />

    <CheckP2R v-if="!isSingle" />

    <RefreshJob 
      v-if="store.prefs.clientSideProcessing || isSingle || this.store.prefs.isFirstVisit" />
    
    <CheckDNS v-if="!isSingle" />

    <HistoryJob />

    <GetTopics
      v-if="store.prefs.clientSideProcessing && !isSingle" />

    <UserRelayList />

    <RelayOperatorJob 
      v-if="isSingle" />

    <FirstVisit 
      v-if="this.store.prefs.isFirstVisit
            && 
            this.store.jobs.getLastUpdate('relays/seed')
            && !isSingle"/>
  </span>
</span>
</template>

<script>
import { defineComponent, toRefs } from 'vue'

import { setupStore } from '@/store'

import SharedComputed from '@/shared/computed.js'

import DetectRegion from './DetectRegion.vue'
import LoadSeed from './LoadSeed.vue'
import RefreshJob from './RefreshJob.vue'
import GetPulse from './GetPulse.vue'
import UserRelayList from './UserRelayList.vue'
import StatusCheckHistoryNode from './StatusCheckHistoryNode.vue'
// import StatusCheckAPI from './StatusCheckAPI.vue'
import GetRelays from './GetRelays.vue'
import CheckNip11 from './CheckNip11.vue'
import HistoryJob from './HistoryJob.vue'
import CheckDNS from './CheckDNS.vue'
import CheckGeo from './CheckGeo.vue'
import GetTopics from './GetTopics.vue'
import CheckP2R from './CheckP2R.vue'
import RelayOperatorJob from './RelayOperatorJob.vue'
import FirstVisit from './FirstVisit.vue'
// import TemplateJob from './TemplateJob.vue'


// import RelayCanonicalsJob from './RelayCanonicalsJob.vue'


export default defineComponent({
  name: "JobQueue",
  components: {
    DetectRegion,
    LoadSeed,
    RefreshJob,
    GetPulse,
    UserRelayList,
    StatusCheckHistoryNode,
    GetRelays,
    CheckNip11,
    HistoryJob,
    CheckDNS,
    CheckGeo,
    GetTopics,
    CheckP2R,
    RelayOperatorJob,
    FirstVisit
  },
  data(){
    return {
      timeout: null,
      currentJob: null,
      AsyncFunction: (async () => {}).constructor
    }
  },
  setup(props){
    const {resultsProp: results} = toRefs(props)
    const {relaysProp: relays} = toRefs(props)
    return { 
      store : setupStore(),
      results: results,
      relays: relays 
    }
  },
  beforeMount(){
    // this.store.prefs.clientSideProcessing = false
  },
  mounted(){
    // this.currentJob = this.store.jobs.getActiveSlug
    // this.processJob()
    // this.timeout = setTimeout(this.tick, 500)
  },
  unmounted(){
    clearTimeout(this.timeout)
  },
  props: {
    resultsProp: {
      type: Object,
      default(){
        return {}
      }
    },
    relaysProp: {
      type: Array,
      default(){
        return []
      }
    },
  },
  methods: {
    async tick(){
      if(this.currentJob === this.store.jobs.getActiveSlug)
        return 
      this.currentJob = this.store.jobs.getActiveSlug
      this.timeout = setTimeout(this.tick, 1000)
    },
    async processJob(){
      if(!(this.store.jobs.active?.handler instanceof Function))
        return 
      if(this.store.jobs.active.handler instanceof this.AsyncFunction)
        await this.store.jobs.active.handler()
      else 
        this.store.jobs.active.handler()
    }
  },
  computed: Object.assign(SharedComputed, {})
});
</script>