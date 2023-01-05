<template>
  
  <SubnavComponent 
    v-bind:resultsProp="results" />

  <MapSingle
    :geo="geo"
    :relay="relay"
    :result="result"
    v-if="(geo instanceof Object)"
  />

  <div id="wrapper" class="mt-8 flex-container m-auto">

    <div class="overflow-hidden bg-white shadow sm:rounded-lg">
      <div class="px-4 py-5 sm:px-6">
        <h1>{{geo?.countryCode ? getFlag : ''}}<span @click="copy(relayFromUrl)">{{ relayFromUrl }}</span></h1>
        <p class="mt-1 max-w-2xl text-sm text-gray-500" v-if="result?.info?.description">{{ result.info.description }}</p>
      </div>
      <div class="border-t border-gray-200 px-4 py-5 sm:p-0">
        <dl class="sm:divide-y sm:divide-gray-200">
          <div class="py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:py-5 sm:px-6 font-extrabold" v-if="result?.info?.name">
            <dt class="text-sm font-medium text-gray-500">Relay Name</dt>
            <dd class="mt-1 text-sm text-gray-900 sm:col-span-2 sm:mt-0">{{ result.info.name }}</dd>
          </div>
          <div class="py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:py-5 sm:px-6 font-extrabold" v-if="result?.info?.pubkey">
            <dt class="text-sm font-medium text-gray-500">Public Key</dt>
            <dd class="mt-1 text-sm text-gray-900 sm:col-span-2 sm:mt-0"><code class="text-xs">{{ result.info.pubkey }}</code></dd>
          </div>
          <div class="py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:py-5 sm:px-6 font-extrabold" v-if="result?.info?.email">
            <dt class="text-sm font-medium text-gray-500">Contact</dt>
            <dd class="mt-1 text-sm text-gray-900 sm:col-span-2 sm:mt-0 "><SafeMail :email="result.info.email" /></dd>
          </div>
          <div class="py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:py-5 sm:px-6 font-extrabold" v-if="result?.info?.software">
            <dt class="text-sm font-medium text-gray-500">Software</dt>
            <dd class="mt-1 text-sm text-gray-900 sm:col-span-2 sm:mt-0">{{ result.info.software }}</dd>
          </div>
          <div class="py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:py-5 sm:px-6 font-extrabold" v-if="result?.info?.version">
            <dt class="text-sm font-medium text-gray-500">Software Version</dt>
            <dd class="mt-1 text-sm text-gray-900 sm:col-span-2 sm:mt-0"><code class="text-xs">{{ result.info.version }}</code></dd>
          </div>
          <div class="py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:py-5 sm:px-6 font-extrabold" v-if="result?.info?.version">
            <dt class="text-sm font-medium text-gray-500">Connection Status</dt>
            <dd class="mt-1 text-sm text-gray-900 sm:col-span-2 sm:mt-0">
              <span><img :src="badgeCheck('connect')" class="inline mr-3" /></span>
              <span><img :src="badgeCheck('read')" class="inline mr-3"/></span>
              <span><img :src="badgeCheck('write')" class="inline" /></span>
            </dd>
          </div>
          <div class="py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:py-5 sm:px-6 font-extrabold" v-if="result.info?.supported_nips">
            <dt class="text-sm font-medium text-gray-500">Supported Nips</dt>
            <dd class="mt-1 text-sm text-gray-900 sm:col-span-2 sm:mt-0">
              <span v-for="(nip) in result.info.supported_nips" :key="`${relay}_${nip}`" class="inline-block mr-3 mt-1">
                <a :href="nipLink(nip)" target="_blank" ><img :src="badgeLink(nip)" /></a> 
              </span>
            </dd>
          </div>
        </dl>
      </div>
    </div>

    <div class="overflow-hidden bg-white shadow sm:rounded-lg mt-8" v-if="geo">
      <div class="px-4 py-5 sm:px-6">
        <h3>DNS</h3>
        <p class="mt-1 max-w-2xl text-sm text-gray-500" v-if="result?.info?.description">{{ result.info.description }}</p>
      </div>
      <div class="border-t border-gray-200 px-4 py-5 sm:p-0">
        <dl class="sm:divide-y sm:divide-gray-200">
          <div class="py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:py-5 sm:px-6 font-extrabold"  v-for="(value, key) in Object.entries(geo.dns)" :key="`${value}_${key}`">
            <dt class="text-sm font-medium text-gray-500">{{ value[0] }}</dt>
            <dd class="mt-1 text-sm text-gray-900 sm:col-span-2 sm:mt-0">{{ value[1] }}</dd>
          </div>
        </dl>
      </div>
    </div>

    <div class="overflow-hidden bg-white shadow sm:rounded-lg mt-8" v-if="geo">
      <div class="px-4 py-5 sm:px-6">
        <h3>Geo Data {{geo?.countryCode ? getFlag : ''}}</h3>
        <p class="mt-1 max-w-2xl text-sm text-gray-500" v-if="result?.info?.description">{{ result.info.description }}</p>
      </div>
      <div class="border-t border-gray-200 px-4 py-5 sm:p-0">
        <dl class="sm:divide-y sm:divide-gray-200">
          <div class="py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:py-5 sm:px-6 font-extrabold"  v-for="(value, key) in Object.entries(geo).filter(value => value[0] != 'dns')" :key="`${value}_${key}`">
            <dt class="text-sm font-medium text-gray-500">{{ value[0] }}</dt>
            <dd class="mt-1 text-sm text-gray-900 sm:col-span-2 sm:mt-0">{{ value[1] }}</dd>
          </div>
        </dl>
      </div>
    </div>

  
    <div class="max-w-sm p-6 w-auto bg-white border border-gray-200 rounded-lg shadow-md dark:bg-gray-800 dark:border-gray-700" v-if="!result?.check?.connect">
      <h5 class="mb-2 text-2xl font-bold tracking-tight text-gray-900 dark:text-white">This Relay Appears to be offline</h5>
    </div>
  </div>
</template>

<script>

import { defineComponent} from 'vue'

import SubnavComponent from '@/components/relays/SubnavComponent.vue'
import MapSingle from '@/components/relays/MapSingle.vue'

import SafeMail from "@2alheure/vue-safe-mail";

import RelaysLib from '@/shared/relays-lib.js'
import SharedComputed from '@/shared/computed.js'

import { countryCodeEmoji } from 'country-code-emoji';
import emoji from 'node-emoji';

// import { relays } from '../../relays.yaml'
// import { geo } from '../../cache/geo.yaml'


import { setupStore } from '@/store'


import { useHead } from '@vueuse/head'



const localMethods = {
    badgeCheck(which){
      return `https://img.shields.io/static/v1?style=for-the-badge&label=&message=${which}&color=${this.result?.check?.[which] ? 'green' : 'red'}`
    },
    async copy(text) {
      try {
        await navigator.clipboard.writeText(text);
      } catch($e) {
        //console.log('Cannot copy');
      }
    },
}

export default defineComponent({
  name: 'SingleRelay',
  
  components: {
    MapSingle,
    SafeMail,
    SubnavComponent
    // RefreshComponent,
  },

  data() {
    return {
      result: {},
      relay: "",
      geo: {}
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

  beforeMount(){
    this.relay = this.relayFromUrl
    this.lastUpdate = this.store.relays.getLastUpdate
    this.result = this.getCache(this.relay)
    //
    console.log(this.$route.params)
    
    this.geo = this.store.relays.getGeo(this.relay)
    console.log(this.relay, this.lastUpdate, this.result, this.geo)
  },

  async mounted() {
    
  },

  computed: Object.assign(SharedComputed, {
    cleanUrl: function(){
      return (relay) => relay.replace('wss://', '')
    },
    relayFromUrl() {
      // We will see what `params` is shortly
      return `wss://${this.$route.params.relayUrl}`
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
  }),

  // updated() {
  //    Object.keys(this.timeouts).forEach(timeout => clearTimeout(this.timeouts[timeout]))
  //    Object.keys(this.intervals).forEach(interval => clearInterval(this.intervals[interval]))
  // },

  methods: Object.assign(localMethods, RelaysLib),

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
#wrapper {max-width:800px}


#relay-wrapper { margin: 50px 0 20px; padding: 20px 0}
h1 {cursor:pointer;font-size:40pt; margin: 0px 0 15px; padding:0 0 10px; border-bottom:3px solid #e9e9e9}
</style>
