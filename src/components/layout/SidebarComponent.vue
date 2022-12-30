<template>
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
                    Browse Relays
                    </h3>

                    <a v-for="(item, index) in store.layout.getSidebarGroup('relays')"
                    :href="item.href" :key="index" class="flex items-center px-6 py-2.5 text-gray-500 hover:text-orange-600 group">
                    <component
                        :is="item.icon"
                        class="mr-2 w-5 h-5 text-gray-400 group-hover:text-orange-500"/>
                    {{ item.label }}
                    </a>
                </div>
                <div class="mb-10">
                    <h3 class="mx-6 mb-2 text-xs tracking-widest text-gray-400 uppercase">
                    Tools
                    </h3>

                    <a v-for="(item, index) in store.layout.getSidebarGroup('tools')"
                    :href="item.href" :key="index" class="flex items-center px-6 py-2.5 text-gray-500 hover:text-orange-600 group">
                    <component
                        :is="item.icon"
                        class="mr-2 w-5 h-5 text-gray-400 group-hover:text-orange-500"/>
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

    <div class="hidden w-64 bg-gray-50 border-slate-200 md:block items-start drop-shadow-lg">
        <h3 class="py-3 uppercase text-xs text-gray-100 bg-gray-800 bg-opacity-80  text-left pl-3">Browse Relays</h3>
        <nav class="space-y-1" aria-label="Sidebar">
            <a v-for="item in store.layout.getSidebarGroup('relays')" 
                :key="item.name" 
                href="#" 
                @click="setActive('relays', item.slug)"
                :class="[isActive(item) ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900', 'group flex items-center px-3 py-2 text-sm font-medium rounded-md']" 
                :aria-current="isActive(item) ? 'page' : undefined">
            <span class="truncate">{{ item.name }}</span>
            <span v-if="item.count" :class="[isActive(item) ? 'bg-white' : 'bg-gray-100 text-gray-600 group-hover:bg-gray-200', 'ml-auto inline-block py-0.5 px-3 text-xs rounded-full']">{{ item.count }}</span>
            </a>
        </nav>

        <h3 class="py-3 uppercase text-xs text-gray-100 bg-gray-800 bg-opacity-80  text-left pl-3">Tools</h3>
        <nav class="space-y-1" aria-label="Sidebar">
            <a v-for="item in store.layout.getSidebarGroup('tools')" 
                :key="item.name" 
                href="#" 
                @click="setActive('tools', item.slug)"
                :class="[isActive(item) ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900', 'group flex items-center px-3 py-2 text-sm font-medium rounded-md']" 
                :aria-current="isActive(item) ? 'page' : undefined">
            <span class="truncate">{{ item.name }}</span>
            <span v-if="item.count" :class="[isActive(item) ? 'bg-white' : 'bg-gray-100 text-gray-600 group-hover:bg-gray-200', 'ml-auto inline-block py-0.5 px-3 text-xs rounded-full']">{{ item.count }}</span>
            </a>
        </nav>
    </div>

</template>

<script>
import { defineComponent } from 'vue'
import { items } from '@/data/nav-sidebar.yaml'
import { setupStore } from '@/store'

export default defineComponent({
  title: "nostr.watch registry & network status",
  name: 'NavComponent',
  components: {
    // PreferencesComponent,
    // AuthComponent
  },
  props: {},
  data(){
    return {
        active: null,
        groups: new Set(items.map( item => item.slug )),
        sidebar: []
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
    this.active = this.store.layout.getActive('relays')
    this.store.layout.setSidebarItems(items)
    this.sidebar = this.store.layout.getSidebar

    this.sidebar['relays'].map(item => {
        item.count = this.store.relays.getCount(item.slug)
        console.log('mapping', item.slug, this.store.relays.getCount(item.slug))
        return item
    })

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
    findActive(){
        const active = this.store.layout.getActive('relays')
        return Object.entries(this.sidebar).filter( item => item[1].slug == active)
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