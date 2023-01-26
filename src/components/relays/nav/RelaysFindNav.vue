<template>
  <div>
  <Disclosure as="nav" id="subsection_nav" class="bg-white dark:bg-transparent mb-5 dark:text-white" v-slot="{ open }">
  <div class="mx-auto max-w-7xl px-0">
    <div class="flex h-12 justify-center md:justify-between">
      <div class="flex px-2 lg:px-0">
        <div class="hidden md:flex md:space-x-2 lg:flex lg:space-x-2">
          <a v-for="item in store.layout.getNavGroup(this.navSlug)"
              :key="`subnav-${item.slug}`"
              :href="item.href" 
              @click="setActiveContent(item.slug)"
              class="inline-flex items-center"
              :class="getNavButtonClass(item.slug)">
              {{ item.name }}
          </a>
        </div>
      </div>
      <div class="hidden md:flex md:flex-1 items-center justify-center px-2 lg:ml-6 lg:justify-end">
        <!-- <RelaysSearchFilter /> -->
      </div>
      <div class="flex justify-center md:hidden lg:hidden">
        <!-- Mobile menu button -->
        <DisclosureButton class="inline-flex items-center rounded-md p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-black/50 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500">
          <span>Menu</span>
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
          :class="getNavButtonClass(item.slug)"
          as="a" 
          :href="item.href" 
          class="block border-l-4 border-indigo-500 bg-indigo-50 py-2 pl-3 pr-4 text-base font-medium text-indigo-700">
          {{  item.name  }}
      </DisclosureButton>
      <!-- :class="[isActive(item) ? 'bg-gray-100 text-gray-900 dark:bg-black/50' : 'text-gray-600 hover:bg-gray-50 hover:bg-black/50 hover:text-gray-900', 'group flex items-center px-3 py-2 text-sm font-medium']"  -->
  </div>
  </DisclosurePanel>
</Disclosure>
</div>
</template>

<script>
//vue
import { defineComponent } from 'vue'
//pinia
import { setupStore } from '@/store'
//components 
// import RelaysSearchFilter from '@/components/relays/blocks/RelaysSearchFilter.vue'
//nav conf
import { items } from './config/relays.find.yaml'
//shared methods 
import RelaysLib from '@/shared/relays-lib.js'
//hash router
import { setupNavData, mountNav, setActiveContent, loadNavContent, routeValid, parseHash, contentIsActive } from '@/shared/hash-router.js'
//tailwind
import { Disclosure, DisclosureButton, DisclosurePanel } from '@headlessui/vue'
import { Bars3Icon, XMarkIcon } from '@heroicons/vue/24/outline'

export default defineComponent({
title: "nostr.watch registry & network status",
name: 'RelaysFindNav',
components: {
  // RelaysSearchFilter,
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
  contentIsActive,
  // isActive: () => (slug) => this.contentIsActive(slug),
  routeValid,
  parseHash,
  getNavButtonClass(){
    return (slug) => {
      // //console.log('active?', this.contentIsActive(slug), this.isActive(slug), this.store.layout.getActive('relays/find'), this.store.layout.getActiveItem == slug)
      return { 
        // 'opacity-10' : this.store.layout.editorExpanded,
        'dark:hover:bg-black/80 dark:text-white/80': true,
        'py-1 px-2': this.store.prefs.getTheme === 'compact',
        'text-lg py-2 px-3': this.store.prefs.getTheme === 'comfortable',
        'text-xl py-3 px-4': this.store.prefs.getTheme === 'spacious',
        'bg-slate-800 text-white hover:text-white dark:hover:bg-black/80 dark:bg-black/50': this.contentIsActive(slug),
        'text-gray-600 hover:bg-gray-50 hover:text-gray-900': !this.contentIsActive(slug),
      }
    }
  }
},
});
</script>