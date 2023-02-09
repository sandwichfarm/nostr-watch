<template>
  <RelaysNav />

  <MapSingle
    :geo="geo"
    :relay="relay"
    :result="result"
    v-if="(geo instanceof Object) && store.prefs.showMaps"
  />

  <div id="wrapper" class="mt-8 mx-auto w-auto max-w-7xl text-center content-center">
      <div v-if="store.tasks.isTaskActive('relays/single') && !result" class="data-card flex bg-slate-100 dark:bg-black/20 dark:text-white/50 mt-12 shadow py-8 px-3">
        <div class="text-slate-800 text-3xl flex-none w-full block py-1 text-center">
          <span class="block lg:text-lg"><strong>Data has not yet populated and is currently being processed.</strong> Depending on the availability of of the <strong>{{ relay }}</strong>, this may or may not be populated shortly.</span>
        </div>
      </div>

      <section v-if="result">

        <div id="title_card" class="data-card overflow-hidden sm:rounded-lg mb-8 pt-5" style="background:transparent">
          <div class="px-4 py-5 sm:px-6">
            <h1 class="font-light text-3xl md:text-4xl xl:text-7xl">{{geo?.countryCode ? getFlag : ''}} <span @click="copy(relayFromUrl)">{{ relayFromUrl }}</span></h1>
            <p class="mt-1 w-auto text-xl text-gray-500" v-if="result?.info?.description">{{ result.info.description }}</p>
            <span class="mt-1 w-auto text-xl text-gray-400" v-if="result?.info?.contact">Contact: <SafeMail :email="result.info.contact" /></span>
          </div>
          <a 
          target="_blank" 
          :href="`https://www.ssllabs.com/ssltest/analyze.html?d=${ getHostname(relay) }`"
          class="inline-block py-2 px-3 bg-black/10 first-line:font-bold text-black dark:bg-white/50  dark:text-white ">
            Check SSL
          </a>
        </div>


        <div class="data-card flex sm:rounded-lg bg-slate-50 dark:bg-black/20 border-slate-200 border mb-8  py-8" v-if="result?.topics && result?.topics.length">
          <div class="text-slate-800 text-lg md:text-xl lg:text-3xl flex-none w-full block py-1 text-center">
            <span v-for="topic in getTopics" :class="normalizeTopic(topic)" :key="`${result.url}-${topic[0]}`">
              #{{ topic[0] }}  
            </span>
          </div>
        </div>

        <div id="status" class="flex mb-2 py-5 rounded-lg"> <!--something is weird here with margin-->
          <div v-for="key in ['connect', 'read', 'write']" :key="key" class="text-white text-lg md:text-xl lg:text-2xl flex-1 block py-3" :class="check(key)">
            <span>{{key}}</span>  
          </div>
        </div>

        <div 
          id="status" 
          class="flex-none w-full md:w-auto md:flex mb-2 py-5" 
          v-if="
            showLatency ||
            (result.check.averageLatency === null || result.check.averageLatency === true)"> <!--something is weird here with margin-->
          <div class="text-white text-lg md:text-xl lg:text-3xl flex-1 block py-6 ">
            <vue-gauge 
              v-if="result.latency.average"
              class="relative -top-6 -mb-12 m-auto inline-block"
              :refid="'relay-latency'"
              :options="{
                'needleValue':normalizeLatency(result?.latency?.average || result?.latency?.final),
                'arcDelimiters':[33,66],
                'rangeLabel': false,
                'arcColors': ['green', 'orange', 'red'] }">
            </vue-gauge>
          </div>
          <div class="text-black dark:text-white text-lg md:text-xl lg:text-3xl flex-1 block py-6">
            <h3 class="text-black/70 dark:text-white/50 text-lg">Avg. Latency</h3>
            <svg v-if="!result.latency.average" class="animate-spin mr-1 mt-1 h-6 w-6 text-black dark:text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>{{ result.latency.average }}</span>
          </div>
          <div class="text-black dark:text-white text-lg md:text-xl lg:text-3xl flex-1 block py-6">
            <h3 class="text-black/70 dark:text-white/50 text-lg">Min Latency</h3>
            <svg v-if="!result.latency.min" class="animate-spin mr-1 mt-1 h-6 w-6 text-black dark:text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>{{ result.latency.min }}</span>
          </div>
          <div class="text-black dark:text-white text-lg md:text-xl lg:text-3xl flex-1 block py-6">
            <h3 class="text-black/70 dark:text-white/50 text-lg">Max Latency</h3>
            <svg v-if="!result.latency.max" class="animate-spin mr-1 mt-1 h-6 w-6 text-black dark:text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>{{ result.latency.max }}</span>
          </div>
        </div>

        <div class="mt-3 overflow-hidden mb-8" v-if="this.pulses && Object.keys(this.pulses).length > 24">
          <div class="px-0 pt-5 sm:px-6">
            <h3 class="text-lg md:text1xl lg:text-2xl xl:text-3xl">
              Uptime for the last
              <span class=" text-gray-500 dark:text-gray-400">12hrs: </span> 
              <span :class="getUptimeColor(result)" v-if="result?.uptime">{{ result.uptime }}%</span>
            </h3>
          </div>
          <div class="px-0 py-5 sm:px-0 flex">
            <!-- <span 
              v-for="heartbeat in this.pulses"
              :key="heartbeat.date"
              class=" mr-1 flex-1 relative"
              :class="getUptimeTickClass(heartbeat)">
                <span class="block origin-left-top transform relative -right-2 rotate-90 text-xs text-black/75 w-1" v-if="heartbeat.latency">{{ heartbeat.latency }}ms</span>
                <span v-if="!heartbeat.latency">&nbsp;</span>
              </span> -->

            <span 
              v-for="heartbeat in this.pulses"
              :key="heartbeat.date"
              class="mr-1 flex-1">
                <span class="block" :class="getUptimeTickClass(heartbeat)">
                  <span class="hidden lg:block origin-left-top transform relative -right-2 rotate-90 text-xs text-black/75 w-1" v-if="heartbeat.latency">{{ heartbeat.latency }}ms</span>
                  <span v-if="!heartbeat.latency">&nbsp;</span>
                </span>
              </span>
          </div>
        </div>

        <!-- <div class="flex justify-center">
          <div class="block rounded-lg shadow-lg bg-white max-w-sm text-center">
            <div class="py-3 px-6 border-b border-gray-300">
              Featured
            </div>
            <div class="p-6">
              <h5 class="text-gray-900 text-xl font-medium mb-2">Special title treatment</h5>
              <p class="text-gray-700 text-base mb-4">
                With supporting text below as a natural lead-in to additional content.
              </p>
              <button type="button" class=" inline-block px-6 py-2.5 bg-blue-600 text-white font-medium text-xs leading-tight uppercase rounded shadow-md hover:bg-blue-700 hover:shadow-lg focus:bg-blue-700 focus:shadow-lg focus:outline-none focus:ring-0 active:bg-blue-800 active:shadow-lg transition duration-150 ease-in-out">Button</button>
            </div>
            <div class="py-3 px-6 border-t border-gray-300 text-gray-600">
              2 days ago
            </div>
          </div>
        </div> -->


       

        
        
        

        <!-- <div id="did_not_connect" v-if="!result?.check?.connect" class="mb-8 py-8">
          <div class="data-card block mt-8 py-24 w-auto bg-white border border-gray-200 rounded-lg shadow-md dark:bg-gray-800 dark:border-gray-700" v-if="!result?.check?.connect">
            <h5 class="mb-2 text-2xl font-bold tracking-tight text-red-600 dark:text-red-300">This Relay Appears to be offline</h5>
          </div>
          <div class="flex bg-slate-50 shadow mt-8" v-if="Object.keys(this.result?.geo).length">
            <div class="text-slate-800 text-3xl flex-none w-full block py-1 text-center">
              I did find this...
            </div>
          </div>
        </div> -->

        <div id="nips" v-if="result?.info?.supported_nips" class="mb-8 py-1 overflow-hidden bg-slate-400 border-slate-200 shadow sm:rounded-lg dark:bg-slate-800">
          <div class="px-1 py-2 sm:px-6">
            <div class="lg:flex">
              <div class="flex-none lg:flex-initial">
                <h3 class="inline-block lg:block text-lg md:text-lg lg:text-xl xl:text-3xl mb-2 px-2 align-middle mt-4 font-black">nips</h3>
              </div>
              <a target="_blank" :href="nipLink(key)" v-for="key in result?.info?.supported_nips" :key="`nip-${key}`" 
              class="hover:bg-slate-300 dark:hover:bg-black/20 hover:shadow pointer-cursor flex-initial gap-4  text-slate-800 text-1xl w-1/5 inline-block py-6 ">
                <code>{{nipFormatted(key)}}</code>
              </a>
            </div>
          </div>
        </div>


        <div class="flex-none lg:flex mb-8">
          <div class="flex-none lg:flex-1 justify-center mb-6 lg:mb-0"  v-if="geo">
            <div class="inline-block rounded-lg shadow-lg h-auto lg:h-full bg-white dark:bg-black/30 max-w-sm text-center">
              <!-- <div class="py-3 px-6 border-b border-gray-300">
                Featured
              </div> -->
              <div class="py-6 px-4">
                <h5 class="text-gray-900 dark:text-white/90 text-xl font-medium mb-2">
                  Network Summary
                </h5>
                <p class="text-gray-700 text-base mb-4 dark:text-white/60">
                  The IP of <strong>{{ geo?.dns.name }}</strong> is <strong>{{ geo?.dns.data }}</strong>
                  <em>{{ geo?.dns.data }}</em> appears to be in <strong>{{ geo?.city }} {{ geo?.country }}.</strong>
                  The hosting provider is <strong>{{  geo?.as  }}</strong>.
                </p>
                <!-- <button type="button" class=" inline-block px-6 py-2.5 bg-blue-600 text-white font-medium text-xs leading-tight uppercase rounded shadow-md hover:bg-blue-700 hover:shadow-lg focus:bg-blue-700 focus:shadow-lg focus:outline-none focus:ring-0 active:bg-blue-800 active:shadow-lg transition duration-150 ease-in-out">Button</button> -->
              </div>
              <!-- <div class="py-3 px-6 border-t border-gray-300 text-gray-600">
                2 days ago
              </div> -->
            </div>
          </div>
          <div class="flex-none lg:flex-1 justify-center mb-6 lg:mb-0" v-if="Object.keys(result?.info).length">
            <div class="inline-block rounded-lg shadow-lg h-auto lg:h-full bg-white dark:bg-black/30 max-w-sm text-center">
              <!-- <div class="py-3 px-6 border-b border-gray-300">
                Featured
              </div> -->
              <div class="py-6 px-4">
                <h5 class="text-gray-900 dark:text-white/90 text-xl font-medium mb-2">
                  Software
                </h5>
                <p class="text-gray-700 text-base mb-4 dark:text-white/60">
                  <strong>{{relay}}</strong> is running <strong>{{ getSoftware }}</strong> version <strong>{{ result.info.version }}</strong>
                </p>
                <!-- <button type="button" class=" inline-block px-6 py-2.5 bg-blue-600 text-white font-medium text-xs leading-tight uppercase rounded shadow-md hover:bg-blue-700 hover:shadow-lg focus:bg-blue-700 focus:shadow-lg focus:outline-none focus:ring-0 active:bg-blue-800 active:shadow-lg transition duration-150 ease-in-out">Button</button> -->
              </div>
              <!-- <div class="py-3 px-6 border-t border-gray-300 text-gray-600">
                2 days ago
              </div> -->
            </div>
          </div>
          <div class="flex-none lg:flex-1 justify-center mb-6 lg:mb-0" v-if="this.result?.info?.pubkey">
            <div class="inline-block rounded-lg shadow-lg h-auto lg:h-full bg-white dark:bg-black/30 max-w-sm text-center">
              <!-- <div class="py-3 px-6 border-b border-gray-300">
                Featured
              </div> -->
              <div class="py-6 px-4">
                <h5 class="text-gray-900 dark:text-white/90 text-xl font-medium mb-2">
                  PubKey
                </h5>
                <p class="text-gray-700 text-base mb-4 dark:text-white/60 text-ellipsis overflow-hidden">
                  The relay's pubkey is <code class="block text-ellipsis w-full">{{ this.result?.info.pubkey }}</code>
                </p>
                <!-- <button type="button" class=" inline-block px-6 py-2.5 bg-blue-600 text-white font-medium text-xs leading-tight uppercase rounded shadow-md hover:bg-blue-700 hover:shadow-lg focus:bg-blue-700 focus:shadow-lg focus:outline-none focus:ring-0 active:bg-blue-800 active:shadow-lg transition duration-150 ease-in-out">Button</button> -->
              </div>
              <!-- <div class="py-3 px-6 border-t border-gray-300 text-gray-600">
                2 days ago
              </div> -->
            </div>
          </div>
        </div>

        <div class="data-card flex sm:rounded-lg bg-slate-50 dark:bg-black/20 border-slate-200 border mb-8  py-8" v-if="geo">
          <div class="text-slate-800 text-lg md:text-xl lg:text-3xl flex-none w-full block py-1 text-center">
            <span>
              It's <strong>{{ getLocalTime }}</strong> in <strong>{{ geo?.city }}</strong>
              </span>
          </div>
        </div>

        <!-- <div class="flex bg-slate-50 border-slate-200 mt-12 shadow" v-if="true">
          <div class="text-slate-800 text-3xl flex-none w-full block py-1 text-center">
            <h3>{}</h3>
            <span class="block lg:text-lg">was  recieved via {{ relayFromUrl }}/.well-known/nostr.json</span>
          </div>
        </div> -->

        <!-- <div class="data-card flex bg-transparent border-slate-200 shadow mt-12 mb-8 py-5" v-if="this.result?.info?.pubkey">
          <div class="text-slate-800 dark:text-white/50 w-full flex-none block py-1 text-center text-xl">
            Here's the details...
          </div>
        </div>

        <div class="py-5" v-if="typeof result?.info !== 'undefined' && Object.keys(result?.info).length">
          <div class="data-card overflow-hidden bg-white dark:bg-black/20 shadow sm:rounded-lg relative">
            <div class="px-4 py-5 sm:px-6">
              <h3 class="text-lg md:text1xl lg:text-2xl xl:text-3xl">Relay Info</h3>
            </div>
            <div class="border-t border-gray-200 px-4 py-5 sm:p-0">
              <dl class="sm:divide-y sm:divide-gray-200">
                <div class="py-4 sm:gap-4 sm:py-5 sm:px-6 font-extrabold" v-if="result?.info?.name">
                  <dt class="text-lg font-medium text-gray-500 dark:text-white/50">Relay Name</dt>
                  <dd class="mt-1 text-sm text-gray-900 dark:text-white/80 sm:mt-0">{{ result.info.name }}</dd>
                </div>
                <div class="py-4 sm:gap-4 sm:py-5 sm:px-6 font-extrabold" v-if="result?.info?.pubkey">
                  <dt class="text-lg font-medium text-gray-500 dark:text-white/50">Public Key</dt>
                  <dd class="mt-1 text-sm text-gray-900 dark:text-white/80 sm:mt-0"><code class="text-xs">{{ result.info.pubkey }}</code></dd>
                </div>
                <div class="py-4 sm:gap-4 sm:py-5 sm:px-6 font-extrabold" v-if="result?.info?.email">
                  <dt class="text-lg font-medium text-gray-500 dark:text-white/50">Contact</dt>
                  <dd class="mt-1 text-sm text-gray-900 dark:text-white/80 sm:mt-0 "><SafeMail :email="result.info.email" /></dd>
                </div>
                <div class="py-4 sm:gap-4 sm:py-5 sm:px-6 font-extrabold" v-if="result?.info?.software">
                  <dt class="text-lg font-medium text-gray-500 dark:text-white/50">Software</dt>
                  <dd class="mt-1 text-sm text-gray-900 dark:text-white/80 sm:mt-0">
                    {{ getSoftware }} 
                    <br />
                    {{result.info.software}}<br />
                    
                    <a 
                      v-if="result.info.software.includes('+http')" 
                      :href="result.info.software.replace('git+', '')"
                      target="_blank">
                        {{ result.info.software.includes('+https') ? 'https' : ' http' }}
                      </a>
                    <a 
                      v-if="result.info.software.includes('git+')" 
                      :href="result.info.software.replace('+http', '').replace('+https', '')">
                      git
                    </a>
                  </dd>
                </div>
                <div class="py-4 sm:gap-4 sm:py-5 sm:px-6 font-extrabold" v-if="result?.info?.version">
                  <dt class="text-lg font-medium text-gray-500">Software Version</dt>
                  <dd class="mt-1 text-sm text-gray-900 sm:mt-0"><code class="text-xs">{{ result.info.version }}</code></dd>
                </div>
                
              </dl>
            </div>
          </div>
        </div>
        

      <div :class="getGeoWrapperClass">
        <div  :class="getDnsClass" class="data-card overflow-hidden  dark:bg-black/20 shadow sm:rounded-lg mt-8" v-if="geo">
          <div class="px-4 py-5 sm:px-6">
            <h3 class="text-lg md:text1xl lg:text-2xl xl:text-3xl">DNS</h3>
          </div>
          <div class="border-t border-gray-200 px-4 py-5 sm:p-0">
            <dl class="sm:divide-y sm:divide-gray-200">
              <div class="py-4 sm:gap-4 sm:py-5 sm:px-6 font-extrabold"  v-for="(value, key) in Object.entries(geo?.dns)" :key="`${value}_${key}`">
                <dt class="text-sm font-medium text-gray-500 dark:text-white/50">{{ value[0] }}</dt>
                <dd class="mt-1 text-sm text-gray-900 dark:text-white/80 sm:mt-0">{{ value[1] }}</dd>
              </div>
            </dl>
          </div>
        </div>

        <div class="data-card overflow-hidden bg-white dark:bg-black/20 dark:text-white/80 shadow sm:rounded-lg mt-8"  :class="getGeoClass" v-if="geo">
          <div class="px-4 py-5 sm:px-6">
            <h3 class="text-lg md:text1xl lg:text-2xl xl:text-3xl">Geo Data {{geo?.countryCode ? getFlag : ''}}</h3>
          </div>
          <div class="border-t border-gray-200 px-4 py-5 sm:p-0">
            <dl class="sm:divide-y sm:divide-gray-200">
              <div class="py-4 sm:gap-4 sm:py-5 sm:px-6 font-extrabold"  v-for="(value, key) in Object.entries(geo).filter(value => value[0] != 'dns')" :key="`${value}_${key}`">
                <dt class="text-sm font-medium text-gray-500  dark:text-white/50">{{ value[0] }}</dt>
                <dd class="mt-1 text-sm text-gray-900  dark:text-white/80 sm:mt-0">{{ value[1] }}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div> -->

      

    <!-- <span v-if="this.events?.['0']">
     <h1>OK</h1>
    </span> -->

    <div class="flow-root" v-if="this.events?.['1']">
      <ul role="list" class="-mb-8">
        
        <!-- <li v-for="(event, key) in this.events?.['1']" :key="key">
          <div class="relative pb-8" v-if="Object.keys(event).length">
            <span class="absolute top-5 left-5 -ml-px h-full w-0.5 bg-gray-200" aria-hidden="true"></span>
            <div class="relative flex items-start space-x-3">
              <div class="relative">
                <img class="flex h-10 w-10 items-center justify-center rounded-full bg-gray-400 ring-8 ring-white" src="https://images.unsplash.com/photo-1520785643438-5bf77931f493?ixlib=rb-=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=8&w=256&h=256&q=80" alt="">
                <span class="absolute -bottom-0.5 -right-1 rounded-tl bg-white px-0.5 py-px">
                  <svg class="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fill-rule="evenodd" d="M10 2c-2.236 0-4.43.18-6.57.524C1.993 2.755 1 4.014 1 5.426v5.148c0 1.413.993 2.67 2.43 2.902.848.137 1.705.248 2.57.331v3.443a.75.75 0 001.28.53l3.58-3.579a.78.78 0 01.527-.224 41.202 41.202 0 005.183-.5c1.437-.232 2.43-1.49 2.43-2.903V5.426c0-1.413-.993-2.67-2.43-2.902A41.289 41.289 0 0010 2zm0 7a1 1 0 100-2 1 1 0 000 2zM8 8a1 1 0 11-2 0 1 1 0 012 0zm5 1a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd" />
                  </svg>
                </span>
              </div>
              <div class="min-w-0 flex-1">
                <div>
                  <a href="#" class="font-medium text-gray-900">
                    
                    {{ Object.entries(this.events['0']).map( event => event[1])[0]?.lud06 }} <br/>
                    {{ Object.entries(this.events['0']).map( event => event[1])[0]?.name }}<br/>
                    {{ Object.entries(this.events['0']).map( event => event[1])[0]?.picture }}<br/>
                    
                    {{ Object.entries(this.events['0']).map( event => event[1])[0]?.created_at }}<br/>
                  </a>
                  <div class="text-sm">
                  </div>
                  <p class="mt-0.5 text-sm text-gray-500">Posted {{ timeSince(event.created_at) }}</p>
                </div>
                <div class="mt-2 text-sm text-gray-700">
                  <p>{{ event.content }}</p>
                </div>
              </div>
            </div>
          </div>
        </li> -->




              <!-- component -->
    <!-- <div class="col-span-1" :class="getLogsClass" v-if="result?.log">
      <div class="overflow-x-auto sm:-mx-6 lg:-mx-8">
        <div class="py-2 inline-block min-w-full sm:px-6 lg:px-8">
          <div class="overflow-hidden">
            <table class="min-w-full text-center">
              <thead class="border-b">
                <tr>
                  <th scope="col" class="text-sm font-medium text-gray-900 px-6 py-4">
                    Log
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr class="border-b" v-for="(log, index) in result.log" :key="`${log[0]}-${index}`">
                  <td class="text-sm text-gray-900 font-medium px-6 py-4 overflow-ellipsis" :class="getLogClass(log[0])">
                    {{ log[0] }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div> -->


          <!-- <div class="relative pb-8" v-if="event.kind === '7'">
            <span class="absolute top-5 left-5 -ml-px h-full w-0.5 bg-gray-200" aria-hidden="true"></span>
            <div class="relative flex items-start space-x-3">
              <div class="relative">
                <img class="flex h-10 w-10 items-center justify-center rounded-full bg-gray-400 ring-8 ring-white" src="https://images.unsplash.com/photo-1520785643438-5bf77931f493?ixlib=rb-=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=8&w=256&h=256&q=80" alt="">
                <span class="absolute -bottom-0.5 -right-1 rounded-tl bg-white px-0.5 py-px">
                  
                  <svg class="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fill-rule="evenodd" d="M10 2c-2.236 0-4.43.18-6.57.524C1.993 2.755 1 4.014 1 5.426v5.148c0 1.413.993 2.67 2.43 2.902.848.137 1.705.248 2.57.331v3.443a.75.75 0 001.28.53l3.58-3.579a.78.78 0 01.527-.224 41.202 41.202 0 005.183-.5c1.437-.232 2.43-1.49 2.43-2.903V5.426c0-1.413-.993-2.67-2.43-2.902A41.289 41.289 0 0010 2zm0 7a1 1 0 100-2 1 1 0 000 2zM8 8a1 1 0 11-2 0 1 1 0 012 0zm5 1a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd" />
                  </svg>
                </span>
              </div>
              <div class="min-w-0 flex-1">
                <div>
                  <div class="text-sm">
                    <a href="#" class="font-medium text-gray-900">Eduardo Benz</a>
                  </div>
                  <p class="mt-0.5 text-sm text-gray-500">Posted {{ timeSince(event.created_at) }}</p>
                </div>
                <div class="mt-2 text-sm text-gray-700">
                  <p>{{ event.content }}</p>
                </div>
              </div>
            </div>
          </div>
        </li> -->

        <!-- <li>
          <div class="relative pb-8">
            <span class="absolute top-5 left-5 -ml-px h-full w-0.5 bg-gray-200" aria-hidden="true"></span>
            <div class="relative flex items-start space-x-3">
              <div>
                <div class="relative px-1">
                  <div class="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 ring-8 ring-white">
                    <svg class="h-5 w-5 text-gray-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-5.5-2.5a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0zM10 12a5.99 5.99 0 00-4.793 2.39A6.483 6.483 0 0010 16.5a6.483 6.483 0 004.793-2.11A5.99 5.99 0 0010 12z" clip-rule="evenodd" />
                    </svg>
                  </div>
                </div>
              </div>
              <div class="min-w-0 flex-1 py-1.5">
                <div class="text-sm text-gray-500">
                  <a href="#" class="font-medium text-gray-900">Hilary Mahy</a>
                  assigned
                  <a href="#" class="font-medium text-gray-900">Kristin Watson</a>
                  <span class="whitespace-nowrap">2d ago</span>
                </div>
              </div>
            </div>
          </div>
        </li>

        <li>
          <div class="relative pb-8">
            <span class="absolute top-5 left-5 -ml-px h-full w-0.5 bg-gray-200" aria-hidden="true"></span>
            <div class="relative flex items-start space-x-3">
              <div>
                <div class="relative px-1">
                  <div class="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 ring-8 ring-white">
                    <svg class="h-5 w-5 text-gray-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                      <path fill-rule="evenodd" d="M5.5 3A2.5 2.5 0 003 5.5v2.879a2.5 2.5 0 00.732 1.767l6.5 6.5a2.5 2.5 0 003.536 0l2.878-2.878a2.5 2.5 0 000-3.536l-6.5-6.5A2.5 2.5 0 008.38 3H5.5zM6 7a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd" />
                    </svg>
                  </div>
                </div>
              </div>
              <div class="min-w-0 flex-1 py-0">
                <div class="text-sm leading-8 text-gray-500">
                  <span class="mr-0.5">
                    <a href="#" class="font-medium text-gray-900">Hilary Mahy</a>
                    added tags
                  </span>
                  <span class="mr-0.5">
                    <a href="#" class="relative inline-flex items-center rounded-full border border-gray-300 px-3 py-0.5 text-sm">
                      <span class="absolute flex flex-shrink-0 items-center justify-center">
                        <span class="h-1.5 w-1.5 rounded-full bg-rose-500" aria-hidden="true"></span>
                      </span>
                      <span class="ml-3.5 font-medium text-gray-900">Bug</span>
                    </a>
                    <a href="#" class="relative inline-flex items-center rounded-full border border-gray-300 px-3 py-0.5 text-sm">
                      <span class="absolute flex flex-shrink-0 items-center justify-center">
                        <span class="h-1.5 w-1.5 rounded-full bg-indigo-500" aria-hidden="true"></span>
                      </span>
                      <span class="ml-3.5 font-medium text-gray-900">Accessibility</span>
                    </a>
                  </span>
                  <span class="whitespace-nowrap">6h ago</span>
                </div>
              </div>
            </div>
          </div>
        </li>

        <li>
          <div class="relative pb-8">
            <div class="relative flex items-start space-x-3">
              <div class="relative">
                <img class="flex h-10 w-10 items-center justify-center rounded-full bg-gray-400 ring-8 ring-white" src="https://images.unsplash.com/photo-1531427186611-ecfd6d936c79?ixlib=rb-=eyJhcHBfaWQiOjEyMDd9&auto=format&fit=facearea&facepad=8&w=256&h=256&q=80" alt="">

                <span class="absolute -bottom-0.5 -right-1 rounded-tl bg-white px-0.5 py-px">
                  <svg class="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fill-rule="evenodd" d="M10 2c-2.236 0-4.43.18-6.57.524C1.993 2.755 1 4.014 1 5.426v5.148c0 1.413.993 2.67 2.43 2.902.848.137 1.705.248 2.57.331v3.443a.75.75 0 001.28.53l3.58-3.579a.78.78 0 01.527-.224 41.202 41.202 0 005.183-.5c1.437-.232 2.43-1.49 2.43-2.903V5.426c0-1.413-.993-2.67-2.43-2.902A41.289 41.289 0 0010 2zm0 7a1 1 0 100-2 1 1 0 000 2zM8 8a1 1 0 11-2 0 1 1 0 012 0zm5 1a1 1 0 100-2 1 1 0 000 2z" clip-rule="evenodd" />
                  </svg>
                </span>
              </div>
              <div class="min-w-0 flex-1">
                <div>
                  <div class="text-sm">
                    <a href="#" class="font-medium text-gray-900">Jason Meyers</a>
                  </div>
                  <p class="mt-0.5 text-sm text-gray-500">Commented 2h ago</p>
                </div>
                <div class="mt-2 text-sm text-gray-700">
                  <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Tincidunt nunc ipsum tempor purus vitae id. Morbi in vestibulum nec varius. Et diam cursus quis sed purus nam. Scelerisque amet elit non sit ut tincidunt condimentum. Nisl ultrices eu venenatis diam.</p>
                </div>
              </div>
            </div>
          </div>
        </li> -->
      </ul>
    </div>

      


  
  </section>
  </div>
</template>

<script>

import { defineComponent, defineAsyncComponent } from 'vue'

// import RelaysNav from '@/components/relays/nav/RelaysNav.vue'
// import MapSingle from '@/components/relays/blocks/MapSingle.vue'

import SafeMail from "@2alheure/vue-safe-mail";

import RelaysLib from '@/shared/relays-lib.js'
import SharedComputed from '@/shared/computed.js'

import { countryCodeEmoji } from 'country-code-emoji';
import emoji from 'node-emoji';

import { setupStore } from '@/store'
import { useHead } from '@vueuse/head'

import { RelayPool } from 'nostr'
import crypto from 'crypto'

const RelaysNav = defineAsyncComponent(() =>
    import("@/components/relays/nav/RelaysNav.vue" /* webpackChunkName: "RelaysNav" */)
);

const VueGauge = defineAsyncComponent(() =>
    import('vue-gauge' /* webpackChunkName: "VueGauge" */)
);

const MapSingle = defineAsyncComponent(() =>
    import("@/components/relays/blocks/MapSingle.vue" /* webpackChunkName: "MapSingle" */)
);

const localMethods = {
   
    async copy(text) {
      try {
        await navigator.clipboard.writeText(text);
      } catch($e) {
        ////console.log('Cannot copy');
      }
    },
    getAdminNotes(){
      if(!this.result?.info?.pubkey)
        return 

      const relays = this.store.relays.getAggregateCache('public')

      //console.log('public relays', this.store.relays.getAggregateCache('public').length)

      const pool = new RelayPool(relays)
      const subid = crypto.randomBytes(40).toString('hex')
      const uniques = {
        0: new Set(),
        1: new Set(),
        7: new Set(),
      }

      const limits = {
        0: 1,
        1: 20,
        7: 100
      } 

      const kinds = [0,1,7]
      pool
        .on('open', relay => {
          relay.subscribe(subid, { limit:10, kinds:kinds, authors:[this.result.info.pubkey] })
        })
        .on('event', (relay, sub_id, event) => {
          if(!kinds.includes(event.kind))
            return
          if(sub_id !== subid)
            return
          const u = uniques[event.kind],
                l = limits[event.kind]
          if( u.has(event.id) || u.size > l )
            return
          if( !(event instanceof Object) )
            return
          
          if( !( this.events[event.kind] instanceof Object ))
            this.events[event.kind] = new Object()
          this.events[event.kind][event.id] = event
          u.add(event.id)
          if(parseInt(event.kind) === 0)
            this.store.profile.set(JSON.parse(event.content))
        })
        .on('eose', relay => {
          if(this.wsIsOpen(relay.ws))
            this.closeRelay(relay)
        })
        
    },
    setEventType(event){
      if( (event.content === '+' || event.content === '-') && event.kind === 7 )
        return 'reaction'
      if( event.kind === 1 )
        return 'note'
      // if( event.kind === 0 )
      //   return 'user meta'
    },
    eventToFeed(event){
      let picture,
          person,
          content

      if(event.kind === 0){
        let profile = JSON.parse(event.content)
        person =  { name: profile.name, href: "#" }
        picture = profile.picture
      }

      if(event.kind === 1){
        content = event.content
      }
  
      //console.log('all about the event')
       return {
          id: event,
          type: this.setEventType(event),
          person: person,
          imageUrl: picture,
          comment: content ? content  : '',
          date: '2h ago',
        }
    }
}

export default defineComponent({
  name: 'RelaySingle',
  
  components: {
    MapSingle,
    SafeMail,
    RelaysNav,
    VueGauge,
  },

  data() {
    return {
      result: {},
      relay: "",
      geo: {},
      events: {},
      interval: null,
      showLatency: false,
      pulses : {},
      hbMin: 0,
      hbMax: 0
    }
  },

  setup(){
    useHead({
      title: 'nostr.watch',
      meta: [
        {
          name: `description`,
          content: 'A robust client-side nostr relay monitor. Find fast nostr relays, view them on a map and monitor the network status of nostr.',
        },
      ],
    })
    return { 
      store : setupStore()
    }
  },

  created(){},

  beforeMount(){
    this.setData()
  },

  async mounted() {
    // this.getAdminNotes()
    this.result = this.getCache(this.relayFromUrl)
    this.setData()
    this.interval = setInterval(() => {
      this.setData()
    },1000)
  },

  unmounted(){
    clearInterval(this.interval)
  },

  computed: Object.assign(SharedComputed, {
    getTopics: function(){
      // return this.result.topics.filter( topic => !this.store.prefs.ignoreTopics.split(',').includes(topic[0]) )
      return this.result.topics
    },
    normalizeTopic: function(){
      return topic => {

        const val = topic[1],
              minVal = this.result.topics[this.result.topics.length-1][1], 
              maxVal = this.result.topics[0][1],
              newMin = 1,
              newMax = 5

        const size = Math.round( newMin + (val - minVal) * (newMax - newMin) / (maxVal - minVal))

        if(size === 1)
          return 'text-lg'
        if(size === 2)
          return 'text-1xl'
        if(size === 3)
          return 'text-2xl'
        if(size === 4)
          return 'text-3xl'
        if(size === 5)
          return 'text-4xl'
      }
    },
    getLocalTime: function(){
      let options = {
        timeZone: this.geo?.timezone,
        // year: 'numeric',
        // month: 'numeric',
        // day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
      }
      const formatter = new Intl.DateTimeFormat([], options);
      return formatter.format(new Date())
    },
    normalizeLatency: function(){
      return value =>  { 
        const fast = this.store.prefs.latencyFast,
              slow = this.store.prefs.latencySlow
        return (value-fast) / (slow-fast) * 100
      }
    },
    getUptimeTickClass: function(){
      return heartbeat => {
        return {
          'bg-red-700/80 h-32': !heartbeat.latency,
          // 'bg-green-400/50': heartbeat.latency,
          [this.normalizeUptimeTick(heartbeat)]: heartbeat.latency,
        }
      }
    },
    normalizeUptimeTick: function(){
      return heartbeat => { 
        if(!heartbeat.latency)
          return
        const val = heartbeat.latency,
              minVal = this.hbMin,
              maxVal = this.hbMax, 
              newMin = 10,
              newMax = 30
        const h = Math.round( newMin + (val - minVal) * (newMax - newMin) / (maxVal - minVal))
        const m = 32 - h 

        let color 
        
        if(heartbeat.latency<this.store.prefs.latencyFast) {
          color = 'bg-green-400/60'
        } 
        else if(heartbeat.latency<(this.store.prefs.latencySlow/2)) {
          color = 'bg-yellow-400/50'
        }
        else if(heartbeat.latency<this.store.prefs.latencySlow) {
          color = 'bg-orange-400/50'
        }
        else {
          color = 'bg-red-400/50'
        }

        return `h-${h} mt-${m} ${color}`
      }
    },
    getSoftware: function(){
      return this.result?.info?.software
    },

    badgeLink(){
      return (nip) => `https://img.shields.io/static/v1?style=for-the-badge&label=NIP&message=${this.nipSignature(nip)}&color=black`
    },

    nipSignature(){
      return (key) => key.toString().length == 1 ? `0${key}` : key
    },

    nipFormatted(){
      return (key) => `NIP-${this.nipSignature(key)}`
    },

    nipLink(){
      return (key) => `https://github.com/nostr-protocol/nips/blob/master/${this.nipSignature(key)}.md`
    },

    getFlag () {
      return this.geo?.countryCode ? countryCodeEmoji(this.geo?.countryCode) : emoji.get('shrug');
    },
    getLogClass(){
      return (slug) => { 
        return {
          ['bg-indigo-100 border-indigo-200']: slug == 'eose',
          ['bg-red-100 border-red-200']: slug == 'wserror',
          ['bg-yellow-100 border-yellow-200']: slug == 'error',
          ['bg-green-100 border-green-200']: slug == 'ok',
          ['bg-gray-50 border-gray-200']: slug == 'event',
        } 
      }
    },
    getInfoClass(){
      return {
        'col-span-2': this.result?.info && this.geo,
        'col-span-3': this.result?.info && !this.geo
      }
    },
    getDnsClass(){
      return {
        'col-span-1': true,
        // 'col-span-1': !this.result?.info && !this.log,
      }
    },
    getGeoClass(){
      //console.log('ok', !this.result?.info && !this.log)
      return {
        'col-span-2': !this.result?.info && !this.log,
      }
    },

    getGeoWrapperClass(){
      return {
        'col-span-3': !this.result?.info && !this.log,
        'col-span-1': !this.result?.info,
      }
    }

    
    
  }),

  // updated() {
  //    Object.keys(this.timeouts).forEach(timeout => clearTimeout(this.timeouts[timeout]))
  //    Object.keys(this.intervals).forEach(interval => clearInterval(this.intervals[interval]))
  // },

  methods: Object.assign(localMethods, RelaysLib, {
    check(key){
      return { 
        'bg-green-800': this.result?.check?.[key],
        'bg-red-800': !this.result?.check?.[key],
        'rounded-tl-lg rounded-bl-lg': key == 'connect',
        'rounded-tr-lg rounded-br-lg': key == 'write',
      }
    },
    setData(){
      this.relay = this.relayFromUrl
      // this.relays = this.store.relays.getAggregateCache('public')
      this.lastUpdate = this.store.tasks.getLastUpdate('relays')
      this.result = this.getCache(this.relay) || false
      //
      //console.log('single result', this.relayFromUrl, this.result, this.getCache(this.relay))
      
      this.geo = this.store.relays.getGeo(this.relay)

      this.pulses = this.store.stats.getHeartbeat(this.relay)
      this.hbMin = Math.min.apply(Math, this.pulses?.map( hb => hb.latency ))
      this.hbMax = Math.max.apply(Math, this.pulses?.map( hb => hb.latency ) )
      if(this.result?.topics)
        this.result.topics = this.result.topics.filter( topic => !this.store.prefs.ignoreTopics.split(',').includes(topic[0]) )
      
      // if(this.result){
      //   if(this.result?.latency?.average)
      //     this.result.latency.average = null
      //   if(this.result?.latency?.min)
      //     this.result.latency.min = null
      //   if(this.result?.latency?.max)
      //     this.result.latency.max = null
      //   if(this.result?.latency?.average)
      //     this.showLatency = true 
      // }
      //console.log(this.relay, this.lastUpdate, this.result, this.geo)
    }
  }),

})
</script>
<style scoped>
/* ul, ul li { padding:0; margin:0; list-style:none; }
td { padding:5px 10px; }
th h4 { text-align:center; padding:5px 10px; margin:0 0 6px; background:#f0f0f0; }
table {margin:20px 10px 20px; border: 2px solid #f5f5f5; padding:20px}
tr td:first-child { text-align:right }
tr td:last-child { text-align:left }
.indicator { display: table-cell; width:33% ; font-weight:bold; text-align: center !important; color: white; text-transform: uppercase; font-size:0.8em}
body, .grid-Column { padding:0; margin:0; }
.badges { display:block; margin: 10px 0 11px}
.badges > span {margin-right:5px} */
/* #wrapper {max-width:800px} */


/* #relay-wrapper { margin: 50px 0 20px; padding: 20px 0} */
/* h1 {cursor:pointer;font-size:40pt; margin: 0px 0 15px; padding:0 0 10px; border-bottom:3px solid #e9e9e9} */
</style>
