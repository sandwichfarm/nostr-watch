<template>
  <Disclosure as="nav" class="bg-gray-800" v-slot="{ open }">
    <!-- <div class="mx-auto max-w-none"> -->
    <div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
      <div class="relative flex h-16 items-center mx-3 justify-between">
          <div class="absolute inset-y-0 left-0  flex items-center sm:hidden">
          <!-- Mobile menu button-->
          <DisclosureButton class="inline-flex items-center justify-center rounded-md p-2 text-gray-400 hover:bg-gray-700 hover:text-white focus:outline-none focus:ring-2 focus:ring-inset focus:ring-white">
              <span class="sr-only">Open main menu</span>
              <Bars3Icon v-if="!open" class="block h-6 w-6" aria-hidden="true" />
              <XMarkIcon v-else class="block h-6 w-6" aria-hidden="true" />
          </DisclosureButton>
          </div>
          <div class="flex flex-1 items-center justify-center sm:items-stretch sm:justify-start">
          <div class="w-32 flex flex-shrink-0 items-center">
              <span class="block text-center text-slate-50 text-xl">nostr.watch</span>
          </div>
          <div class="hidden sm:ml-6 sm:block">
              <div class="flex space-x-4">
              <router-link 
                to="/"
                :class="[!isActive ? 'bg-gray-900 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white', 'px-3 py-2 rounded-md text-sm font-medium']" >
                Relays
              </router-link>
              <!-- <router-link to="/about">about</router-link>
              <a
                href="/" 
                
                :aria-current="item.current ? 'page' : undefined">
                  {{ item.name }}
              </a> -->
              </div>
          </div>
          </div>
          <div class="absolute inset-y-0 right-0 flex items-center pr-2 sm:static sm:inset-auto sm:ml-6 sm:pr-0">

          <!-- Profile dropdown -->
          <Menu as="div" class="relative ml-3">
              <div>
              <MenuButton class="flex rounded-full bg-gray-800 text-sm focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-gray-800">
                  <span class="sr-only">Open user menu</span>
                  <img class="h-8 w-8 rounded-full" src="https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?ixlib=rb-1.2.1&ixid=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=2&w=256&h=256&q=80" alt="" />
              </MenuButton>
              </div>
              <transition enter-active-class="transition ease-out duration-100" enter-from-class="transform opacity-0 scale-95" enter-to-class="transform opacity-100 scale-100" leave-active-class="transition ease-in duration-75" leave-from-class="transform opacity-100 scale-100" leave-to-class="transform opacity-0 scale-95">
              <MenuItems class="absolute right-0 z-10 mt-2 w-48 origin-top-right rounded-md bg-white py-1 shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none">
                  <MenuItem v-slot="{ active }">
                  <a href="#" :class="[active ? 'bg-gray-100' : '', 'block px-4 py-2 text-sm text-gray-700']">Your Profile</a>
                  </MenuItem>
                  <MenuItem v-slot="{ active }">
                  <a href="#" :class="[active ? 'bg-gray-100' : '', 'block px-4 py-2 text-sm text-gray-700']">Settings</a>
                  </MenuItem>
                  <MenuItem v-slot="{ active }">
                  <a href="#" :class="[active ? 'bg-gray-100' : '', 'block px-4 py-2 text-sm text-gray-700']">Sign out</a>
                  </MenuItem>
              </MenuItems>
              </transition>
          </Menu>
          </div>
      </div>
    </div>

    <DisclosurePanel class="sm:hidden">
    <div class="space-y-1 px-2 pt-2 pb-3">
        <DisclosureButton v-for="item in navigation" :key="item.name" as="a" :href="item.href" :class="[item.current ? 'bg-gray-900 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white', 'block px-3 py-2 rounded-md text-base font-medium']" :aria-current="item.current ? 'page' : undefined">{{ item.name }}</DisclosureButton>
    </div>
    </DisclosurePanel>
</Disclosure>
</template>
<style scoped>
nav.menu {
  position:relative;
  z-index:10;
}
nav span,
nav.menu a {
  display: inline-block;
}

nav.menu a { 
  text-decoration: none;
  margin: 0 22px 0 0;
  padding:5px 10px;
  color:#000;
  border-bottom: 1px dotted #999;
}

nav.menu a.active { 
  background:#000 !important;
  color: #fff;
  border: none;
}

nav.menu a:hover { 
  background: #f0f0f0;
}

</style>

<script setup>
/* eslint-disable */
import { Disclosure, DisclosureButton, DisclosurePanel, Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/vue'
import { Bars3Icon, BellIcon, XMarkIcon } from '@heroicons/vue/24/outline'
</script>

<script>
import { defineComponent } from 'vue'
import PreferencesComponent from '../PreferencesComponent.vue'
import AuthComponent from '../AuthComponent.vue'
// import { items as navigation } from '@/data/nav-main.yaml'
import { setupStore } from '@/store'

export default defineComponent({
  title: "nostr.watch registry & network status",
  name: 'NavComponent',
  components: {
    PreferencesComponent,
    AuthComponent
  },
  props: {},
  setup(){
    return { 
      store : setupStore()
    }
  },
});
</script>
