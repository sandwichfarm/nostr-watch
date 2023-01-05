<template>
  <metainfo>
    <template v-slot:title="{ content }">{{ `${cleanUrl(this.relay)} | ${content}` }}</template>
  </metainfo>

  <MapSingle
    :geo="geo"
    :relay="relay"
    :result="result"
  />

  <div id="wrapper" class="mt-8 flex-container m-auto">

    <div class="overflow-hidden bg-white shadow sm:rounded-lg">
      <div class="px-4 py-5 sm:px-6">
        <h3 class="text-lg font-medium leading-6 text-gray-900">Applicant Information</h3>
        <p class="mt-1 max-w-2xl text-sm text-gray-500">Personal details and application.</p>
      </div>
      <div class="border-t border-gray-200 px-4 py-5 sm:p-0">
        <dl class="sm:divide-y sm:divide-gray-200">
          <div class="py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:py-5 sm:px-6">
            <dt class="text-sm font-medium text-gray-500">Full name</dt>
            <dd class="mt-1 text-sm text-gray-900 sm:col-span-2 sm:mt-0">Margot Foster</dd>
          </div>
          <div class="py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:py-5 sm:px-6">
            <dt class="text-sm font-medium text-gray-500">Application for</dt>
            <dd class="mt-1 text-sm text-gray-900 sm:col-span-2 sm:mt-0">Backend Developer</dd>
          </div>
          <div class="py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:py-5 sm:px-6">
            <dt class="text-sm font-medium text-gray-500">Email address</dt>
            <dd class="mt-1 text-sm text-gray-900 sm:col-span-2 sm:mt-0">margotfoster@example.com</dd>
          </div>
          <div class="py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:py-5 sm:px-6">
            <dt class="text-sm font-medium text-gray-500">Salary expectation</dt>
            <dd class="mt-1 text-sm text-gray-900 sm:col-span-2 sm:mt-0">$120,000</dd>
          </div>
          <div class="py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:py-5 sm:px-6">
            <dt class="text-sm font-medium text-gray-500">About</dt>
            <dd class="mt-1 text-sm text-gray-900 sm:col-span-2 sm:mt-0">Fugiat ipsum ipsum deserunt culpa aute sint do nostrud anim incididunt cillum culpa consequat. Excepteur qui ipsum aliquip consequat sint. Sit id mollit nulla mollit nostrud in ea officia proident. Irure nostrud pariatur mollit ad adipisicing reprehenderit deserunt qui eu.</dd>
          </div>
          <div class="py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:py-5 sm:px-6">
            <dt class="text-sm font-medium text-gray-500">Attachments</dt>
            <dd class="mt-1 text-sm text-gray-900 sm:col-span-2 sm:mt-0">
              <ul role="list" class="divide-y divide-gray-200 rounded-md border border-gray-200">
                <li class="flex items-center justify-between py-3 pl-3 pr-4 text-sm">
                  <div class="flex w-0 flex-1 items-center">
                    <PaperClipIcon class="h-5 w-5 flex-shrink-0 text-gray-400" aria-hidden="true" />
                    <span class="ml-2 w-0 flex-1 truncate">resume_back_end_developer.pdf</span>
                  </div>
                  <div class="ml-4 flex-shrink-0">
                    <a href="#" class="font-medium text-indigo-600 hover:text-indigo-500">Download</a>
                  </div>
                </li>
                <li class="flex items-center justify-between py-3 pl-3 pr-4 text-sm">
                  <div class="flex w-0 flex-1 items-center">
                    <PaperClipIcon class="h-5 w-5 flex-shrink-0 text-gray-400" aria-hidden="true" />
                    <span class="ml-2 w-0 flex-1 truncate">coverletter_back_end_developer.pdf</span>
                  </div>
                  <div class="ml-4 flex-shrink-0">
                    <a href="#" class="font-medium text-indigo-600 hover:text-indigo-500">Download</a>
                  </div>
                </li>
              </ul>
            </dd>
          </div>
        </dl>
      </div>
    </div>

    <div id="relay-wrapper">

      <h2 @click="copy(relayFromUrl)">{{ relayFromUrl }}</h2>

      <span  class="badges">
        <span><img :src="badgeCheck('connect')" /></span>
        <span><img :src="badgeCheck('read')" /></span>
        <span><img :src="badgeCheck('write')" /></span>
      </span>

      <span v-if="result.info?.supported_nips" class="badges">
        <span v-for="(nip) in result.info.supported_nips" :key="`${relay}_${nip}`">
            <a :href="nipLink(nip)" target="_blank"><img :src="badgeLink(nip)" /></a>
        </span>
      </span>


      <Row container :gutter="12" v-if="!result?.check?.connect">
        <Column :xs="12" :md="12" :lg="12" class="title-card">
          This relay appears to be offline.
        </Column>
      </Row>

      <Row container :gutter="12" v-if="result?.check?.connect">
        <Column :xs="12" :md="12" :lg="12" class="title-card">
            <table v-if="result.info">
              <tr>
                <th colspan="2"><h4>Info</h4></th>
              </tr>
              <tbody v-if="result.info">
                <tr v-for="(value, key) in Object.entries(result.info).filter(value => value[0] != 'id' && value[0] != 'supported_nips')" :key="`${value}_${key}`">
                    <td>{{ value[0] }}</td>
                    <td v-if="value[0]!='contact' && value[0]!='pubkey' && value[0]!='software' && value[0]!='version'">{{ value[1] }} </td>
                    <td v-if="value[0]=='contact'"><SafeMail :email="value[1]" /></td>
                    <td v-if="value[0]=='pubkey' || value[0]=='version'"><code>{{ value[1] }}</code></td>
                    <td v-if="value[0]=='software'"><a :href="value[1]">{{ value[1] }}</a></td>
                </tr>
              </tbody>
              <tr v-if="Object.entries(result.info).length == 0 && result.check.connect">
                Relay does not have NIP-11 support, or the administrator has not configured the relay to return information.
              </tr>
            </table>

            <table v-if="result.identities">
              <tr>
                <th colspan="2"><h4>Identities</h4></th>
              </tr>
              <tbody v-if="result.identities">
                <tr v-for="(value, key) in Object.entries(result?.identities)" :key="`${value}_${key}`">
                  <td>{{ value[0] }}</td>
                  <td><code>{{ value[1] }}</code></td>
                </tr>
                <tr v-if="Object.entries(result.identities).length==0">
                  Relay does not provide NIP-05 support and has not registered an administrator key.
                </tr>
              </tbody>
            </table>

          </Column>
          <Column :xs="12" :md="6" :lg="6" class="title-card">
            <table v-if="geo">
              <tr>
                <th colspan="2"><h4>GEO {{geo?.countryCode ? getFlag : ''}}</h4></th>
              </tr>
              <tbody v-if="geo">
                <tr v-for="(value, key) in Object.entries(geo)" :key="`${value}_${key}`">
                  <td>{{ value[0] }}</td>
                  <td>{{ value[1] }} </td>
                </tr>
              </tbody>
            </table>
          </Column>
          <Column :xs="12" :md="6" :lg="6" class="title-card">
            <table v-if="geo">
              <tr>
                <th colspan="2"><h4>DNS</h4></th>
              </tr>
              <tbody v-if="geo">
                <tr v-for="(value, key) in Object.entries(geo.dns)" :key="`${value}_${key}`">
                <td>{{ value[0] }}</td>
                <td>{{ value[1] }} </td>
              </tr>
              </tbody>
            </table>
          </Column> 
      </Row>
      

     <!--  <RefreshComponent 
          :relay="relay"
        /> -->
    </div>
    

  </div>
</template>

<script>

import { defineComponent} from 'vue'

import MapSingle from '@/components/relays/MapSingle.vue'

import { Row, Column } from 'vue-grid-responsive';
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
    Row,
    Column,
    MapSingle,
    SafeMail,
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
ul, ul li { padding:0; margin:0; list-style:none; }
td { padding:5px 10px; }
th h4 { text-align:center; padding:5px 10px; margin:0 0 6px; background:#f0f0f0; }
table {margin:20px 10px 20px; border: 2px solid #f5f5f5; padding:20px}
tr td:first-child { text-align:right }
tr td:last-child { text-align:left }
.indicator { display: table-cell; width:33% ; font-weight:bold; text-align: center !important; color: white; text-transform: uppercase; font-size:0.8em}
body, .grid-Column { padding:0; margin:0; }
.badges { display:block; margin: 10px 0 11px}
.badges > span {margin-right:5px}
#wrapper {max-width:800px}


#relay-wrapper { margin: 50px 0 20px; padding: 20px 0}
h2 {cursor:pointer;font-size:40pt; margin: 0px 0 15px; padding:0 0 10px; border-bottom:3px solid #e9e9e9}
</style>
