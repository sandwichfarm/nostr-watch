<template>
<span class="inline-block mr-12 pt-1.5">
  <span class="text-white/40 lg:text-sm mx-2 text-xs font-bold">
    <GetRelays
      v-bind:relaysProp="relays" />

    <DetectRegion 
      v-if="store.prefs.autoDetectRegion && !store.prefs.disableGeoDetection" />

    <StatusCheckHistoryNode />

    <GetPulse />

    <LoadSeed
      v-if="!store.prefs.clientSideProcessing || isSingle" />

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
      
    <CheckGeo v-if="!isSingle" />

    <RefreshTask 
      v-if="store.prefs.clientSideProcessing || isSingle || this.store.prefs.isFirstVisit" />
    
    <CheckP2R v-if="!isSingle" />

    <CheckDNS v-if="!isSingle" />

    <HistoryTask />

    <GetTopics
      v-if="store.prefs.clientSideProcessing && !isSingle" />

    <UserRelayList />

    <FirstVisit 
      v-if="this.store.prefs.isFirstVisit
            && this.store.tasks.getLastUpdate('relays/check') 
            && this.store.tasks.getLastUpdate('relays/seed')
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
import RefreshTask from './RefreshTask.vue'
import GetPulse from './GetPulse.vue'
import UserRelayList from './UserRelayList.vue'
import StatusCheckHistoryNode from './StatusCheckHistoryNode.vue'
// import StatusCheckAPI from './StatusCheckAPI.vue'
import GetRelays from './GetRelays.vue'
import CheckNip11 from './CheckNip11.vue'
import HistoryTask from './HistoryTask.vue'
import CheckDNS from './CheckDNS.vue'
import CheckGeo from './CheckGeo.vue'
import GetTopics from './GetTopics.vue'
import CheckP2R from './CheckP2R.vue'
import FirstVisit from './FirstVisit.vue'
// import TemplateTask from './TemplateTask.vue'


// import RelayCanonicalsTask from './RelayCanonicalsTask.vue'
// import RelayOperatorTask from './RelayOperatorTask.vue'

export default defineComponent({
  name: "TasksManager",
  components: {
    DetectRegion,
    LoadSeed,
    RefreshTask,
    GetPulse,
    UserRelayList,
    StatusCheckHistoryNode,
    GetRelays,
    CheckNip11,
    HistoryTask,
    CheckDNS,
    CheckGeo,
    GetTopics,
    CheckP2R,
    FirstVisit
    // TemplateTask,
    // RelayCanonicalsTask,
    // RelayOperatorTask
  },
  data(){
    return {
      timeout: null,
      currentTask: null,
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
    // this.currentTask = this.store.tasks.getActiveSlug
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
      console.log('pending', this.store.tasks.pending)
      if(this.currentTask === this.store.tasks.getActiveSlug)
        return 
      this.currentTask = this.store.tasks.getActiveSlug
      // await this.processJob()
      this.timeout = setTimeout(this.tick, 1000)
    },
    async processJob(){
      if(!(this.store.tasks.active?.handler instanceof Function))
        return 
      console.log('processJob()', this.store.tasks.active.id, 'type', typeof this.store.tasks.active.handler, 'is async', this.store.tasks.active.handler instanceof this.AsyncFunction)
      if(this.store.tasks.active.handler instanceof this.AsyncFunction)
        await this.store.tasks.active.handler()
      else 
        this.store.tasks.active.handler()
    }
  },
  computed: Object.assign(SharedComputed, {})
});
</script>