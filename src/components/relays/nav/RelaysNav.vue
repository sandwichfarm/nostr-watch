<style scoped>
.router-link-active {
  @apply bg-black/30 rounded-t-md mt-2 font-bold
}
</style>

<template>
  <div class="bg-slate-700 px-2 sm:px-4 lg:px-8 ">
    <div class="lg:flex lg:h-8 mx-auto max-w-7xl h-8">
      <div class="flex md:w-0 lg:w-32 lg:px-8 lg:ml-8 sm:hidden sm:w-0 ">&nbsp;</div>
      <div class="lg:flex lg:px-0">
        <div class="lg:ml-48 lg:flex lg:space-x-2">
          <router-link 
            :to="{name: 'relaysFind'}" 
            class="inline-flex items-center mx-1 text-sm font-medium text-white my-1 rounded-md px-3">
            Browse
          </router-link>
          <!-- <router-link to="/relays/map" class="inline-flex items-center mx-1 text-sm font-medium text-white">Map</router-link> -->
          <router-link 
            :to="{name: 'relaysStats'}" 
            class="inline-flex items-center mx-1 text-sm font-medium text-white my-1 rounded-md px-3">
            Statistics
          </router-link>
          <!-- <a v-for="item in store.layout.getNavGroup(this.navSlug)"
              :key="`subnav-${item.slug}`"
              :href="item.href"
              @click="setActiveContent(item.slug)"
              :class="[isActive(item) ? 'bg-gray-100 text-gray-900' : ' hover:bg-gray-50 hover:text-gray-900', 'group flex items-center px-3 text-sm font-medium']" 
              class="inline-flex items-center mx-1 text-sm font-medium text-white">
              {{ item.name }}
          </a> -->
        </div>
      </div>
      <div class="width-max lg:flex lg:ml-auto">
        <TasksManager
          :resultsProp="results" />
      </div>
      </div>
  </div>
</template>

<script>
import { defineComponent, defineAsyncComponent, toRefs } from 'vue'
import { setupStore } from '@/store'

import RelaysLib from '@/shared/relays-lib.js'
import SharedComputed from '@/shared/computed.js'

import { setupNavData, mountNav, setActiveContent, loadNavContent, routeValid, parseHash, contentIsActive } from '@/shared/hash-router.js'
// import RefreshTask from '@/components/relays/tasks/RefreshTask.vue'

const TasksManager = defineAsyncComponent(() =>
    import("@/components/relays/tasks/TasksManager.vue" /* webpackChunkName: "TasksManager" */)
);

export default defineComponent({
  title: "nostr.watch registry & network status",
  name: 'RelaysNav',
  components: {
    TasksManager,
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
  data(){
    return {}
    // return setupNavData('relays')
  },
  setup(props){
    const {resultsProp: results} = toRefs(props)
    return { 
      store : setupStore(),
      results: results
    }
  },
  updated(){

  },

  beforeMount(){
    //console.log('rightt now', this.store.layout)
    // this.mountNav('section', this.store.layout.getNavGroup('relays'))
  },
  
  mounted(){
    //console.log('mounted in relays find nav')
  },
  methods: Object.assign(RelaysLib, setupNavData, mountNav, setActiveContent, loadNavContent, routeValid, parseHash, contentIsActive),
  computed: SharedComputed,
});
</script>

