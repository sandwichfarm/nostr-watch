<template>
  {{ relays }}
   <div class="pt-5 px-4 sm:px-6 lg:px-8">
      <div class="sm:flex sm:items-center">
      <div class="sm:flex-auto">
          <h1 class="text-xl font-semibold text-gray-900">
              <span class="inline-flex items-center rounded bg-green-500 px-2 py-0.5 text-xs text-indigo-800">
                  166
              </span>
              All Relays
          </h1>
          <p class="mt-2 text-sm text-gray-700">A list of all the users in your account including their name, title, email and role.</p>
      </div>
      <div class="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
          <button type="button" class="inline-flex items-center justify-center rounded-md border border-transparent bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:w-auto">Add Relay</button>
      </div>
      </div>
      <div class="mt-8 flex flex-col">
      <div class="-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div class="inline-block min-w-full py-2 align-middle md:px-6 lg:px-8">
          <div class="relative overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
              <!-- <div v-if="selectedRelays.length > 0" class="absolute top-0 left-12 flex h-12 items-center space-x-3 bg-gray-50 sm:left-16">
              <button type="button" class="inline-flex items-center rounded border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-30">Make Yours</button>
              </div> -->
              <table class="min-w-full table-auto divide-y divide-gray-300">
              <thead class="bg-gray-50">
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
                      v-bind:selectedRelays="selectedRelays" />
                  </tr>
              </tbody>
              </table>
          </div>
          </div>
      </div>
      </div>
    </div>
  </template>
  
  <script>
  import { defineComponent, toRefs } from 'vue'

  import SingleClearnet from '@/components/relays/SingleClearnet.vue'
  import RelaysLib from '@/shared/relays-lib.js'
  import { setupStore } from '@/store'
  
  const localMethods = {
      filterRelays: function(){
        const active = this.activeNavItem
        console.log(`${active} is active`)
        if( 'public' == active )
          this.relays = this.relays.filter( (relay) => this.results?.[relay]?.aggregate == 'public')
        if( 'restricted' == active )
          this.relays = this.relays.filter( (relay) => this.results?.[relay]?.aggregate == 'restricted')
        if( 'offline' == active )
          this.relays = this.relays.filter( (relay) => this.results?.[relay]?.aggregate == 'offline')
        // if( 'onion' == active )
          // this.filteredRelays = this.store.relays.getOnion
        // console.log('meow', this.activeNavItem, this.filteredRelays.length)
        // this.store.relays.setStat(this.activeNavItem, this.filteredRelays.length)
      },
      sortRelays: function() {
        if (this.relays.length) {
          this.relays
            .sort((relay1, relay2) => {
              return this.store.relays.results?.[relay1]?.latency.final - this.store.relays.results?.[relay2]?.latency.final
            })
            .sort((relay1, relay2) => {
              let a = this.store.relays.results?.[relay1]?.latency.final ,
                  b = this.store.relays.results?.[relay2]?.latency.final 
              return (b != null) - (a != null) || a - b;
            })
            .sort((relay1, relay2) => {
              let x = this.store.relays.results?.[relay1]?.check?.connect,
                  y = this.store.relays.results?.[relay2]?.check?.connect
              return (x === y)? 0 : x? -1 : 1;
            })
            // .sort((relay1, relay2) => {
            //   let x = this.store.relays.results?.[relay1]?.check?.read,
            //       y = this.store.relays.results?.[relay2]?.check?.read
            //   return (x === y)? 0 : x? -1 : 1;
            // })
            // .sort((relay1, relay2) => {
            //   let x = this.store.relays.results?.[relay1]?.check?.write,
            //       y = this.store.relays.results?.[relay2]?.check?.write
            //   return (x === y)? 0 : x? -1 : 1;
            // });
          // return this.relays
        }

        return []
      },
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
    },
    setup(props){
      const {resultsProp: results} = toRefs(props)
      return { 
        store : setupStore(),
        results: results
      }
    },
    mounted(){
      console.log('wahfdsfdsfdsjt?', this.relays)
      this.filterRelays()
      this.sortRelays()
      // this.relays = this.relaysProp
    },
    updated(){
      // this.relays = this.relaysProp
      this.filterRelays()
      this.sortRelays()
      console.log('from component', this.relays.length)
    },
    props: {
      showJson: {
        type: Boolean,
        default(){
          return true
        }
      },
      relaysProp: {
        type: Array,
        default(){
          return []
        }
      },
    },
    data() {
      return {
        selectedRelays: [],
        relays: []
      }
    },
    
    computed: {
      indeterminate: function(){
        return this.selectedRelays.length > 0 && this.selectedRelays.length < this.relays.length;
      }
    },
    methods: Object.assign(localMethods, RelaysLib)
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