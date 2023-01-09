<template>
  <RefreshTask
    v-if="showRefreshRelays"
    v-bind:resultsProp="results" />
  <RelayCanonicalsTask
    v-else-if="showGetRelayCanonicals"
    v-bind:resultsProp="results" />
</template>

<script>
import { defineComponent, toRefs } from 'vue'
import { useRoute } from 'vue-router'

import { setupStore } from '@/store'

import SharedComputed from '@/shared/computed.js'

import RefreshTask from './RefreshTask.vue'

export default defineComponent({
  name: "TasksManager",
  components: {
    RefreshTask
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
    this.store.tasks.$subscribe( (mutation) => {
      console.log('mutation', mutation.events)
      if(mutation.events.key === 'currentTask')
        this.processJob()
    })
    this.processJob()
  },
  props: {
    resultsProp: {
      type: String,
      default: "Tooltip text",
    },
  },
  methods: {
    processJob(){
      console.log('trying processJob()')
      if(!this.store.tasks.active?.handler)
        return 
      console.log('processJob()', this.store.tasks.active.id)
      this.store.tasks.active.handler()
    }
  },
  computed: Object.assign(SharedComputed, {
    path: function() { return useRoute().path },
    showRefreshRelays: function(){
      return ( 
                this.path.includes('/relays/find')
                || this.path.includes(`/relay/`)
              ) 
              && 
              (
                ( 
                  this.store.tasks.isProcessing('relays') 
                  && this.store.tasks.currentTask == 'relays'
                )
                || 
                (
                  !this.store.tasks.isAnyProcessing
                )
              )
    },
    showGetRelayCanonicals: function(){
      return (
              ( 
                this.store.tasks.isProcessing('relays/canonicals') 
                && this.store.tasks.currentTask == 'relays/canonicals'
              )
              || 
              (
                !this.store.tasks.isAnyProcessing
              )
            )
            &&
            this.isExpired('relays/canonicals')
    }
  })
});
</script>