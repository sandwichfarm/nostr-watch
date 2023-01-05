<template>
<div class="pt-5 px-1 sm:px-6 lg:px-8">
  <div class="sm:flex sm:items-center">
    <div class="sm:flex-auto text-left">
        <h1 class="text-4xl capitalize font-semibold text-gray-900">
            <span class="inline-flex rounded bg-green-800 text-sm px-2 py-1 text-white relative -top-2">
                {{ relaysCount[activeSubsection] }}
            </span>
            {{ activeSubsection }} Relays
        </h1>
        <p class="mt-2 text-xl text-gray-700">
            <!-- {{ store.layout.getActiveItem('relays/find') }} -->
            {{ store.layout.getActiveItem('relays/find')?.description }}
        </p>
    </div>
    <div class="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
        <button 
            @click="$router.push('/relays/add')" 
            type="button" 
            class="inline-flex items-center justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-m font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:w-auto">
            Add Relay
        </button>
    </div>
    </div>
    <div class="mt-8 flex flex-col">
    <FindRelaysSubnav />
  </div>
</div>

    <div 
    v-for="subsection in navSubsection"
            :key="subsection.slug" > 

        <!-- <div v-if="section.slug == activeSubsection"> -->
        <div v-if="subsection.slug == activeSubsection">
        <ListClearnet
            :resultsProp="results"
            :subsectionProp="subsection.slug"
            v-bind:relaysCountProp="relaysCount"
            /> 
        </div>
    </div>
</template>
<script>
    //vue
    import { defineComponent, toRefs } from 'vue'
    //pinia
    import { setupStore } from '@/store'
    //shared methods
    import RelaysLib from '@/shared/relays-lib.js'
    import { parseHash } from '@/shared/hash-router.js'
    //components
    import FindRelaysSubnav from '@/components/relays/FindRelaysSubnav.vue'
    import ListClearnet from '@/components/relays/ListClearnet.vue'

    const localMethods = {}

    export default defineComponent({
      name: 'HomePage',

      components: {
        ListClearnet,
        FindRelaysSubnav,
      },

      setup(props){
        const {resultsProp: results} = toRefs(props)
        return { 
          store : setupStore(),
          results: results
        }
      },

      props: {
        resultsProp: {
          type: Object,
          default: () => {}
        }
      },

      data() {
        return {
          relays: [],
          timeouts: {},
          intervals: {},
          relaysCount: {},
          // activeSection: this.routeSection || this.store.layout.getActiveItem('relays')?.slug,
          // activeSubsection: this.routeSubsection || this.store.layout.getActiveItem(`relays/${this.activeSection}`)?.slug,
        }
      },

      updated(){},

      beforeMount(){
        this.routeSection = this.parseHash.section || false
        this.routeSubsection = this.parseHash.subsection || false
      },

      async mounted() {
        this.navSubsection.forEach( item => this.relaysCount[item.slug] = 0 ) //move this
        // this.relaysMountNav()
      },

      computed: {
        activeSection: function(){ return this.store.layout.getActiveItem('relays')?.slug },
        activeSubsection: function(){ return this.store.layout.getActiveItem(`relays/${this.activeSection}`)?.slug },
        navSubsection: function() { return this.store.layout.getNavGroup(`relays/${this.activeSection}`) || [] },
        parseHash
      },

      methods: Object.assign(RelaysLib, localMethods), 

    })
</script>