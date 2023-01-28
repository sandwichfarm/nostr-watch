<template>
  <HeartbeatTask 
    v-bind:resultsProp="results" />
  <LoadSeed 
    v-bind:resultsProp="results" />
  <RefreshTask
    v-bind:resultsProp="results" />
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

import LoadSeed from './LoadSeed.vue'
import RefreshTask from './RefreshTask.vue'
import HeartbeatTask from './HeartbeatTask.vue'
import UserRelayList from './UserRelayList.vue'

// import RelayCanonicalsTask from './RelayCanonicalsTask.vue'
// import RelayOperatorTask from './RelayOperatorTask.vue'

export default defineComponent({
  name: "TasksManager",
  components: {
    LoadSeed,
    RefreshTask,
    HeartbeatTask,
    UserRelayList,
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
  beforeMount(){
    //https://github.com/iendeavor/pinia-plugin-persistedstate-2/issues/136
    this.store.tasks.active = new Array()
    this.store.tasks.pending = new Array()
    this.store.tasks.completed = new Array()
  },
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
      // console.log('trying processJob()')
      if(!this.store.tasks.active?.handler)
        return 
      this.store.tasks.active.handler()
    }
  },
  computed: Object.assign(SharedComputed, {})
});
</script>