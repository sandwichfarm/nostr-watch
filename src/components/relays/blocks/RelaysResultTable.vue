<template>
   <div class="pt-0 px-1 sm:px-6 lg:px-8 dark:bg-black/20 rounded-lg">
      <div class="mt-8 flex flex-col">
      <div class="overflow-x-auto">
          <div class="inline-block min-w-full align-middle" v-if="subsectionRelays.length">
            <div class="relative overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
                <table class="min-w-full table-auto divide-y divide-gray-300">
                <thead>
                    <tr>
                      <th scope="col" class="text-left" colspan="2">
                        <span class="mr-3 hidden lg:inline-block">
                          <span 
                            :class="getThemeBtnClass('compact')" 
                            @click="store.prefs.setRowTheme('compact')">compact</span>
                          <span 
                            :class="getThemeBtnClass('comfortable')" 
                            @click="store.prefs.setRowTheme('comfortable')">comfortable</span>
                          <span 
                            :class="getThemeBtnClass('spacious')" 
                            @click="store.prefs.setRowTheme('spacious')">spacious</span>
                          <a
                            v-if="!store.layout.editorExpanded"
                            class="text-left inline-block underline text-xs ml-10" 
                            @click="this.setRandomRelay" 
                            target="_blank"
                            :href="`/relay/${relayClean(randomRelay)}`">
                             random relay
                            </a>
                        </span>
                        <span v-if="subsection != 'favorite' && store.relays.getFavorites.length" class="ml-6 text-slate-600">
                          <input type="checkbox" class=" cursor-pointer relative top-0.5 mr-1" id="relays-pin-favorites" v-model="store.prefs.pinFavorites" /> 
                          <label class="cursor-pointer font-thin text-xs" for="relays-pin-favorites">
                            pin favorites
                          </label>
                        </span>
                      </th>

                      <th v-if="store.layout.editorIsExpanded" scope="col" class="hidden md:table-cell lg:table-cell xl:table-cell verified">
                        <!-- <span class="verified-shape-wrapper">
                          <span class="shape verified"></span>
                        </span> -->
                        <code class="text-xs block">Read</code>
                      </th>

                      <th v-if="store.layout.editorIsExpanded" scope="col" class="hidden md:table-cell lg:table-cell xl:table-cell verified">
                        <!-- <span class="verified-shape-wrapper">
                          <span class="shape verified"></span>
                        </span> -->
                        <code class="text-xs block">Write</code>
                      </th>
                      
                      <!-- <th scope="col" class="relative py-3.5 pl-0 pr-0 sm:pr-0" v-if="isLoggedIn()">
                        <code class="text-xs block">Upvote</code>
                      </th> -->
                      <th v-if="!store.layout.editorIsExpanded" scope="col" class="hidden md:table-cell lg:table-cell xl:table-cell verified">
                        <!-- <span class="verified-shape-wrapper">
                          <span class="shape verified"></span>
                        </span> -->
                        <code class="text-xs block">NIP-11</code>
                      </th>
                      <th v-if="!store.layout.editorIsExpanded" scope="col" class="location text-center" v-tooltip:top.tooltip="'Detected location of Relay'">
                        <code class="text-xs block">Location</code>
                      </th>
                      <th v-if="!store.layout.editorIsExpanded" scope="col" class="latency text-center" v-tooltip:top.tooltip="'Relay Latency on Read'">
                        <code class="text-xs block">Latency</code>
                      </th>
                      <th v-if="!store.layout.editorIsExpanded" scope="col" class="hidden md:table-cell lg:table-cell xl:table-cell connect text-center" v-tooltip:top.tooltip="'Relay connection status'">
                        <code class="text-xs block">Connect</code>
                      </th>
                      <th v-if="!store.layout.editorIsExpanded" scope="col" class="hidden md:table-cell lg:table-cell xl:table-cell first-line:read text-center" v-tooltip:top.tooltip="'Relay read status'">
                        <code class="text-xs block">Read</code>
                      </th>
                      <th v-if="!store.layout.editorIsExpanded" scope="col" class="hidden md:table-cell lg:table-cell xl:table-cell write text-center" v-tooltip:top.tooltip="'Relay write status'">
                        <code class="text-xs block">Write</code>
                      </th>
                      <th v-if="store.tasks.getActiveSlug !== 'user/relay/list'" scope="col" class="relative py-3.5 pl-0 pr-0 sm:pr-0">
                        <code class="text-xs block">Favorite</code>
                      </th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-200 bg-white">
                    <tr 
                      v-for="(relay, index) in subsectionRelays"  
                      :key="generateKey(relay, 'aggregate')" 
                      :class="getResultClass(relay, index)" 
                      class="">

                      <td class="w-6 status-indicator w-2 text-left pr-2">
                        <span :class="getAggregateIndicator(relay)" class="block">
                        </span>
                      </td>

                      <td class="w-62 relay left-align relay-url">
                        <a :href="`/relay/${relayClean(relay)}`">{{ relay.replace('wss://', '') }}</a>
                      </td>

                      <!-- <td class="w-16 fav text-center" v-if="isLoggedIn()">
                        <a
                          class=" hover:opacity-100 cursor-pointer opacity-20" 
                          @click="likeRelay(relay)">
                          👍
                        </a>
                      </td> -->

                      <td v-if="!store.layout.editorIsExpanded" class="w-12 verified text-center md:table-cell lg:table-cell xl:table-cell">
                        <span v-if="this.results[relay]?.identities">
                          <span v-tooltip:top.tooltip="identityList(relay)"> <span class="verified-shape-wrapper cursor-pointer" v-if="Object.entries(results[relay]?.identities).length"><span class="shape verified"></span></span></span>
                        </span>
                      </td>

                      <td v-if="!store.layout.editorIsExpanded" class="w-24 location text-center">
                        {{ getFlag(relay) }}
                      </td>

                      <td v-if="!store.layout.editorIsExpanded" class="w-24 latency text-center">
                        <span>{{ results[relay]?.latency?.final }}<span v-if="results[relay]?.check?.latency">ms</span></span>
                      </td>

                      <td v-if="!store.layout.editorIsExpanded" class="w-16 content-center text-center hidden md:table-cell lg:table-cell xl:table-cell" :key="generateKey(relay, 'check.connect')">
                        <span class="m-auto block" :class="getCheckIndicator(relay, 'connect')">&nbsp;</span>
                      </td>

                      <td v-if="!store.layout.editorIsExpanded" class="w-16 content-center text-center hidden md:table-cell lg:table-cell xl:table-cell" :key="generateKey(relay, 'check.read')">
                        <span class="m-auto block" :class="getCheckIndicator(relay, 'read')">&nbsp;</span>
                      </td>

                      <td v-if="!store.layout.editorIsExpanded" class="w-16 content-center text-center hidden md:table-cell lg:table-cell xl:table-cell" :key="generateKey(relay, 'check.write')">
                        <span class="m-auto block" :class="getCheckIndicator(relay, 'write')">&nbsp;</span>
                      </td>

                      <!-- editor -->
                      <td v-if="store.tasks.getActiveSlug != 'user/relay/list' 
                                && store.layout.editorIsExpanded 
                                && typeof store.user.kind3?.[relay]?.read !== `undefined`"
                          class="text-center md:table-cell lg:table-cell xl:table-cell">
                        <Switch
                          v-model="store.user.kind3[relay].read" 
                          class="group relative inline-flex h-5 w-10 flex-shrink-0 cursor-pointer items-center justify-center rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2">
                          <span class="sr-only">Use setting</span>
                          <span aria-hidden="true" class="pointer-events-none absolute h-full w-full rounded-md bg-white dark:bg-black/10" />
                          <span aria-hidden="true" :class="[store.user.kind3[relay].read ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-black', 'pointer-events-none absolute mx-auto h-4 w-9 rounded-full transition-colors duration-200 ease-in-out']" />
                          <span aria-hidden="true" :class="[store.user.kind3[relay].read ? 'translate-x-5' : 'translate-x-0', 'pointer-events-none absolute left-0 inline-block h-5 w-5 transform rounded-full border border-gray-200 bg-white shadow ring-0 transition-transform duration-200 ease-in-out']" />
                        </Switch>
                      </td>

                      <td v-if="store.tasks.getActiveSlug != 'user/relay/list' 
                                && store.layout.editorIsExpanded 
                                && typeof store.user.kind3?.[relay]?.write !== `undefined`" 
                        class="text-center md:table-cell lg:table-cell xl:table-cell">
                        <Switch
                         
                          v-model="store.user.kind3[relay].write" 
                          class="group relative inline-flex h-5 w-10 flex-shrink-0 cursor-pointer items-center justify-center rounded-full 
                          focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2">
                          <span class="sr-only">Use setting</span>
                          <span aria-hidden="true" class="pointer-events-none absolute h-full w-full rounded-md bg-white dark:bg-black/10" />
                          <span aria-hidden="true" :class="[store.user.kind3[relay].write ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-black', 'pointer-events-none absolute mx-auto h-4 w-9 rounded-full transition-colors duration-200 ease-in-out']" />
                          <span aria-hidden="true" :class="[store.user.kind3[relay].write ? 'translate-x-5' : 'translate-x-0', 'pointer-events-none absolute left-0 inline-block h-5 w-5 transform rounded-full border border-gray-200 bg-white shadow ring-0 transition-transform duration-200 ease-in-out']" />
                        </Switch>
                      </td>

                      <td 
                        colspan="2" 
                        v-if="store.layout.editorIsExpanded && store.tasks.getActiveSlug == 'user/relay/list'" 
                        class="w-auto text-center md:table-cell lg:table-cell xl:table-cell">
                        <svg class="animate-spin mr-1 -mt-0.5 h-4 w-5 text-white inline" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      </td>

                      <td v-if="store.tasks.getActiveSlug !== 'user/relay/list'"  class="w-16 fav text-center">
                        <a
                          class="hover:opacity-100 cursor-pointer" 
                          :class="store.relays.isFavorite(relay) ? 'opacity-100' : 'opacity-10'"
                          @click="store.relays.toggleFavorite(relay)">
                          ❤️
                        </a>
                      </td>
                      
                    </tr>
                </tbody>
                </table>
            </div>
          </div>
          <div class="text-xl block min-w-full align-middle py-8 bg-slate-100 rounded-lg" v-if="!store.relays.getFavorites.length && subsection == 'favorite'">
            You have not selected any favorites. To select a favorite, click the heart emoji next to any relay in a relays list.
          </div>
      </div>
      </div>
    </div>
  </template>
  
  <script>
  import { defineComponent, toRefs } from 'vue'
  import { countryCodeEmoji } from 'country-code-emoji';
  import emoji from 'node-emoji';
  import crypto from 'crypto'
  import { Switch } from '@headlessui/vue'

  // import SingleClearnet from '@/components/relays/SingleClearnet.vue'
  
  import RelaysLib from '@/shared/relays-lib.js'
  import UserLib from '@/shared/user-lib.js'
  // import { screenIs } from '@/shared/layout.js'

  import {validateEvent, getEventHash, verifySignature} from 'nostr-tools'
  
  import { setupStore } from '@/store'
  
  const localMethods = {
    setRandomRelay(){
      this.randomRelay = this.store.relays.getShuffledPublic[0]
    },
    async likeRelay(relay){
      const id = this.store.relays.getCanonical(relay)
      const event = {
        created_at: Math.floor(Date.now()/1000),
        kind: 7,
        content: '+',
        tags: [
          ['e', id],
          ['p', this.store.user.getPublicKey]
        ],
        pubkey: this.store.user.getPublicKey
      }
      event.id = getEventHash(event)

      console.log('like event', event)
      const signedEvent = await window.nostr.signEvent(event)

      let ok = validateEvent(signedEvent)
      let veryOk = await verifySignature(signedEvent)

      console.log('valid event?', ok, veryOk)
    },
  }
  
  export default defineComponent({
    name: 'ListClearnet',
    components: {
      // SingleClearnet,
      Switch,
    },
    setup(props){
      const {subsectionProp: subsection} = toRefs(props)
      const {relaysCountProp: relaysCount} = toRefs(props)
      const {resultsProp: results} = toRefs(props)
      return { 
        store : setupStore(),
        results: results,
        subsection: subsection,
        relaysCount: relaysCount
      }
    },
    
    mounted(){
      //console.log('navdata', this.navData, this.navData.filter( item => item.slug == this.subsection )[0], this.navData.filter( item => item.slug == this.subsection ))
      this.activePageData = this.navData.filter( item => item.slug == this.subsection )[0]
      this.setRandomRelay()
    },
    updated(){
    },
    beforeUnmount(){
    },
    unmounted(){
      delete this.results
    },
    props: {
      subsectionProp: {
        type: String,
        default(){
          return ""
        }
      },
      resultsProp: {
        type: Object,
        default(){
          return {}
        }
      },
      relaysCountProp: {
        type: Object,
        default(){
          return {}
        }
      },
    },
    data() {
      return {
        selectedRelays: [],
        relays: [],
        timeout: null,
        navData: this.store.layout.getNavGroup('relays/find'),
        activePageData: {},
        randomRelay: "",
        enabled: false
      }
    },
    computed: {
      subsectionRelays(){
        return this.getRelays( this.store.relays.getRelays(this.subsection, this.results ) )
      },
      relayGeo(){
        return (relay) => this.store.relays.getGeo(relay)
      },
      getThemeBtnClass(){
        return (key) => {
          return {
            'border-1 border-bottom text-black': this.store.prefs.getTheme === key,
            'text-slate-400': this.store.prefs.getTheme !== key,
            'text-xs px-3 mr-1 cursor-pointer': true,
          }
        }
      },
      getResultClass() {
        return (relay, index) => {
          //console.log(this.store.prefs.getTheme)
          return {
            loaded: this.results[relay]?.state == 'complete',
            'bg-slate-100': index % 2,
            'bg-red-50 hover:bg-red-100': this.store.relays.isFavorite(relay),
            'bg-gray-50 hover:bg-slate-200': !this.store.relays.isFavorite(relay),
            'xl:text-2xl xl:h-16': this.store.prefs.getTheme === 'spacious',
            'xl:text-xl xl:h-9': this.store.prefs.getTheme === 'comfortable',
            // '': this.store.prefs.getTheme === 'compact',
          }
        }
      },
      getCheckIndicator(){
        return (relay, key) => {
          return { 
            'bg-green-500': this.results[relay]?.check?.[key] !== false,
            'bg-red-500': this.results[relay]?.check?.[key] === false,
            'bg-gray-500': 'undefined' === typeof this.results[relay]?.check?.[key],
            // '': this.store.prefs.getTheme === 'spacious',
            // '': this.store.prefs.getTheme === 'comfortable',
            'text-2xl h-16 block m-auth h-6 w-6 rounded-xl': this.store.prefs.getTheme === 'spacious',
            'text-xl block m-auth h-5 w-5 rounded-2xl': this.store.prefs.getTheme === 'comfortable',
            'text-xl block m-auth h-4 w-4 rounded-2xl': this.store.prefs.getTheme === 'compact',
            // 'success': this.results[relay]?.check?.[key] !== false,
            // 'failure': this.results[relay]?.check?.[key] === false,
            // 'pending': 'undefined' === typeof this.results[relay]?.check?.[key] 
            }
        } 
      },
      getAggregateIndicator(){
        return (relay) => {
          return { 
            'w-4 h-4 bg-green-500': this.results[relay]?.aggregate === 'public',
            'w-4 h-4 bg-orange-500': this.results[relay]?.aggregate === 'restricted',
            'w-4 h-4 bg-red-500': this.results[relay]?.aggregate === 'offline',
            'ml-4': this.store.prefs.getTheme === 'spacious',
            'ml-2': this.store.prefs.getTheme === 'comfortable',
            'ml-1': this.store.prefs.getTheme === 'compact',
            // '': this.store.prefs.getTheme === 'spacious',
            // '': this.store.prefs.getTheme === 'comfortable',
            // 'text-2xl h-16 block m-auth h-6 w-6 rounded-xl': this.store.prefs.getTheme === 'spacious',
            // 'text-xl block m-auth h-5 w-5 rounded-2xl': this.store.prefs.getTheme === 'comfortable',
            // 'text-xl block m-auth h-4 w-4 rounded-2xl': this.store.prefs.getTheme === 'compact',
            // 'success': this.results[relay]?.check?.[key] !== false,
            // 'failure': this.results[relay]?.check?.[key] === false,
            // 'pending': 'undefined' === typeof this.results[relay]?.check?.[key] 
            }
        } 
      },
      generateKey(){
        return (url, key) => crypto.createHash('md5').update(`${url}_${key}`).digest('hex')
      },
      getFlag () {
        return (relay) => this.relayGeo(relay)?.countryCode ? countryCodeEmoji(this.relayGeo(relay)?.countryCode) : emoji.get('shrug');
      },
      identityList () {
        return (relay) => {
          let string = '',
              extraString = '',
              users = Object.entries(this.results[relay]?.identities),
              count = 0

          if(this.results[relay]?.identities) {
            if(this.results[relay]?.identities.serverAdmin) {
              string = `Relay has registered an administrator pubkey: ${this.results[relay]?.identities.serverAdmin}. `
              extraString = "Additionally, "
            }

            const total = users.filter(([key]) => key!='serverAdmin').length,
                  isOne = total==1

            if(total) {
              string = `${string}${extraString}Relay domain contains NIP-05 verification data for:`
              users.forEach( ([key]) => {
                if(key == "serverAdmin") return
                count++
                string = `${string} ${(count==total && !isOne) ? 'and' : ''}  @${key}${(count!=total && !isOne) ? ', ' : ''}`
              })
            }
          }
          return string
        }
      },
      relayClean() {
        return (relay) => relay.replace('wss://', '')
      },
    },
    methods: Object.assign(RelaysLib, UserLib, localMethods),
  })
  </script>

<!-- <style lang=“postcss”>
.indicator {
  @apply h-4 w-4 block rounded-lg
}
</style> -->
  
  <style lang='css' scoped>
    

    /* table {
      border-collapse: collapse !important;
    } */
  
    .section-json {
      font-size:13px;
      color: #555;
      cursor:pointer;
    }
  
    ::v-deep(.modal-container) {
      display: flex;
      justify-content: center;
      align-items: center;
    }
    ::v-deep(.modal-content) {
      position: relative;
      display: flex;
      flex-direction: Column;
      max-height: 90%;
      max-width:800px;
      margin: 0 1rem;
      padding: 1rem;
      border: 1px solid #e2e8f0;
      border-radius: 0.25rem;
      background: #fff;
    }
    .modal__title {
      margin: 0 2rem 0 0;
      font-size: 1.5rem;
      font-weight: 700;
    }
    .modal__content {
      flex-grow: 1;
      overflow-y: auto;
    }
    .modal__action {
      display: flex;
      justify-content: center;
      align-items: center;
      flex-shrink: 0;
      padding: 1rem 0 0;
    }
    .modal__close {
      position: absolute;
      top: 0.5rem;
      right: 0.5rem;
    }
  
    .nip-11 a { cursor: pointer }
  
    tr.even {
      background:#f3f3f3;
    }

    tr {
      border-top:none;
    }
    </style>