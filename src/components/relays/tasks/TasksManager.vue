<template>
  <DetectRegion 
    v-if="store.prefs.autoDetectRegion" />
  <StatusCheckHistoryNode />
  <HeartbeatTask />
  <LoadSeed 
    v-bind:resultsProp="results"
    v-if="!store.prefs.clientSideProcessing || isSingle" />
  <RefreshTask
    v-bind:resultsProp="results"
    v-if="store.prefs.clientSideProcessing || isSingle" />
  <GetTopics
    v-if="store.prefs.clientSideProcessing || !isSingle" /> /> 
  <UserRelayList />
  <!-- <RelayCanonicalsTask
    :resultsProp="results" />
  <RelayOperatorTask
    :resultsProp="results" /> -->
</template>

<script>
import { defineComponent, toRefs } from 'vue'

import { setupStore } from '@/store'

import SharedComputed from '@/shared/computed.js'

import DetectRegion from './DetectRegion.vue'
import LoadSeed from './LoadSeed.vue'
import RefreshTask from './RefreshTask.vue'
import HeartbeatTask from './HeartbeatTask.vue'
import UserRelayList from './UserRelayList.vue'
import StatusCheckHistoryNode from './StatusCheckHistoryNode.vue'

// import RelayCanonicalsTask from './RelayCanonicalsTask.vue'
// import RelayOperatorTask from './RelayOperatorTask.vue'

export default defineComponent({
  name: "TasksManager",
  components: {
    DetectRegion,
    LoadSeed,
    RefreshTask,
    HeartbeatTask,
    UserRelayList,
    StatusCheckHistoryNode,
    // RelayCanonicalsTask,
    // RelayOperatorTask
  },
  data(){
    return {
      interval: null,
      currentTask: null
    }
  },
  setup(props){
    const {resultsProp: results} = toRefs(props)
    return { 
      store : setupStore(),
      results: results
    }
  },
  beforeMount(){},
  mounted(){
    this.currentTask = this.store.tasks.currentTask
    this.interval = setInterval( () => {
      if(this.currentTask === this.store.tasks.currentTask)
        return 
      this.processJob()
      this.currentTask = this.store.tasks.currentTask
    }, 1000)
    this.processJob()
  },
  unmounted(){
    clearInterval(this.interval)
  },
  props: {
    resultsProp: {
      type: Object,
      default(){
        return {}
      }
    },
  },
  methods: {
    processJob(){
      if(!this.store.tasks.active?.handler)
        return 
      this.store.tasks.active.handler()
    }
  },
  computed: Object.assign(SharedComputed, {})
});
</script>