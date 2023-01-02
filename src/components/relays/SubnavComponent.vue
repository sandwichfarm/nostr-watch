<template>
  <div class="bg-slate-700 px-2 sm:px-4 lg:px-8 ">
    <div class="flex h-8 mx-auto max-w-7xl">
      <div class="flex w-32 px-8 ml-8"></div>
      <div class="flex lg:px-0">
        <div class="lg:ml-6 lg:flex lg:space-x-8">
          <a v-for="item in store.layout.getNavGroup(this.navSlug)"
              :key="`subnav-${item.slug}`"
              href="#" 
              @click="setActive(this.navSlug, item.slug)"
              :class="[isActive(item) ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900', 'group flex items-center px-3 text-sm font-medium']" 
              class="inline-flex items-center mx-1 text-sm font-medium text-gray-900">
              {{ item.name }}
          </a>
        </div>
      </div>
      <div class="flex ml-auto">
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
  methods: {
    setActive(section, slug){
        this.active = slug
        this.store.layout.setActive(section, slug)
    },

  },
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