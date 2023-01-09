<template>
  <RefreshTask
    v-bind:resultsProp="results" />
  <!-- <RelayCanonicalsTask
    :resultsProp="results" />
  <RelayOperatorTask
    :resultsProp="results" /> -->
</template>

<script>
import { defineComponent, toRefs } from 'vue'
import { useRoute } from 'vue-router'

import { setupStore } from '@/store'

import SharedComputed from '@/shared/computed.js'

import RefreshTask from './RefreshTask.vue'
// import RelayCanonicalsTask from './RelayCanonicalsTask.vue'
// import RelayOperatorTask from './RelayOperatorTask.vue'

export default defineComponent({
  name: "TasksManager",
  components: {
    RefreshTask,
    // RelayCanonicalsTask,
    // RelayOperatorTask
  },
  data(){
    return {
      interval: null
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
    this.interval = setInterval( () => {
      if(this.store.tasks.currentTask)
      this.processJob()
    }, 1000)
    this.processJob()
  },
  unmounted(){
    clearInterval(this.interval)
  },
  props: {
    resultsProp: {
      type: String,
      default: "Tooltip text",
    },
  },
  methods: {
    processJob(){
      // console.log('trying processJob()')
      if(!this.store.tasks.active?.handler)
        return 
      // console.log('processJob()', this.store.tasks.active.id)
      this.store.tasks.active.handler()
    }
  },
  computed: Object.assign(SharedComputed, {
    path: function() { return useRoute().path },
  })
});
</script>