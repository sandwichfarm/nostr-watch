<template>
  <RelaysNav />

  <MapSingle
    :geo="geo"
    :relay="relay"
    :result="result"
    v-if="(geo instanceof Object)"
  />

  <div id="wrapper" class="mt-8 mx-auto w-auto max-w-7xl">
    
      <div v-if="store.tasks.isProcessing('relays/check') && !result" class="data-card flex bg-slate-100 mt-12 shadow">
        <div class="text-slate-800 text-3xl flex-none w-full block py-1 text-center">
          <span class="block lg:text-lg"><strong>Data has not yet populated and is currently being processed.</strong> Depending on the availability of of the <strong>{{ relay }}</strong>, this may or may not be populated shortly.</span>
        </div>
      </div>

      <section v-if="result">

        <div id="title_card" class="data-card overflow-hidden sm:rounded-lg mb-8 pt-5" style="background:transparent">
          <div class="px-4 py-5 sm:px-6">
            <h1 class="font-light text-3xl md:text-4xl xl:text-7xl">{{geo?.countryCode ? getFlag : ''}} <span @click="copy(relayFromUrl)">{{ relayFromUrl }}</span></h1>
            <p class="mt-1 w-auto text-xl text-gray-500" v-if="result?.info?.description">{{ result.info.description }}</p>
          </div>
          <a 
          target="_blank" 
          :href="`https://www.ssllabs.com/ssltest/analyze.html?d=${ getHostname(relay) }`"
          class="inline-block py-2 px-3 bg-black/10 first-line:font-bold text-black dark:bg-white/50  dark:text-white ">
            Check SSL
          </a>
        </div>

        <div id="status" class="flex mb-2 py-5" v-if="showLatency"> <!--something is weird here with margin-->
          <div class="text-white text-lg md:text-xl lg:text-3xl flex-1 block py-6">
            <vue-gauge 
              v-if="result.latency.average"
              class="relative -top-6"
              :refid="'relay-latency'"
              :options="{
                'needleValue':normalizeLatency(result?.latency?.average || result?.latency?.final),
                'arcDelimiters':[33,66],
                'rangeLabel': false,
                'arcColors': ['green', 'orange', 'red'] }">
            </vue-gauge>
          </div>
          
          <!-- <div class="text-white text-lg md:text-xl lg:text-3xl flex-1 block py-6">
            <h3>Latency (1x)</h3>
            <span>{{ result.latency.final }}</span>
          </div> -->
          <div class="text-white text-lg md:text-xl lg:text-3xl flex-1 block py-6 -mb-8">
            <h3>Avg Latency (10x)</h3>
            <svg v-if="!result.latency.average" class="animate-spin mr-1 -mt-0.5 h-4 w-5 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>{{ result.latency.average }}</span>
          </div>
          <div class="text-white text-lg md:text-xl lg:text-3xl flex-1 block py-6">
            <h3>Min Latency</h3>
            <svg v-if="!result.latency.min" class="animate-spin mr-1 -mt-0.5 h-4 w-5 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>{{ result.latency.min }}</span>
          </div>
          <div class="text-white text-lg md:text-xl lg:text-3xl flex-1 block py-6">
            <h3>Max Latency</h3>
            <svg v-if="!result.latency.max" class="animate-spin mr-1 -mt-0.5 h-4 w-5 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>{{ result.latency.max }}</span>
          </div>
          <!-- <div class="text-white text-lg md:text-xl lg:text-3xl flex-1 block py-6">
            <h3>Avg Latency (12h)</h3>
            <span>{{ result.latency.final }}</span>
          </div> -->
        </div>

       <div class="mt-3 overflow-hidden bg-slate-100 dark:bg-white/10 shadow sm:rounded-lg">
          <div class="px-4 py-5 sm:px-6 flex">
            <span 
              v-for="heartbeat in this.store.stats.getHeartbeat(relay)"
              :key="heartbeat[0]"
              class=" mr-1 flex-1"
              :class="{
                'bg-red-300/50 h-16 mt-16': !heartbeat.latency,
                'bg-green-400/50 h-32': heartbeat.latency
              }">
                <span class="block origin-left-top transform relative -right-2 rotate-90 text-xs text-black/75 w-1" v-if="heartbeat.latency">{{ heartbeat.latency }}ms</span>
                <span v-if="!heartbeat.latency">a</span>
              </span>
          </div>
        </div>

        
        
        <div id="status" class="flex mb-2 py-5"> <!--something is weird here with margin-->
          <div v-for="key in ['connect', 'read', 'write']" :key="key" class="text-white text-lg md:text-xl lg:text-3xl flex-1 block py-6" :class="check(key)">
            <span>{{key}}</span>  
          </div>
        </div>

        <div id="did_not_connect" v-if="!result?.check?.connect" class="mb-8 py-8">
          <div class="data-card block mt-8 py-24 w-auto bg-white border border-gray-200 rounded-lg shadow-md dark:bg-gray-800 dark:border-gray-700" v-if="!result?.check?.connect">
            <h5 class="mb-2 text-2xl font-bold tracking-tight text-red-600 dark:text-red-300">This Relay Appears to be offline</h5>
          </div>
          <div class="flex bg-slate-50 shadow mt-8" v-if="Object.keys(this.result?.geo).length">
            <div class="text-slate-800 text-3xl flex-none w-full block py-1 text-center">
              I did find this...
            </div>
          </div>
        </div>

        <div id="nips" v-if="result?.info?.supported_nips" class="mb-8 py-1 overflow-hidden bg-slate-400 border-slate-200 shadow sm:rounded-lg dark:bg-slate-800">
          <div class="px-1 py-2 sm:px-6">
            <div class="lg:flex">
              <div class="flex-none lg:flex-initial">
                <h3 class="inline-block lg:block text-lg md:text-lg lg:text-xl xl:text-3xl mb-2 px-2 align-middle mt-4 font-black">nips</h3>
              </div>
              <a target="_blank" :href="nipLink(key)" v-for="key in result?.info?.supported_nips" :key="`nip-${key}`" 
              class="hover:bg-slate-300 hover:shadow pointer-cursor flex-initial gap-4  text-slate-800 text-1xl w-1/5 inline-block py-6 ">
                <code>NIP-{{key}}</code>
              </a>
            </div>
          </div>
        </div>

        <div class="data-card flex sm:rounded-lg bg-slate-50 border-slate-200 mb-8 py-8" v-if="geo?.dns">
          <div class="text-slate-800 text-lg md:text-xl lg:text-3xl flex-none w-full block py-1 text-center">
            <span>
              The IP of <strong>{{ geo?.dns.name }}</strong> is <strong>{{ geo?.dns.data }}</strong> <br />
              <em>{{ geo?.dns.data }}</em> appears to be in <strong>{{ geo?.city }} {{ geo?.country }}.</strong> <br />
              The hosting provider is <strong>{{  geo?.as  }}</strong>.
            </span>
          </div>
        </div>

        <div class="data-card flex sm:rounded-lg bg-slate-50 border-slate-200 border mb-8  py-8" v-if="this.result?.info?.software">
          <div class="text-slate-800 text-lg md:text-xl lg:text-3xl flex-none w-full block py-1 text-center">
            <span>
              It's <strong>{{ getLocalTime }}</strong> in <strong>{{ geo?.city }}</strong>
              </span>
          </div>
        </div>

        <div class="data-card flex sm:rounded-lg bg-slate-50 border-slate-200 shadow mb-8 py-8" v-if="this.result?.info?.software">
          <div class="text-clip overflow-ellipsis text-slate-800 text-lg md:text-xl lg:text-3xl flex-none w-full block py-1 text-center">
            It's running <strong>{{ getSoftware }}:{{ result.info.version }}</strong>
          </div>
        </div>

        <!-- <div class="flex bg-slate-50 border-slate-200 mt-12 shadow" v-if="true">
          <div class="text-slate-800 text-3xl flex-none w-full block py-1 text-center">
            <h3>{}</h3>
            <span class="block lg:text-lg">was  recieved via {{ relayFromUrl }}/.well-known/nostr.json</span>
          </div>
        </div> -->

        <div class="data-card flex bg-slate-50 border-slate-200 shadow mb-8 py-5" v-if="this.result?.info?.pubkey">
          <div class="text-slate-800 w-full text-sm md:text-lg lg:text-3xl overflow-ellipsis flex-none block py-1 text-center">
            <code class="block">{{ this.result?.info.pubkey }}</code>
          </div>
        </div>

        <div class="data-card flex bg-slate-50 border-slate-200 shadow mt-12 mb-8 py-5" v-if="this.result?.info?.pubkey">
          <div class="text-slate-800 w-full flex-none block py-1 text-center">
            Here's the details...
          </div>
        </div>

        

        <div class="py-5" v-if="typeof result?.info !== 'undefined' && Object.keys(result?.info).length">
          <div class="data-card overflow-hidden bg-white shadow sm:rounded-lg relative">
            <div class="px-4 py-5 sm:px-6">
              <h3 class="text-lg md:text1xl lg:text-2xl xl:text-3xl">Relay Info</h3>
            </div>
            <div class="border-t border-gray-200 px-4 py-5 sm:p-0">
              <dl class="sm:divide-y sm:divide-gray-200">
                <!-- <div class="py-4 sm:gap-4 sm:py-5 sm:px-6 font-extrabold" v-if="result?.info?.version">
                  <dt class="text-lg font-medium text-gray-500">Connection Status</dt>
                  <dd class="mt-1 text-lg text-gray-900 sm:mt-0">
                    
                  </dd>
                </div> -->
                <!-- <div class="py-4 sm:gap-4 sm:py-5 sm:px-6 font-extrabold" v-if="result.info?.supported_nips">
                  <dt class="text-lg font-medium text-gray-500">Supported Nips</dt>
                  <dd class="mt-1 text-sm text-gray-900 sm:mt-0">
                    <span v-for="(nip) in result.info.supported_nips" :key="`${relay}_${nip}`" class="inline-block mr-3 mt-1">
                      <a :href="nipLink(nip)" target="_blank" ><img :src="badgeLink(nip)" /></a> 
                    </span>
                  </dd>
                </div> -->
                <div class="py-4 sm:gap-4 sm:py-5 sm:px-6 font-extrabold" v-if="result?.info?.name">
                  <dt class="text-lg font-medium text-gray-500">Relay Name</dt>
                  <dd class="mt-1 text-sm text-gray-900 sm:mt-0">{{ result.info.name }}</dd>
                </div>
                <div class="py-4 sm:gap-4 sm:py-5 sm:px-6 font-extrabold" v-if="result?.info?.pubkey">
                  <dt class="text-lg font-medium text-gray-500">Public Key</dt>
                  <dd class="mt-1 text-sm text-gray-900 sm:mt-0"><code class="text-xs">{{ result.info.pubkey }}</code></dd>
                </div>
                <div class="py-4 sm:gap-4 sm:py-5 sm:px-6 font-extrabold" v-if="result?.info?.email">
                  <dt class="text-lg font-medium text-gray-500">Contact</dt>
                  <dd class="mt-1 text-sm text-gray-900 sm:mt-0 "><SafeMail :email="result.info.email" /></dd>
                </div>
                <div class="py-4 sm:gap-4 sm:py-5 sm:px-6 font-extrabold" v-if="result?.info?.software">
                  <dt class="text-lg font-medium text-gray-500">Software</dt>
                  <dd class="mt-1 text-sm text-gray-900 sm:mt-0">
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
        <div  :class="getDnsClass" class="data-card overflow-hidden bg-white shadow sm:rounded-lg mt-8" v-if="geo">
          <div class="px-4 py-5 sm:px-6">
            <h3 class="text-lg md:text1xl lg:text-2xl xl:text-3xl">DNS</h3>
          </div>
          <div class="border-t border-gray-200 px-4 py-5 sm:p-0">
            <dl class="sm:divide-y sm:divide-gray-200">
              <div class="py-4 sm:gap-4 sm:py-5 sm:px-6 font-extrabold"  v-for="(value, key) in Object.entries(geo?.dns)" :key="`${value}_${key}`">
                <dt class="text-sm font-medium text-gray-500">{{ value[0] }}</dt>
                <dd class="mt-1 text-sm text-gray-900 sm:mt-0">{{ value[1] }}</dd>
              </div>
            </dl>
          </div>
        </div>

        <div class="data-card overflow-hidden bg-white shadow sm:rounded-lg mt-8"  :class="getGeoClass" v-if="geo">
          <div class="px-4 py-5 sm:px-6">
            <h3 class="text-lg md:text1xl lg:text-2xl xl:text-3xl">Geo Data {{geo?.countryCode ? getFlag : ''}}</h3>
          </div>
          <div class="border-t border-gray-200 px-4 py-5 sm:p-0">
            <dl class="sm:divide-y sm:divide-gray-200">
              <div class="py-4 sm:gap-4 sm:py-5 sm:px-6 font-extrabold"  v-for="(value, key) in Object.entries(geo).filter(value => value[0] != 'dns')" :key="`${value}_${key}`">
                <dt class="text-sm font-medium text-gray-500">{{ value[0] }}</dt>
                <dd class="mt-1 text-sm text-gray-900 sm:mt-0">{{ value[1] }}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>

      

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

import VueGauge from 'vue-gauge';

const RelaysNav = defineAsyncComponent(() =>
    import("@/components/relays/nav/RelaysNav.vue" /* webpackChunkName: "RelaysNav" */)
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
          relay.close()
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
  name: 'SingleRelay',
  
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
      showLatency: false
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
    setTimeout( () => {
      this.showLatency = true
    }, 1001)
    this.interval = setInterval(() => {
      if(!this.result)
        this.setData()
      
      this.result = this.getCache(this.relayFromUrl)
    },1000)
  },

  unmounted(){
    clearInterval(this.interval)
  },

  computed: Object.assign(SharedComputed, {
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
        return (value-0) / (1000-0) * 100
      }
    },
    getSoftware: function(){
      return this.result?.info?.software
    },

    getHostname: function(){
      return (relay) => relay.replace('wss://', '')
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
        'bg-red-800': !this.result?.check?.[key]
      }
    },
    setData(){
      this.relay = this.relayFromUrl
      this.relays = this.store.relays.getAggregateCache('public')
      this.lastUpdate = this.store.tasks.getLastUpdate('relays')
      this.result = this.getCache(this.relay) || false
      //
      //console.log('single result', this.relayFromUrl, this.result, this.getCache(this.relay))
      
      this.geo = this.store.relays.getGeo(this.relay)
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
