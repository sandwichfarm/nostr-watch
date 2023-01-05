<template>
  <div class="bg-slate-700 px-2 sm:px-4 lg:px-8 ">
    <div class="lg:flex lg:h-8 mx-auto max-w-7xl h-16">
      <div class="flex lg:w-32 lg:px-8 lg:ml-8 sm:px-0 sm:w-0 md:w-0"></div>
      <div class="lg:flex lg:px-0">
        <div class="lg:ml-6 lg:flex lg:space-x-8">
          <a v-for="item in store.layout.getNavGroup(this.navSlug)"
              :key="`subnav-${item.slug}`"
              :href="item.href"
              @click="setActiveContent(item.slug)"
              :class="[isActive(item) ? 'bg-gray-100 text-gray-900' : ' hover:bg-gray-50 hover:text-gray-900', 'group flex items-center px-3 text-sm font-medium']" 
              class="inline-flex items-center mx-1 text-sm font-medium text-white">
              {{ item.name }}
          </a>
        </div>
      </div>
      <div class="width-max lg:flex lg:ml-auto">
          <RefreshComponent
            v-bind:resultsProp="results" />
        </div>
      </div>
  </div>
</template>

<script>
import { defineComponent, toRefs } from 'vue'
import { items } from './config/subnav.yaml'
import { setupStore } from '@/store'

import RelaysLib from '@/shared/relays-lib.js'
import { setupNavData, mountNav, setActiveContent, loadNavContent, routeValid, parseHash, contentIsActive } from '@/shared/hash-router.js'
import RefreshComponent from '@/components/relays/RefreshComponent.vue'

export default defineComponent({
  title: "nostr.watch registry & network status",
  name: 'NavComponent',
  components: {
    // PreferencesComponent,
    // AuthComponent
    RefreshComponent,
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
    return setupNavData('relays')
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
    this.mountNav('section', items)
  },
  
  mounted(){
    
  },
  methods: Object.assign(RelaysLib, { mountNav, setActiveContent, loadNavContent, routeValid, parseHash, contentIsActive }),
  computed: {
    isActive(){
        return (item) => item.slug==this.navActiveContent
    }
  },
});
</script>