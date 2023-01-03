<template>
    <Disclosure as="nav" class="bg-white mb-5" v-slot="{ open }">
    <div class="mx-auto max-w-7xl px-0">
      <div class="flex h-12 justify-between">
        <div class="flex px-2 lg:px-0">
          <div class="hidden lg:flex lg:space-x-2">
            <a v-for="item in store.layout.getNavGroup(this.navSlug)"
                :key="`subnav-${item.slug}`"
                :href="item.href" 
                @click="setActive(this.navSlug, item.slug)"
                :class="[isActive(item) ? 'bg-slate-500 text-white' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900', 'group flex items-center px-3 py-2 text-sm font-medium']" 
                class="inline-flex items-center pt-1.5 text-sm font-medium">
                {{ item.name }}
            </a>
          </div>
        </div>
        <div class="flex flex-1 items-center justify-center px-2 lg:ml-6 lg:justify-end">
          <div class="w-full max-w-lg lg:max-w-xs">
            <label for="relay-filter" class="sr-only">Filter Relays</label>
            <div class="relative">
              <div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <MagnifyingGlassIcon class="h-5 w-5 text-gray-400" aria-hidden="true" />
              </div>
              <input id="relay-filter" name="relay-filter" class="block w-full rounded-md border border-gray-300 bg-white py-2 pl-10 pr-3 leading-5 placeholder-gray-500 focus:border-indigo-500 focus:placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-indigo-500 sm:text-sm" placeholder="Filter Relays" type="search" />
            </div>
          </div>
        </div>
        <div class="flex items-center lg:hidden">
          <!-- Mobile menu button -->
          <DisclosureButton class="inline-flex items-center justify-center rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500">
            <span class="sr-only">Open main menu</span>
            <Bars3Icon v-if="!open" class="block h-6 w-6" aria-hidden="true" />
            <XMarkIcon v-else class="block h-6 w-6" aria-hidden="true" />
          </DisclosureButton>
        </div>
      </div>
    </div>
    <DisclosurePanel class="lg:hidden">
    <div class="space-y-1 pt-2 pb-3">
        <!-- Current: "bg-indigo-50 border-indigo-500 text-indigo-700", Default: "border-transparent text-gray-600 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-800" -->
        <DisclosureButton 
            v-for="item in store.layout.getNavGroup(this.navSlug)"
            :key="`subnav-${item.slug}`"
            @click="setActive(this.navSlug, item.slug)"
            :class="[isActive(item) ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900', 'group flex items-center px-3 py-2 text-sm font-medium']" 
            as="a" 
            :href="item.href" 
            class="block border-l-4 border-indigo-500 bg-indigo-50 py-2 pl-3 pr-4 text-base font-medium text-indigo-700">
            {{  item.name  }}
        </DisclosureButton>
    </div>
    </DisclosurePanel>
  </Disclosure>
</template>

<script>
import { defineComponent } from 'vue'
import { items } from './config/find-pagenav.yaml'
import { setupStore } from '@/store'
import { Disclosure, DisclosureButton, DisclosurePanel } from '@headlessui/vue'
import { MagnifyingGlassIcon } from '@heroicons/vue/20/solid'
import { Bars3Icon, XMarkIcon } from '@heroicons/vue/24/outline'

import RelaysLib from '@/shared/relays-lib.js'


export default defineComponent({
  title: "nostr.watch registry & network status",
  name: 'NavComponent',
  components: {
    Disclosure, DisclosureButton, DisclosurePanel,
    MagnifyingGlassIcon,
    Bars3Icon, XMarkIcon
    // PreferencesComponent,
    // AuthComponent
  },
  props: {},
  data(){
    return {
        active: null,
        // groups: new Set(items.map( item => item.slug )),
        sidebar: [],
        navSlug: 'relays-find-pagenav'
    }
  },
  setup(){
    return { 
      store : setupStore()
    }
  },
  updated(){

  },
  mounted(){
    this.active = this.store.layout.getActive(this.navSlug)
    this.store.layout.setNavItems(this.navSlug, items)
    this.sidebar = this.store.layout.getNavGroup(this.navSlug)
    this.loadPageContent('subsection')

    // this.sidebar['relays'].map(item => {
    //     item.count = this.store.relays.getCount(item.slug)
    //     // console.log('mapping', item.slug, this.store.relays.getCount(item.slug))
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
        return true
    },
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