<template>
  <div class="bg-slate-700 px-2 sm:px-4 lg:px-8 ">
    <div class="lg:flex lg:h-8 mx-auto max-w-7xl h-16">
      <div class="flex lg:w-32 lg:px-8 lg:ml-8 sm:px-0 sm:w-0 md:w-0"></div>
      <div class="lg:flex lg:px-0">
        <div class="lg:ml-6 lg:flex lg:space-x-8">
          <a v-for="item in store.layout.getNavGroup(this.navSlug)"
              :key="`subnav-${item.slug}`"
              :href="item.href"
              @click="setActive(this.navSlug, item.slug)"
              :class="[isActive(item) ? 'bg-gray-100 text-gray-900' : ' hover:bg-gray-50 hover:text-gray-900', 'group flex items-center px-3 text-sm font-medium']" 
              class="inline-flex items-center mx-1 text-sm font-medium text-white">
              {{ item.name }}
          </a>
        </div>
      </div>
      <div class="width-max lg:flex lg:ml-auto ">
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
    return {
        active: null,
        // groups: new Set(items.map( item => item.slug )),
        sidebar: [],
        navSlug: 'relays-subnav'
    }
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
  mounted(){
    this.store.layout.setNavItems(this.navSlug, items)
    this.active = this.store.layout.getActive(this.navSlug)
    console.log('active item', this.active)
    console.log('state from subnav', this.active, this.store.layout.getActive(this.navSlug))
    this.loadPageContent('section')
    
    // this.sidebar = this.store.layout.getNavGroup(this.navSlug)

    // this.sidebar['relays'].map(item => {
    //     item.count = this.store.relays.getCount(item.slug)
    //     console.log('mapping', item.slug, this.store.relays.getCount(item.slug))
    //     return item
    // })

    // this.store.relays.$subscribe( (mutation) => {
    // //   console.log('relays mutation', mutation)
    //   if(this.groups.has(mutation.events.key)) {
    //     this.sidebar = this.sidebar.map( item => {
    //         if(item.slug == mutation.events.key) {
    //             item.count = mutation.events.newValue
    //             console.log('ok', item.count)
    //         }
    //         return item
    //     })  
    //   }
    // })
  },
  methods: Object.assign(RelaysLib, {
    setActive(section, slug){
        this.active = slug
        this.store.layout.setActive(section, slug)
    },
    loadPageContent(which){
      const route = this.parseRouterHash()
      console.log(`route from ${which}`, route)
      if(route[which])
        this.setActive(this.navSlug, route[which])
      else 
        this.active = this.store.layout.getActive(this.navSlug)
    }
  }),
  computed: {
    isActive(){
        return (item) => item.slug==this.active
    }
  },
//   watch: {
//     active(n){
//         console.log('ok', n)
//     }
//   }
});
</script>