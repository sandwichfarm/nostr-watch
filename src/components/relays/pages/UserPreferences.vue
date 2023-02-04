<template>
  <RelaysNav 
    v-bind:resultsProp="results" />

  <div id="wrapper" class="px-8 mx-auto max-w-7xl">  
    <form class="px-2 space-y-8 divide-y divide-gray-200">
      <div class="space-y-8 divide-y divide-gray-200 sm:space-y-5">
        <div class="space-y-6 sm:space-y-5">
          <div class="mt-8 content-left">
            <h1 class="align-left text-4xl capitalize font-semibold text-gray-900 dark:text-white/90">
              User Preferences
            </h1>
          </div>


            <h2 class="text-gray-500 dark:text-white/50 mt-4">Relay Data</h2>  
            <div class="sm:grid sm:grid-cols-3 sm:items-start sm:gap-4 sm:border-t sm:border-gray-200 dark:sm:border-slate-800 sm:pt-5">
              <label for="about" class="block text-sm font-medium text-gray-700 dark:text-gray-300 sm:mt-px sm:pt-2">Client-side processing</label>
              <div class="mt-1 sm:col-span-2 sm:mt-0">
                <Switch
                  v-model="store.prefs.clientSideProcessing"
                  :class="store.prefs.clientSideProcessing ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-black'"
                  class="relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-opacity-75"
                >
                  <span class="sr-only">Use client-side processing</span>
                  <span
                    aria-hidden="true"
                    :class="store.prefs.clientSideProcessing ? 'translate-x-5' : 'translate-x-0'"
                    class="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out"
                  />
                </Switch>
                <p class="mt-2 text-sm text-gray-500">If enabled, checks will run client-side instead of pulling data from nostr.watch history node. The history node is faster, but less accurate, client-side processing is slower, but more accurate.</p>
              </div>
            </div>

            <div 
              class="sm:grid sm:grid-cols-3 sm:items-start sm:gap-4 sm:border-t sm:border-gray-200 dark:sm:border-slate-800 sm:pt-5"
              v-if="store.prefs.clientSideProcessing">
              <label for="about" class="block text-sm font-medium text-gray-700 dark:text-gray-300 sm:mt-px sm:pt-2">
                Auto refresh
              </label>
              <div class="mt-1 sm:col-span-2 sm:mt-0">
                <Switch
                  v-model="store.prefs.refresh"
                  :class="store.prefs.refresh ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-black'"
                  class="relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-opacity-75"
                >
                  <span class="sr-only">Automatically refresh?</span>
                  <span
                    aria-hidden="true"
                    :class="store.prefs.refresh ? 'translate-x-5' : 'translate-x-0'"
                    class="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out"
                  />
                </Switch>
                <p class="mt-2 text-sm text-gray-500">Automatically refresh</p>
              </div>
            </div>

            <div 
              class="sm:grid sm:grid-cols-3 sm:items-start sm:gap-4 sm:border-t sm:border-gray-200 dark:sm:border-slate-800 sm:pt-5"
              v-if="store.prefs.refresh && store.prefs.clientSideProcessing">
              <label for="about" class="block text-sm font-medium text-gray-700 dark:text-gray-300 sm:mt-px sm:pt-2">
                Refresh Interval
              </label>
              <div class="mt-1 sm:col-span-2 sm:mt-0">
                <div class="mt-4 space-y-4">
                  <div class="flex items-center">
                    <input v-model="store.prefs.duration" :value="30*60*1000" id="push-everything" name="push-notifications" type="radio" class="h-4 w-4 border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                    <label for="push-everything" class="ml-3 block text-sm font-medium text-gray-700  dark:text-gray-500">30 minutes</label>
                  </div>
                  <div class="flex items-center">
                    <input v-model="store.prefs.duration" :value="1*60*60*1000" id="push-email" name="push-notifications" type="radio" class="h-4 w-4 border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                    <label for="push-email" class="ml-3 block text-sm font-medium text-gray-700  dark:text-gray-500">1 hour</label>
                  </div>
                  <div class="flex items-center">
                    <input v-model="store.prefs.duration" :value="2*60*60*1000" id="push-nothing" name="push-notifications" type="radio" class="h-4 w-4 border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                    <label for="push-nothing" class="ml-3 block text-sm font-medium text-gray-700 dark:text-gray-500">2 hours</label>
                  </div>
                  <div class="flex items-center">
                    <input v-model="store.prefs.duration" :value="6*60*60*1000" id="push-nothing" name="push-notifications" type="radio" class="h-4 w-4 border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                    <label for="push-nothing" class="ml-3 block text-sm font-medium text-gray-700 dark:text-gray-500">6 hours</label>
                  </div>
                  <div class="flex items-center">
                    <input v-model="store.prefs.duration" :value="12*60*60*1000" id="push-nothing" name="push-notifications" type="radio" class="h-4 w-4 border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                    <label for="push-nothing" class="ml-3 block text-sm font-medium text-gray-700 dark:text-gray-500">12 hours</label>
                  </div>
                  <div class="flex items-center">
                    <input v-model="store.prefs.duration" :value="24*60*60*1000" id="push-nothing" name="push-notifications" type="radio" class="h-4 w-4 border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                    <label for="push-nothing" class="ml-3 block text-sm font-medium text-gray-700 dark:text-gray-500">24 hours</label>
                  </div>
                </div>
                <p class="mt-2 text-sm text-gray-500">How often should nostr.watch recheck relays?</p>
              </div>
            </div>

            <div class="sm:grid sm:grid-cols-3 sm:items-start sm:gap-4 sm:border-t sm:border-gray-200 dark:sm:border-slate-800 sm:pt-5">
              <label for="about" class="block text-sm font-medium text-gray-700 dark:text-gray-300 sm:mt-px sm:pt-2">
                Auto-detect Region
              </label>
              <div class="mt-1 sm:col-span-2 sm:mt-0">
                <Switch
                  v-model="store.prefs.autoDetectRegion"
                  :class="store.prefs.autoDetectRegion ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-black'"
                  class="relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-opacity-75"
                >
                  <span class="sr-only">Auto-detect Region</span>
                  <span
                    aria-hidden="true"
                    :class="store.prefs.autoDetectRegion ? 'translate-x-5' : 'translate-x-0'"
                    class="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out"
                  />
                </Switch>
                <p class="mt-2 text-sm text-gray-500">If enabled, nostr.watch will use your IP to obtain geo-data and pick the best region for you.</p>
              </div>
            </div>

            <div class="sm:grid sm:grid-cols-3 sm:items-start sm:gap-4 sm:border-t sm:border-gray-200 dark:sm:border-slate-800 sm:pt-5" v-if="!store.prefs.autoDetectRegion">
              <label for="about" class="block text-sm font-medium text-gray-700 dark:text-gray-300 sm:mt-px sm:pt-2">
                Auto-detect Region
              </label>
              <div class="mt-4 space-y-4">
                <div class="flex items-center">
                  <input v-model="store.prefs.region" value="us-east" id="push-everything" name="push-notifications" type="radio" class="h-4 w-4 border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                  <label for="push-everything" class="ml-3 block text-sm font-medium text-gray-700  dark:text-gray-500">us-east</label>
                </div>
                <div class="flex items-center">
                  <input v-model="store.prefs.region" value="eu-west" id="push-email" name="push-notifications" type="radio" class="h-4 w-4 border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                  <label for="push-email" class="ml-3 block text-sm font-medium text-gray-700  dark:text-gray-500">eu-west</label>
                </div>
                <div class="flex items-center">
                  <input v-model="store.prefs.region" value="asia-south" id="push-nothing" name="push-notifications" type="radio" class="h-4 w-4 border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                  <label for="push-nothing" class="ml-3 block text-sm font-medium text-gray-700 dark:text-gray-500">asia-south</label>
                </div>
                <div class="flex items-center">
                  <input v-model="store.prefs.region" value="asia-southeast" id="push-nothing" name="push-notifications" type="radio" class="h-4 w-4 border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                  <label for="push-nothing" class="ml-3 block text-sm font-medium text-gray-700 dark:text-gray-500">asia-southeast</label>
                </div>
                <div class="flex items-center">
                  <input v-model="store.prefs.region" value="au" id="push-nothing" name="push-notifications" type="radio" class="h-4 w-4 border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                  <label for="push-nothing" class="ml-3 block text-sm font-medium text-gray-700 dark:text-gray-500">australia</label>
                </div>
                <p class="mt-2 text-sm text-gray-500">The region determines where uptime<span v-if="!store.prefs.clientSideProcessing"> and latency</span> data is pulled from</p>
              </div>
            </div>

            <h2 class="text-gray-500 dark:text-white/50 mt-4">Sorting</h2>
            <div class="sm:grid sm:grid-cols-3 sm:items-start sm:gap-4 sm:border-t sm:border-gray-200 dark:sm:border-slate-800 sm:pt-5">
              <label for="about" class="block text-sm font-medium text-gray-700 dark:text-gray-300 sm:mt-px sm:pt-2">
                Pin Favorites
              </label>
              <div class="mt-1 sm:col-span-2 sm:mt-0 align-left">
                <Switch
                  v-model="store.prefs.pinFavorites"
                  :class="store.prefs.pinFavorites ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-black'"
                  class="relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-opacity-75"
                >
                  <span class="sr-only">Pin Favorites</span>
                  <span
                    aria-hidden="true"
                    :class="store.prefs.pinFavorites ? 'translate-x-5' : 'translate-x-0'"
                    class="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out"
                  />
                </Switch>
                <p class="mt-2 text-sm text-gray-500">Pin favorites to top</p>
              </div>
            </div>

            <div class="sm:grid sm:grid-cols-3 sm:items-start sm:gap-4 sm:border-t sm:border-gray-200 dark:sm:border-slate-800 sm:pt-5">
              <label for="about" class="block text-sm font-medium text-gray-700 dark:text-gray-300 sm:mt-px sm:pt-2">
                Uptime Sorting
              </label>
              <div class="mt-1 sm:col-span-2 sm:mt-0 align-left">
                <Switch
                  v-model="store.prefs.sortUptime"
                  :class="store.prefs.sortUptime ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-black'"
                  class="relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-opacity-75"
                >
                  <span class="sr-only">Uptime Sorting</span>
                  <span
                    aria-hidden="true"
                    :class="store.prefs.sortUptime ? 'translate-x-5' : 'translate-x-0'"
                    class="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out"
                  />
                </Switch>
                <p class="mt-2 text-sm text-gray-500">If enabled, uptime values will be used in multi-dimensional sorting</p>
              </div>
            </div>

            <div class="sm:grid sm:grid-cols-3 sm:items-start sm:gap-4 sm:border-t sm:border-gray-200 dark:sm:border-slate-800 sm:pt-5">
              <label for="about" class="block text-sm font-medium text-gray-700 dark:text-gray-300 sm:mt-px sm:pt-2">
                Latency Sorting
              </label>
              <div class="mt-1 sm:col-span-2 sm:mt-0 align-left">
                <Switch
                  v-model="store.prefs.sortLatency"
                  :class="store.prefs.sortLatency ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-black'"
                  class="relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-opacity-75"
                >
                  <span class="sr-only">Latency Sorting</span>
                  <span
                    aria-hidden="true"
                    :class="store.prefs.sortLatency ? 'translate-x-5' : 'translate-x-0'"
                    class="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out"
                  />
                </Switch>
                <p class="mt-2 text-sm text-gray-500">If enabled, latency values will be used in multi-dimensional sorting</p>
              </div>
            </div>

            <h2 class="text-gray-500 dark:text-white/50 mt-4">Personalization</h2>
            <div class="sm:grid sm:grid-cols-3 sm:items-start sm:gap-4 sm:border-t sm:border-gray-200 dark:sm:border-slate-800 sm:pt-5">
              <label for="about" class="block text-sm font-medium text-gray-700 dark:text-gray-300 sm:mt-px sm:pt-2">
                Show Maps
              </label>
              <div class="mt-1 sm:col-span-2 sm:mt-0">
                <Switch
                  v-model="store.prefs.showMaps"
                  :class="store.prefs.showMaps ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-black'"
                  class="relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-opacity-75"
                >
                  <span class="sr-only">Use client-side processing</span>
                  <span
                    aria-hidden="true"
                    :class="store.prefs.showMaps ? 'translate-x-5' : 'translate-x-0'"
                    class="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out"
                  />
                </Switch>
                <p class="mt-2 text-sm text-gray-500">If enabled, the maps will be displayed. Disabling maps may have performance benefits.</p>
              </div>
            </div>

            <div class="sm:grid sm:grid-cols-3 sm:items-start sm:gap-4 sm:border-t sm:border-gray-200 dark:sm:border-slate-800 sm:pt-5">
              <label for="about" class="block text-sm font-medium text-gray-700 dark:text-gray-300 sm:mt-px sm:pt-2">
                Fast Latency  (default: 20)
              </label>
              <div class="mt-1 sm:col-span-2 sm:mt-0 align-left">
                {{ store.prefs.latencyFast }}
                <input 
                  id="latencyFast-range"
                  v-model="store.prefs.latencyFast"
                  class="rounded-lg overflow-hidden appearance-none  h-3 w-128" 
                  type="range" min="20" max="400" step="1" />
                <p class="mt-2 text-sm text-gray-500">What maximum ping should nostr.watch consider as a fast latency? (latency below is considered fast)</p>
              </div>
            </div>

            <div class="sm:grid sm:grid-cols-3 sm:items-start sm:gap-4 sm:border-t sm:border-gray-200 dark:sm:border-slate-800 sm:pt-5">
              <label for="about" class="block text-sm font-medium text-gray-700 dark:text-gray-300 sm:mt-px sm:pt-2">
                Slow Latency (default 1000)
              </label>
              <div class="mt-1 sm:col-span-2 sm:mt-0">
                {{ store.prefs.latencySlow }}
                <input 
                  v-model="store.prefs.latencySlow"
                  class="rounded-lg overflow-hidden appearance-none bg-red-500 h-3 w-128" 
                  type="range" min="1000" max="5000" step="1"/>
                <p class="mt-2 text-sm text-gray-500">What ping minimum should nostr.watch consider as slow latency? (latency above is considered slow)</p>
              </div>
            </div>

            <div class="sm:grid sm:grid-cols-3 sm:items-start sm:gap-4 sm:border-t sm:border-gray-200 dark:sm:border-slate-800 sm:pt-5">
              <label for="about" class="block text-sm font-medium text-gray-700 dark:text-gray-300 sm:mt-px sm:pt-2">
                Ignore Topics
              </label>
              <div class="mt-1 sm:col-span-2 sm:mt-0">
                <textarea id="about" name="about" rows="3" class="py-2 px-3 block w-full max-w-lg rounded-md border-gray-300 dark:bg-black/30 dark:text-white/60 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" v-model="store.prefs.ignoreTopics" />
                <p class="mt-2 text-sm text-gray-500">Comma separated list, defaults are there because they are OP</p>
              </div>
            </div>

            <h2 class="text-gray-500 dark:text-white/50 mt-4">Local Storage</h2>
            <div class="sm:grid sm:grid-cols-3 sm:items-start sm:gap-4 sm:border-t sm:border-gray-200 dark:sm:border-slate-800 sm:pt-5">
              <label for="about" class="block text-sm font-medium text-gray-700 dark:text-gray-300 sm:mt-px sm:pt-2">
                Clear Data
              </label>
              <div class="mt-1 sm:col-span-2 sm:mt-0">
                <button @click="localStorage.clear() && false">Clear All Local Storage</button>
              </div>
            </div>
          </div>
        </div>
    </form>
  </div>
</template>

<script>
//vue
import { defineComponent } from 'vue'
//pinia
import { setupStore } from '@/store'
//shared methods
import RelaysLib from '@/shared/relays-lib.js'
import SharedComputed from '@/shared/computed.js'

import { Switch } from '@headlessui/vue'

const localMethods = {}

export default defineComponent({
  name: 'HomePage',

  components: {
    Switch
  },

  setup(){
    // const {resultsProp: results} = toRefs(props)
    return { 
      store : setupStore(),
      // results: results
    }
  },

  props: {
  },

  data() {  
    return {
      currentRegion: this.store.prefs.region,
      autoDetectRegion: this.store.prefs.autoDetectRegion
    }
  },

  updated(){},

  watch: {
    results: function(){
      //console.log('results changed.')
    }
  },

  beforeMount(){
  },

  async mounted() {
    this.interval = setInterval(() => {
      if(this.store.prefs.region !== this.currentRegion || this.store.prefs.autoDetectRegion !== this.autoDetectRegion){
        delete this.store.tasks.lastUpdate['relays/seed']
        delete this.store.tasks.lastUpdate['user/region']
        this.currentRegion = this.store.prefs.region
        this.autoDetectRegion = this.store.prefs.autoDetectRegion
      }
    },100)
  },

  computed: Object.assign(SharedComputed, {
    
  }),

  methods: Object.assign(RelaysLib, localMethods), 

})
</script>

<style scoped>
#latencyFast-range {
  background-color:#605E5C
}
#latencyFast-range::-webkit-slider-thumb,
#latencyFast-range::-webkit-slider-runnable-track {
  box-shadow: -405px 0 0 400px green;
}

@media screen and (-webkit-min-device-pixel-ratio: 0) {     
     input[type="range"]::-webkit-slider-thumb {
         width: 15px;
         -webkit-appearance: none;
         appearance: none;
         height: 15px;
         cursor: ew-resize;
         background: #FFF;
         box-shadow: -405px 0 0 400px #605E5C;
         border-radius: 50%;
         
     }
 }
 </style>