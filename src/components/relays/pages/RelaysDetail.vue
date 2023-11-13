<template>
  <RelaysNav />

  <MapSingle
    :geo="geo"
    :relay="relay"
    v-if="(geo instanceof Object) && store.prefs.showMaps"
  />

  <div id="wrapper" class="mt-8 mx-auto w-auto max-w-7xl text-center content-center">

      <div v-if="!result" class="data-card flex bg-slate-100 dark:bg-black/20 dark:text-white/50 mt-12 shadow py-8 px-3">
        <div class="text-slate-800 text-3xl flex-none w-full block py-1 text-center">
          <span class="block lg:text-lg"><strong>Data has not yet populated and is currently being processed.</strong> Depending on the availability of of the <strong>{{ relay }}</strong>, this may or may not be populated shortly.</span>
        </div>
      </div>

      <section v-if="result">

        <!-- <div id="status" class="block mb-8 px-5 py-8 bg-red-200/10 rounded-lg text-center text-2xl" v-if="isPayToRelay(relay)"> 
            Paid Relays presently have limited results due to significantly higher support liability, once a suitable solution has been identified, service will resume as usual. Sorry for the inconvenience. 
        </div> -->

        <DetailHeader :result="result" />
        <DetailCapabilities :result="result" />        
        <DetailLog :result="result" />
        <div v-if=" 'complete' === this.result.state ">
          <DetailTopics :result="result" />
          <DetailPayToRelay :result="result" />
          <DetailNips :result="result" />
          <DetailLatencyBlock :result="result" />
         

          <div v-if="this.pulses" class="bg-yellow-300/50 dark:bg-yellow-300/10 text-black/80 dark:text-white/70 border border-white/10 py-4 px-8 rounded-md">
            Historical connection, read and write latency are experimental, interpret data with a grain of salt. This data is constantly being improved. 
          </div>

          <DetailHistory
            label="Connectability"
            ability="connect"
            :result="result" />

          <DetailHistory
            label="Readability"
            ability="read"
            :result="result" />

          <DetailHistory
            label="Writability"
            ability="write"
            :result="result" />

          <div class="flex-none lg:flex mb-8">
            <DetailNetwork :result="result" />
            <DetailSoftware :result="result" />
            <DetailPubKey :result="result" />
          </div>
          <DetailLocalTime :result="result" />
        </div>
        <!-- <a :click="showRawData=!showRawData" class="cursor-pointer">Raw</a> -->
        
        <DetailJson :result="result" />
        
                      <!-- component -->

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

import RelaysLib from '@/shared/relays-lib.js'
import SharedComputed from '@/shared/computed.js'

import { countryCodeEmoji } from 'country-code-emoji';
import emoji from 'node-emoji';

import { setupStore } from '@/store'
import { useHead } from '@vueuse/head'

const RelaysNav = defineAsyncComponent(() =>
    import("@/components/relays/nav/RelaysNav.vue" /* webpackChunkName: "RelaysNav" */)
);

const MapSingle = defineAsyncComponent(() =>
    import("@/components/relays/blocks/MapSingle.vue" /* webpackChunkName: "MapSingle" */)
);

const DetailHistory = defineAsyncComponent(() =>
  import('@/components/detail/DetailHistory.vue' /* webpackChunkName: "DetailHistory" */)
);

const DetailLatencyBlock = defineAsyncComponent(() =>
  import('@/components/detail/DetailLatencyBlock.vue' /* webpackChunkName: "DetailLatencyBlock" */)
);

const DetailPayToRelay = defineAsyncComponent(() =>
  import('@/components/detail/DetailPayToRelay.vue' /* webpackChunkName: "DetailPayToRelay" */)
);

const DetailLog = defineAsyncComponent(() =>
  import('@/components/detail/DetailLog.vue' /* webpackChunkName: "DetailLog" */)
);

const DetailHeader = defineAsyncComponent(() =>
  import('@/components/detail/DetailHeader.vue' /* webpackChunkName: "DetailHeader" */)
);

const DetailTopics = defineAsyncComponent(() =>
  import('@/components/detail/DetailTopics.vue' /* webpackChunkName: "DetailTopics" */)
);

const DetailCapabilities = defineAsyncComponent(() =>
  import('@/components/detail/DetailCapabilities.vue' /* webpackChunkName: "DetailCapabilities" */)
);

const DetailNips = defineAsyncComponent(() =>
  import('@/components/detail/DetailNips.vue' /* webpackChunkName: "DetailNips" */)
);

const DetailNetwork = defineAsyncComponent(() =>
  import('@/components/detail/DetailNetwork.vue' /* webpackChunkName: "DetailNetwork" */)
);

const DetailSoftware = defineAsyncComponent(() =>
  import('@/components/detail/DetailSoftware.vue' /* webpackChunkName: "DetailSoftware" */)
);

const DetailPubKey = defineAsyncComponent(() =>
  import('@/components/detail/DetailPubKey.vue' /* webpackChunkName: "DetailPubKey" */)
);

const DetailLocalTime = defineAsyncComponent(() =>
  import('@/components/detail/DetailLocalTime.vue' /* webpackChunkName: "DetailLocalTime" */)
);

const DetailJson = defineAsyncComponent(() =>
  import('@/components/detail/DetailJson.vue' /* webpackChunkName: "DetailJson" */)
);



const localMethods = {
   
    async copy(text) {
      try {
        await navigator.clipboard.writeText(text);
      } catch($e) {
        ////console.log('Cannot copy');
      }
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
    
    RelaysNav,

    DetailHistory, 
    DetailLatencyBlock, 
    DetailPayToRelay, 
    DetailLog,
    DetailHeader,
    DetailTopics,
    DetailCapabilities,
    DetailNips,
    DetailNetwork,
    DetailPubKey,
    DetailSoftware,
    DetailLocalTime,
    DetailJson
    // VueGauge,
  },

  data() {
    return {
      relay: null,
      geo: {},
      events: {},
      interval: null,
      showRawData: false,
      showLatency: false,
      pulses : {},
      hbMin: 0,
      hbMax: 0,
      // result: null
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
    this.result.log = []
    this.result.state = 'pending'
    if(['json-nip-11','json-geo','json-dns','json-nostrwatch'].includes(this.$route.hash))
      this.store.layout.rawDataExpanded = true
  },

  unmounted(){
    clearInterval(this.interval)
  },

  methods: Object.assign(localMethods, RelaysLib, {
    setData(){
      this.relay = this.relayFromUrl
      this.lastUpdate = this.store.jobs.getLastUpdate(`relays/check/${this.relay}`)
      this.geo = this.store.relays.getGeo(this.relay)
      this.pulses = this.store.stats.getPulse(this.relay)
      this.hbMin = Math.min.apply(Math, this.pulses?.map( hb => hb.latency ))
      this.hbMax = Math.max.apply(Math, this.pulses?.map( hb => hb.latency ) )
      if(this.result?.topics)
        this.result.topics = this.result.topics.filter( topic => !this.store.prefs.ignoreTopics.split(',').includes(topic[0]) )
    }
  }),

  computed: Object.assign(SharedComputed, {
    result(){
      return this.store.results.get(this.relay)
    },
    // result(){
    //   const result = structuredClone(this.store.results.get(this.relay))
    //   result.state = 'pending'
    //   result.log = []
    //   return result
    // }
    sanitizeAndDetectEmail() {
      return str => {
        if( !(str instanceof String) )
          return
        // Sanitize the input string by removing any unwanted characters
        const sanitizedString = str.replace(/[^\w\s@]+/g, '');

        // Use a regular expression to find the email in the sanitized string
        const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g;
        const email = sanitizedString.match(emailRegex);

        return email ? email[0] : null;
      }
    },
    getTopics: function(){
      return this.result.topics.filter( topic => !this.store.prefs.ignoreTopics.split(',').includes(topic[0]) ).slice(0, 20)
    },
    normalizeTopic: function(){
      return topic => {
        const result = this.result
        const val = topic[1],
              minVal = result?.topics[result?.topics?.length-1][1], 
              maxVal = result?.topics[0][1],
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

    getSoftware: function(){
      return this.result?.info?.software
    },

    badgeLink(){
      return (nip) => `https://img.shields.io/static/v1?style=for-the-badge&label=NIP&message=${this.nipSignature(nip)}&color=black`
    },

    getFlag () {
      return this.geo?.countryCode ? countryCodeEmoji(this.geo?.countryCode) : emoji.get('shrug');
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
      }
    },
    getGeoClass(){
      return {
        'col-span-2': !this.result?.info && !this.log,
      }
    },

    getGeoWrapperClass(){
      return {
        'col-span-3': !this.result?.info && !this.log,
        'col-span-1': !this.result?.info,
      }
    },
    
  }),



})
</script>