<style scoped>
.router-link-active {
  @apply bg-black/30 rounded-t-md mt-2 font-bold
}
</style>

<template>
  <div class="bg-slate-700 px-2 sm:px-4 lg:px-8 ">
    <div class="lg:flex lg:h-8 mx-auto max-w-7xl h-8">
      <div class="hidden lg:flex md:w-0 lg:w-40 lg:ml-8">
        <NostrWatchStatus />
      </div>
      <div class="lg:flex lg:px-0">
        <div class="block md:flex lg:space-x-2 text-center items-center content-center" v-if="!pendingFirstCompletion">
          <router-link 
            :to="{name: 'relaysFind'}" 
            class=" mx-1 my-1 px-3 inline-block lg:inline-flex items-center text-sm font-medium text-white rounded-md">
            Browse
          </router-link>
          <router-link 
            
            :to="{name: 'relaysStats'}" 
            class="mx-1 my-1 px-3 inline-block md:inline-flex  items-center text-sm font-medium text-white  rounded-md ">
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
        <JobQueue
          v-bind:relaysProp="relays" 
          />
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
// import RefreshJob from '@/components/relays/jobs/RefreshJob.vue'

const JobQueue = defineAsyncComponent(() =>
    import("@/components/relays/jobs/JobQueue.vue" /* webpackChunkName: "JobQueue" */)
);

const NostrWatchStatus = defineAsyncComponent(() =>
    import("@/components/partials/NostrWatchStatus.vue" /* webpackChunkName: "NostrWatchStatus" */)
);

export default defineComponent({
  title: "nostr.watch registry & network status",
  name: 'RelaysNav',
  components: {
    JobQueue,
    NostrWatchStatus,
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

