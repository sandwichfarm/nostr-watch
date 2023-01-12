<template>
  <div class="bg-slate-700 px-2 sm:px-4 lg:px-8 ">
    <div class="lg:flex lg:h-8 mx-auto max-w-7xl h-8">
      <div class="flex lg:w-32 lg:px-8 lg:ml-8 sm:hidden sm:w-0 md:w-0"></div>
      <div class="lg:flex lg:px-0">
        <div class="lg:ml-6 lg:flex lg:space-x-8">
          <!-- <router-link to="/relays/find" :class="isActive ? 'bg-color-white-100 text-white' : inactiveClass" class="inline-flex items-center mx-1 text-sm font-medium text-white">Relays</router-link> -->
          <!-- <router-link to="/relays/map" class="inline-flex items-center mx-1 text-sm font-medium text-white">Map</router-link> -->
          <!-- <router-link to="/relays/statistics" class="inline-flex items-center mx-1 text-sm font-medium text-white">Go to Foo</router-link> -->
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
  },
  data(){
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