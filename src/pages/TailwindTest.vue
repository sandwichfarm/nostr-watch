<template>
<Disclosure as="nav" class="bg-gray-800" v-slot="{ open }">
    <div class="mx-auto max-w-none">
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
        <div class="w-64 flex flex-shrink-0 items-center">
            <span class="block text-center text-slate-50 text-xl">nostr.watch</span>
        </div>
        <div class="hidden sm:ml-6 sm:block">
            <div class="flex space-x-4">
            <a v-for="item in navigation" :key="item.name" :href="item.href" :class="[item.current ? 'bg-gray-900 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white', 'px-3 py-2 rounded-md text-sm font-medium']" :aria-current="item.current ? 'page' : undefined">{{ item.name }}</a>
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

<div class="flex min-h-screen">
    <TransitionRoot :show="sidebarOpened">
    <Dialog as="div" @close="sidebarOpened = false" class="md:hidden">
        <TransitionChild
        enter="transition ease-in-out duration-200 transform"
        enter-from="-translate-x-full"
        enter-to="translate-x-0"
        leave="transition ease-in-out duration-200 transform"
        leave-from="translate-x-0"
        leave-to="-translate-x-full"
        as="template">
        <div class="flex relative z-10 flex-col w-72 h-full bg-gray-50 border-r border-gray-200 md:hidden">
            <button
            @click="sidebarOpened = false"
            class="hover:ring-2 hover:ring-gray-300 flex absolute top-2 right-2 justify-center items-center w-10 h-10 rounded-full focus:outline-none focus:ring-2 focus:ring-gray-600"
            type="button" value="Close sidebar">
            <XIcon class="w-5 h-5"/>
            </button>
            <div class="px-6 pt-8 pb-4">
            <a href="/">
                <ApplicationLogo class="w-48 h-9"/>
            </a>
            </div>

            <div class="overflow-y-auto flex-1">
            <div class="mb-10">
                <h3 class="mx-6 mb-2 text-xs tracking-widest text-gray-400 uppercase">
                Main
                </h3>

                <a v-for="(item, index) in mainNavigation"
                :href="item.href" :key="index" class="flex items-center px-6 py-2.5 text-gray-500 hover:text-orange-600 group">
                <component
                    :is="item.icon"
                    class="mr-2 w-5 h-5 text-gray-400 group-hover:text-orange-500"/>
                {{ item.label }}
                </a>
            </div>
            <div class="mb-10">
                <h3 class="mx-6 mb-2 text-xs tracking-widest text-gray-400 uppercase">
                Library
                </h3>

                <a v-for="(item, index) in libraryNavigation"
                :href="item.href" :key="index" class="flex items-center px-6 py-2.5 text-gray-500 hover:text-orange-600 group">
                <component
                    :is="item.icon"
                    class="mr-2 w-5 h-5 text-gray-400 group-hover:text-orange-500"/>
                {{ item.label }}
                </a>
            </div>
            <div class="mb-10">
                <h3 class="mx-6 mb-2 text-xs tracking-widest text-gray-400 uppercase">
                Following
                </h3>


                <a v-for="(item, index) in following"
                :href="item.href" :key="index" class="flex items-center px-6 py-2.5 text-gray-500 hover:text-orange-600 group">
                <img :src="item.imageUrl" alt="" class="mr-2 w-7 h-7 rounded-full">
                {{ item.label }}
                </a>
            </div>
            </div>
        </div>
        </TransitionChild>
        <TransitionChild
        enter="transition-opacity ease-linear duration-200"
        enter-from="opacity-0"
        enter-to="opacity-100"
        leave="transition-opacity ease-linear duration-200"
        leave-from="opacity-100"
        leave-to="opacity-0"
        as="template">
        <DialogOverlay class="fixed inset-0 bg-gray-600 bg-opacity-50"></DialogOverlay>
        </TransitionChild>
    </Dialog>
    </TransitionRoot>

    <div class="hidden w-64 bg-gray-50 border-r border-gray-200 md:block items-start">
        <h3 class="py-3 uppercase text-xs text-gray-100 bg-gray-800 bg-opacity-80  text-left pl-3">Browse Relays</h3>
        <nav class="space-y-1" aria-label="Sidebar">
            <a v-for="item in relaysNavigation" 
                :key="item.name" 
                href="#" 
                @click="changeTab(index)"
                :class="[item.current ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900', 'group flex items-center px-3 py-2 text-sm font-medium rounded-md']" 
                :aria-current="item.current ? 'page' : undefined">
            <span class="truncate">{{ item.name }}</span>
            <span v-if="item.count" :class="[item.current ? 'bg-white' : 'bg-gray-100 text-gray-600 group-hover:bg-gray-200', 'ml-auto inline-block py-0.5 px-3 text-xs rounded-full']">{{ item.count }}</span>
            </a>
        </nav>

        <h3 class="py-3 uppercase text-xs text-gray-100 bg-gray-800 bg-opacity-80  text-left pl-3">Tools</h3>
        <nav class="space-y-1" aria-label="Sidebar">
            <a v-for="(item, index) in toolsNavigation" 
                :key="item.name" 
                href="#" 
                @click="changeTab(index)"
                :class="[item.current ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900', 'group flex items-center px-3 py-2 text-sm font-medium rounded-md']" 
                :aria-current="item.current ? 'page' : undefined">
            <span class="truncate">{{ item.name }}</span>
            <span v-if="item.count" :class="[item.current ? 'bg-white' : 'bg-gray-100 text-gray-600 group-hover:bg-gray-200', 'ml-auto inline-block py-0.5 px-3 text-xs rounded-full']">{{ item.count }}</span>
            </a>
        </nav>
    </div>

    <div class="flex-1">

    <main>
        <div class="flex bg-slate-100 text-right flex-row-reverse">
            <div class="flex-none h-7">
                Updated 20 seconds ago 
                Next update in 10 minutes
                Update Now
            </div>
            <div class="flex-none h-7">
                test
            </div>
        </div>
        <div class="pt-5 px-4 sm:px-6 lg:px-8">
            <div class="sm:flex sm:items-center">
            <div class="sm:flex-auto">
                <h1 class="text-xl font-semibold text-gray-900">
                    <span class="inline-flex items-center rounded bg-green-500 px-2 py-0.5 text-xs text-indigo-800">
                        166
                    </span>
                    All Relays
                </h1>
                <p class="mt-2 text-sm text-gray-700">A list of all the users in your account including their name, title, email and role.</p>
            </div>
            <div class="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
                <button type="button" class="inline-flex items-center justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:w-auto">Add Relay</button>
            </div>
            </div>
            <div class="mt-8 flex flex-col">
            <div class="-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8">
                <div class="inline-block min-w-full py-2 align-middle md:px-6 lg:px-8">
                <div class="relative overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
                    <div v-if="selectedRelays.length > 0" class="absolute top-0 left-12 flex h-12 items-center space-x-3 bg-gray-50 sm:left-16">
                    <button type="button" class="inline-flex items-center rounded border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-30">Make Yours</button>
                    </div>
                    <table class="min-w-full table-fixed divide-y divide-gray-300">
                    <thead class="bg-gray-50">
                        <tr>
                        <th scope="col" class="relative w-12 px-6 sm:w-16 sm:px-8">
                            <input type="checkbox" class="absolute left-4 top-1/2 -mt-2 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 sm:left-6" :checked="indeterminate || selectedRelays.length === people.length" :indeterminate="indeterminate" @change="selectedRelays = $event.target.checked ? people.map((p) => p.email) : []" />
                        </th>
                        <th scope="col" class="min-w-[12rem] py-3.5 pr-3 text-left text-sm font-semibold text-gray-900">Name</th>
                        <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Title</th>
                        <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Email</th>
                        <th scope="col" class="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Role</th>
                        <th scope="col" class="relative py-3.5 pl-3 pr-4 sm:pr-6">
                            <span class="sr-only">Edit</span>
                        </th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-200 bg-white">
                        <tr v-for="person in people" :key="person.email" :class="[selectedRelays.includes(person.email) && 'bg-gray-50']">
                        <td class="relative w-12 px-6 sm:w-16 sm:px-8">
                            <div v-if="selectedRelays.includes(person.email)" class="absolute inset-y-0 left-0 w-0.5 bg-indigo-600"></div>
                            <input type="checkbox" class="absolute left-4 top-1/2 -mt-2 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 sm:left-6" :value="person.email" v-model="selectedRelays" />
                        </td>
                        <td :class="['whitespace-nowrap py-4 pr-3 text-sm font-medium', selectedRelays.includes(person.email) ? 'text-indigo-600' : 'text-gray-900']">
                            {{ person.name }}
                        </td>
                        <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                            {{ person.title }}
                        </td>
                        <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                            {{ person.email }}
                        </td>
                        <td class="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                            {{ person.role }}
                        </td>
                        <td class="whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                            <a href="#" class="text-indigo-600 hover:text-indigo-900"
                            >Edit<span class="sr-only">, {{ person.name }}</span></a
                            >
                        </td>
                        </tr>
                    </tbody>
                    </table>
                </div>
                </div>
            </div>
            </div>
        </div>
    </main>
   </div>
</div>

  </template>
  
  <script setup>
  /* eslint-disable */
  import { Disclosure, DisclosureButton, DisclosurePanel, Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/vue'
  import { Bars3Icon, BellIcon, XMarkIcon } from '@heroicons/vue/24/outline'
  
  const navigation = [
    { name: 'Relays', href: '#', current: true },
    { name: 'About', href: '#', current: false },
    { name: 'Github', href: '#', current: false },
  ]


  const relaysNavigation = [
  { name: 'All Relays', href: '#', current: true, count: '166' },
  { name: 'Public Relays', href: '#', current: false, count: '106' },
  { name: 'Restricted', href: '#', current: false, count: '30' },
  { name: 'Offline', href: '#', current: false, count: '30' },
  { name: 'Onion', href: '#', current: false, count: '2' },
  { name: 'Yours', href: '#', current: false },
]


const toolsNavigation = [
  { name: 'Network Summary', href: '#', current: true },
  { name: 'Map', href: '#', current: false }
]


import { ref, computed } from 'vue'

const people = [
  {
    name: 'Lindsay Walton',
    title: 'Front-end Developer',
    email: 'lindsay.walton@example.com',
    role: 'Member',
  },
  // More people...
]

const selectedRelays = ref([])
const checked = ref(false)
checked
const indeterminate = computed(() => selectedRelays.value.length > 0 && selectedRelays.value.length < people.length)

</script>

<style scoped>
.active {
 @apply text-black;
 @apply bg-black;
 @apply bg-opacity-10;
}
</style>