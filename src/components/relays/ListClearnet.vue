<template>
   <div class="pt-5 px-1 sm:px-6 lg:px-8">
      <div class="sm:flex sm:items-center">
      <div class="sm:flex-auto text-left">
          <h1 class="text-4xl capitalize font-semibold text-gray-900">
              <span class="inline-flex rounded bg-green-800 text-sm px-2 py-1 text-white relative -top-2">
                  {{ relays.length }}
              </span>
              {{ activePageItem }} Relays
          </h1>
          <p class="mt-2 text-xl text-gray-700">
            {{ activePageData.description }}
          </p>
      </div>
      <div class="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
          <button type="button" class="inline-flex items-center justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-m font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:w-auto">Add Relay</button>
      </div>
      </div>
      <div class="mt-8 flex flex-col">

      <FindRelaysSubnav />

      <div class="-mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div class="inline-block min-w-full align-middle" v-if="relays.length">
            <div class="relative overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
                <!-- <div v-if="selectedRelays.length > 0" class="absolute top-0 left-12 flex h-12 items-center space-x-3 bg-gray-50 sm:left-16">
                <button type="button" class="inline-flex items-center rounded border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-30">Make Yours</button>
                </div> -->
                <table class="min-w-full table-auto divide-y divide-gray-300">
                <thead>
                    <tr>
                      <th scope="col" class="status-indicator text-left">
                        <!-- <input type="checkbox" 
                        class="absolute left-4 top-1/2 -mt-2 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 sm:left-6" 
                        :checked="indeterminate || selectedRelays.length === relays.length" 
                        :indeterminate="indeterminate" 
                        @change="selectedRelays = $event.target.checked ? relays : []"
                          /> -->
                      </th>
                      <th scope="col" class="relay">
                        
                      </th>
                      <th scope="col" class="verified">
                        <span class="verified-shape-wrapper">
                          <span class="shape verified"></span>
                        </span>
                      </th>
                      <th scope="col" class="location" v-tooltip:top.tooltip="Ping">
                        🌎
                      </th>
                      <th scope="col" class="latency" v-tooltip:top.tooltip="'Relay Latency on Read'">
                        ⌛️
                      </th>
                      <th scope="col" class="connect" v-tooltip:top.tooltip="'Relay connection status'">
                        🔌
                      </th>
                      <th scope="col" class="read" v-tooltip:top.tooltip="'Relay read status'">
                        👁️‍🗨️
                      </th>
                      <th scope="col" class="write" v-tooltip:top.tooltip="'Relay write status'">
                        ✏️
                      </th>
                    <!-- <th scope="col" class="relative py-3.5 pl-3 pr-4 sm:pr-6">
                        <span class="sr-only">Favorite</span>
                    </th> -->
                    </tr>
                </thead>
                <tbody class="divide-y divide-gray-200 bg-white">
                    <tr v-for="(relay, index) in this.relays" :key="relay" class="bg-gray-50" :class="getResultClass(relay, index)">
                      <SingleClearnet 
                        :relay="relay"
                        v-bind:selectedRelays="selectedRelays"
                        :resultProp="this.results[relay]" />
                        
                    </tr>
                </tbody>
                </table>
            </div>
          </div>
          <div class="inline-block min-w-full align-middle" v-if="!relays.length && activePageItem == 'favorite'">
            You have not selected any favorites. To select a favorite, click the heart emoji next to any relay in a relays list.
          </div>
      </div>
      </div>
    </div>
  </template>
  
  <script>
  import { defineComponent, toRefs } from 'vue'

  import SingleClearnet from '@/components/relays/SingleClearnet.vue'
  import FindRelaysSubnav from '@/components/relays/FindRelaysSubnav.vue'
  
  import RelaysLib from '@/shared/relays-lib.js'
  import { setupStore } from '@/store'
  
  const localMethods = {
      getResultClass (relay, index) {
        return {
          loaded: this.results[relay]?.state == 'complete',
          even: index % 2,
        }
      },
      queryJson(){
        const result = { relays: this.relays }
        return JSON.stringify(result,null,'\t')
      },
      relaysTotal () {
        return this.relays.length //TODO: Figure out WHY?
      },
  
      relaysConnected () {
        return Object.entries(this.result).length
      },
  
      relaysComplete () {
        return this.relays.filter(relay => this.results?.[relay]?.state == 'complete').length
      },
  
      sha1 (message) {
        const hash = crypto.createHash('sha1').update(JSON.stringify(message)).digest('hex')
        return hash
      },
  
      isDone(){
        return this.relaysTotal()-this.relaysComplete() <= 0
      },
  
      loadingComplete(){
        return this.isDone() ? 'loaded' : ''
      },
    }
  
  export default defineComponent({
    name: 'RelaysClearnet',
    components: {
      SingleClearnet,
      FindRelaysSubnav
    },
    setup(props){
      const {activePageItemProp: activePageItem} = toRefs(props)
      const {resultsProp: results} = toRefs(props)
      return { 
        store : setupStore(),
        results: results,
        activePageItem: activePageItem
      }
    },
    mounted(){
      setTimeout( () => this.relaysUpdate(), 1)
      this.activePageData = this.navData.filter( item => item.slug == this.activePageItem )[0]
      this.interval = setInterval( () => {
        if(this.store.relays.isProcessing)
          this.relaysUpdate()
      }, 1000 ) //Ugly, but better for reflow
    },
    updated(){
      console.log('state, updated')
      
    },
    props: {
      activePageItemProp: {
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
    },
    data() {
      return {
        selectedRelays: [],
        relays: [],
        timeout: null,
        navData: this.store.layout.getNavGroup('relays-find-pagenav'),
        activePageData: {}
      }
    },
    
    computed: {
      indeterminate: function(){
        return this.selectedRelays.length > 0 && this.selectedRelays.length < this.relays.length;
      }
    },
    methods: Object.assign(localMethods, RelaysLib),
    watch: {
      activePageItem: function(){
        this.activePageData = this.navData.filter( item => item.slug == this.activePageItem )[0]
        this.relaysUpdate()
      }
    }
  })
  </script>
  
  <style lang='css' scoped>
    table {
      border-collapse: collapse !important;
    }
    .nip span {
      text-transform: uppercase;
      letter-spacing:-1px;
      font-size:12px;
    }
  
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