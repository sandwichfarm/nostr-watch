<template>
  <RelaysNav />

  <div id="wrapper" class="px-8 mx-auto max-w-7xl">  
    <form class="px-2 space-y-8 divide-y divide-gray-200">
      <div class="space-y-8 divide-y divide-gray-200 sm:space-y-5">
        <div class="space-y-6 sm:space-y-5">
          <div class="mt-8 content-left">
            <h1 class="align-left text-4xl capitalize font-semibold text-gray-900 dark:text-white/90">
              User Preferences
            </h1>
          </div>

          <h2 class="text-2xl pt-8 text-gray-500 dark:text-white/50 mt-4 font-extrabold">Relay Data</h2>  
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

          <!--div class="sm:grid sm:grid-cols-3 sm:items-start sm:gap-4 sm:border-t sm:border-gray-200 dark:sm:border-slate-800 sm:pt-5">
            <label for="about" class="block text-sm font-medium text-gray-700 dark:text-gray-300 sm:mt-px sm:pt-2">
              Use realtime geo-checking
            </label>
            <div class="mt-1 sm:col-span-2 sm:mt-0">
              <Switch
                v-model="store.prefs.runtimeGeo"
                :class="store.prefs.runtimeGeo ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-black'"
                class="relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-opacity-75"
              >
                <span class="sr-only">Auto-detect Region</span>
                <span
                  aria-hidden="true"
                  :class="store.prefs.runtimeGeo ? 'translate-x-5' : 'translate-x-0'"
                  class="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out"
                />
              </Switch>
              <p class="mt-2 text-sm text-gray-500">If disabled, geo-checking will use build-time data instead of API. Geo entires are very likely to be missing when this is disabled since this data is only updated periodically. Use this option if you use an ad-blocker or Brave Browser.</p>
            </div>
          </div-->

          <!--div class="sm:grid sm:grid-cols-3 sm:items-start sm:gap-4 sm:border-t sm:border-gray-200 dark:sm:border-slate-800 sm:pt-5">
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
          </div-->

          <!--div class="sm:grid sm:grid-cols-3 sm:items-start sm:gap-4 sm:border-t sm:border-gray-200 dark:sm:border-slate-800 sm:pt-5" v-if="!store.prefs.autoDetectRegion">
            <label for="about" class="block text-sm font-medium text-gray-700 dark:text-gray-300 sm:mt-px sm:pt-2">
              Select region
            </label>
            <div class="mt-4 space-y-4">
            
              <div class="flex items-center" v-for="region in ['us-east', 'eu-west', 'asia-south', 'asia-southeast', 'au']" :key="prefs-`${region}`">
                <input v-model="store.prefs.region" :value="region" :id="region" name="push-notifications" type="radio" class="h-4 w-4 border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                <label :for="region" class="ml-3 block text-sm font-medium text-gray-700  dark:text-gray-500">{{ region }}</label>
              </div>
              <p class="mt-2 text-sm text-gray-500">The region determines where uptime<span v-if="!store.prefs.clientSideProcessing"> and latency</span> data is pulled from</p>
            </div>
          </div-->

          <h2 class="text-2xl pt-8 text-gray-500 dark:text-white/50 mt-4 font-extrabold">Sorting</h2>
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

          <!-- <div class="sm:grid sm:grid-cols-3 sm:items-start sm:gap-4 sm:border-t sm:border-gray-200 dark:sm:border-slate-800 sm:pt-5">
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
          </div> -->

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

          <h2 class="text-2xl pt-8 text-gray-500 dark:text-white/50 mt-4 font-extrabold">
            Personalization</h2>
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
              <textarea 
                id="ignoreTopics" 
                name="ignoreTopics" 
                :value="store.prefs.ignoreTopics"
                @change="updateResultTopics"
                @input="store.prefs.ignoreTopics = $event.target.value.toLowerCase()"
                rows="3" 
                class="py-2 px-3 block w-full max-w-lg rounded-md border-gray-800 dark:bg-black/30 dark:text-white/60 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"  />
              <p class="mt-2 text-sm text-gray-500">Comma separated list, defaults are there because they are OP</p>
            </div>
          </div>

          <h2 class="text-2xl pt-8 text-pink-700 dark:text-pink-300 mt-4 font-extrabold">
            Data
          </h2>

          <div class="sm:grid sm:grid-cols-3 sm:items-start sm:gap-4 sm:border-t sm:border-gray-200 dark:sm:border-slate-800 sm:pt-5">
            <label for="about" class="block text-sm font-medium text-gray-700 dark:text-gray-300 sm:mt-px sm:pt-2">
              Advanced timeout?
            </label>
            <div class="mt-1 sm:col-span-2 sm:mt-0">
              <Switch
                v-model="store.prefs.advancedTimeout"
                :class="store.prefs.advancedTimeout ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-black'"
                class="relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-opacity-75"
              >
                <span class="sr-only">Use client-side processing</span>
                <span
                  aria-hidden="true"
                  :class="store.prefs.advancedTimeout ? 'translate-x-5' : 'translate-x-0'"
                  class="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out"
                />
              </Switch>
              <p class="mt-2 text-sm text-gray-500">If enabled, you can have different timeouts for connection, reading and writing during relay checks.</p>
            </div>
          </div>

          <div v-if="!store.prefs.advancedTimeout" class="sm:grid sm:grid-cols-3 sm:items-start sm:gap-4 sm:border-t sm:border-gray-200 dark:sm:border-slate-800 sm:pt-5">
            <label for="about" class="block text-sm font-medium text-gray-700 dark:text-gray-300 sm:mt-px sm:pt-2">
              RelayChecker Timeout
            </label>
            <div class="mt-1 sm:col-span-2 sm:mt-0">
              {{ store.prefs.inspectTimeout }}
              <input 
                v-model="store.prefs.inspectTimeout"
                class="rounded-lg overflow-hidden appearance-none bg-red-500 h-3 w-128" 
                type="range" min="5000" max="60000" step="1"/>
              <p class="mt-2 text-sm text-gray-500">What timeout should be used for connection, read and write checks?</p>
            </div>
          </div>

          <div v-if="store.prefs.advancedTimeout" class="sm:grid sm:grid-cols-3 sm:items-start sm:gap-4 sm:border-t sm:border-gray-200 dark:sm:border-slate-800 sm:pt-5">
            <label  for="about" class="block text-sm font-medium text-gray-700 dark:text-gray-300 sm:mt-px sm:pt-2">
              Connect Timeout
            </label>
            <div class="mt-1 sm:col-span-2 sm:mt-0">
              {{ store.prefs.connectTimeout }}
              <input 
                v-model="store.prefs.connectTimeout"
                class="rounded-lg overflow-hidden appearance-none bg-red-500 h-3 w-128" 
                type="range" min="5000" max="60000" step="1"/>
              <p class="mt-2 text-sm text-gray-500">What timeout should be used for connection checks?</p>
            </div>
          </div>

          <div v-if="store.prefs.advancedTimeout" class="sm:grid sm:grid-cols-3 sm:items-start sm:gap-4 sm:border-t sm:border-gray-200 dark:sm:border-slate-800 sm:pt-5">
            <label for="about" class="block text-sm font-medium text-gray-700 dark:text-gray-300 sm:mt-px sm:pt-2">
              Read Timeout
            </label>
            <div class="mt-1 sm:col-span-2 sm:mt-0">
              {{ store.prefs.readTimeout }}
              <input 
                v-model="store.prefs.readTimeout"
                class="rounded-lg overflow-hidden appearance-none bg-red-500 h-3 w-128" 
                type="range" min="5000" max="60000" step="1"/>
              <p class="mt-2 text-sm text-gray-500">What timeout should be used for read checks?</p>
            </div>
          </div>

          <div v-if="store.prefs.advancedTimeout" class="sm:grid sm:grid-cols-3 sm:items-start sm:gap-4 sm:border-t sm:border-gray-200 dark:sm:border-slate-800 sm:pt-5">
            <label for="about" class="block text-sm font-medium text-gray-700 dark:text-gray-300 sm:mt-px sm:pt-2">
              Write Timeout
            </label>
            <div class="mt-1 sm:col-span-2 sm:mt-0">
              {{ store.prefs.writeTimeout }}
              <input 
                v-model="store.prefs.writeTimeout"
                class="rounded-lg overflow-hidden appearance-none bg-red-500 h-3 w-128" 
                type="range" min="5000" max="60000" step="1"/>
              <p class="mt-2 text-sm text-gray-500">What timeout should be used for write checks?</p>
            </div>
          </div>

          <div class="sm:grid sm:grid-cols-3 sm:items-start sm:gap-4 sm:border-t sm:border-gray-200 dark:sm:border-slate-800 sm:pt-5">
            <label for="about" class="block text-sm font-medium text-gray-700 dark:text-gray-300 sm:mt-px sm:pt-2">
              Check Pubkey (NIP-11)
            </label>
            <div class="mt-1 sm:col-span-2 sm:mt-0 align-left">
              <Switch
                v-model="store.prefs.checkNip11"
                :class="store.prefs.checkNip11 ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-black'"
                class="relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-opacity-75"
              >
                <span class="sr-only">Check NIP-11</span>
                <span
                  aria-hidden="true"
                  :class="store.prefs.checkNip11 ? 'translate-x-5' : 'translate-x-0'"
                  class="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out"
                />
              </Switch>
              <p class="mt-2 text-sm text-gray-500">If enabled, nostr.watch will check NIP-11 <span class="text-red-500">Warning: Checks will take longer</span></p>
            </div>
          </div>

          <h2 class="text-2xl text-pink-700 dark:text-pink-300 mt-4 font-extrabold">Experimental</h2>
          <div class="sm:grid sm:grid-cols-3 sm:items-start sm:gap-4 sm:border-t sm:border-gray-200 dark:sm:border-slate-800 sm:pt-5">
            <label for="about" class="block text-sm font-medium text-gray-700 dark:text-gray-300 sm:mt-px sm:pt-2">
              Discover Relays
            </label>
            <div class="mt-1 sm:col-span-2 sm:mt-0 align-left">
              <Switch
                v-model="store.prefs.discoverRelays"
                :class="store.prefs.discoverRelays ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-black'"
                class="relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-opacity-75"
              >
                <span class="sr-only">Uptime Sorting</span>
                <span
                  aria-hidden="true"
                  :class="store.prefs.discoverRelays ? 'translate-x-5' : 'translate-x-0'"
                  class="pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out"
                />
              </Switch>
              <p class="mt-2 text-sm text-gray-500">If enabled, will use nostr.watch API to discover new relays periodically.</p>
            </div>
          </div>

          <h2 class="text-2xl pt-8 text-gray-500 dark:text-white/50 mt-4 font-extrabold">Local Storage</h2>
          <div class="sm:grid sm:grid-cols-3 sm:items-start sm:gap-4 sm:border-t sm:border-gray-200 dark:sm:border-slate-800 sm:pt-5">
            <label for="about" class="block text-sm font-medium text-gray-700 dark:text-gray-300 sm:mt-px sm:pt-2">
              Clear Data
            </label>
            <div class="mt-1 sm:col-span-2 sm:mt-0">
              <button @click="storageClearAll()" class="bg-red-500 hover:bg-red-700 text-white font-bold py-2 px-4 border border-red-700 rounded">Clear All Local Storage</button>
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

const localMethods = {
  storageClearAll(){
    Object.keys(this.store).forEach( store => {
      this.store[store].$reset
    })
    localStorage.clear()
    this.$forceUpdate
  }
}

export default defineComponent({
  name: 'UserPreferences',

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
      autoDetectRegion: this.store.prefs.autoDetectRegion,
      discoverRelays: this.store.prefs.discoverRelays,
      checkNip11: this.store.prefs.checkNip11,
      runtimeGeo: this.store.prefs.runtimeGeo
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
        delete this.store.jobs.lastUpdate['relays/seed']
        delete this.store.jobs.lastUpdate['user/region']
        this.currentRegion = this.store.prefs.region
        this.autoDetectRegion = this.store.prefs.autoDetectRegion
        this.$forceUpdate()
      }
      if(this.store.prefs.discoverRelays !== this.discoverRelays){
        delete this.store.jobs.lastUpdate['relays/get']
        delete this.store.jobs.lastUpdate['relays/seed']
        delete this.store.jobs.lastUpdate['relays/check']
        this.discoverRelays = this.store.prefs.discoverRelays
        this.$forceUpdate()
      }
      if(this.store.prefs.runtimeGeo !== this.runtimeGeo){
        delete this.store.jobs.lastUpdate['relays/geo']
        this.$forceUpdate()
      }

      if(this.store.prefs.checkNip11 !== this.checkNip11){
        delete this.store.jobs.lastUpdate['relays/nip11']
        this.checkNip11 = this.store.prefs.checkNip11
        this.$forceUpdate()
      }
    },100)
  },

  computed: Object.assign(SharedComputed, {
    updateResultTopics(){
      Object.keys(this.store.results.data).forEach( relay => {
        if(this.store.results.data[relay]?.topics)
          this.store.results.data[relay].topics = this.removeIgnoredTopics(this.store.results.data[relay]?.topics)
      })
    }
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