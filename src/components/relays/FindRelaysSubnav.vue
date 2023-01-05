<template>
    <Disclosure as="nav" class="bg-white mb-5" v-slot="{ open }">
    <div class="mx-auto max-w-7xl px-0">
      <div class="flex h-12 justify-between">
        <div class="flex px-2 lg:px-0">
          <div class="hidden lg:flex lg:space-x-2">
            <a v-for="item in store.layout.getNavGroup(this.navSlug)"
                :key="`subnav-${item.slug}`"
                :href="item.href" 
                @click="setActiveContent(item.slug)"
                :class="[isActive(item) ? 'bg-slate-500 text-white' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900', 'group flex items-center px-3 py-2 text-sm font-medium']" 
                class="inline-flex items-center pt-1.5 text-sm font-medium">
                {{ item.name }}
            </a>
          </div>
        </div>
        <div class="flex flex-1 items-center justify-center px-2 lg:ml-6 lg:justify-end">
          <ToolFilter />
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
            @click="setActiveContent(item.slug)"
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
//vue
import { defineComponent } from 'vue'
//pinia
import { setupStore } from '@/store'
//components 
import ToolFilter from '@/components/relays/ToolFilter.vue'
//nav conf
import { items } from './config/find-pagenav.yaml'
//shared methods 
import RelaysLib from '@/shared/relays-lib.js'
//hash router
import { setupNavData, mountNav, setActiveContent, loadNavContent, routeValid, parseHash, contentIsActive } from '@/shared/hash-router.js'
//tailwind
import { Disclosure, DisclosureButton, DisclosurePanel } from '@headlessui/vue'
import { Bars3Icon, XMarkIcon } from '@heroicons/vue/24/outline'

export default defineComponent({
  title: "nostr.watch registry & network status",
  name: 'FindRelaysSubnav',
  components: {
    ToolFilter,
    Disclosure, DisclosureButton, DisclosurePanel,
    Bars3Icon, XMarkIcon,
    // PreferencesComponent,
    // AuthComponent
  },
  props: {},
  data(){
    return setupNavData('relays/find')
  },
  setup(){
    return { 
      store : setupStore()
    }
  },
  updated(){

  },
  created(){
    this.mountNav('subsection', items)
  },
  mounted(){
    
  },
  methods: Object.assign(RelaysLib, { mountNav, setActiveContent, loadNavContent}),

  computed: {
    isActive(){
        return (item) => item.slug==this.navActiveContent
    },
    contentIsActive,
    routeValid,
    parseHash
  },
});
</script>