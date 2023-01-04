<template>
   <div class="pt-5 px-1 sm:px-6 lg:px-8">
      <div class="mt-8 flex flex-col">
      <div class="overflow-x-auto">
          <div class="inline-block min-w-full align-middle" v-if="subsectionRelays.length">
            <div class="relative overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
                <table class="min-w-full table-auto divide-y divide-gray-300">
                <thead>
                    <tr>
                      
                      <th scope="col" class="status-indicator text-left">
                        
                      </th>
                      <th scope="col" class="relay text-left">
                        <NostrSyncPopoverNag  v-if="activePageItem == 'favorite'"  />
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
                      <th scope="col" class="relative py-3.5 pl-0 pr-0 sm:pr-0">
                          <span class="text-xs"> &lt;3 </span>
                          
                      </th>
                    </tr>
                    
                </thead>
                
                <tbody class="divide-y divide-gray-200 bg-white">
                    <tr v-for="(relay, index) in subsectionRelays" :key="relay" class="bg-gray-50" :class="getResultClass(relay, index)">
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
  import NostrSyncPopoverNag from '@/components/relays/partials/NostrSyncPopoverNag.vue'
  
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
    name: 'ListClearnet',
    components: {
      SingleClearnet,
      NostrSyncPopoverNag
    },
    setup(props){
      const {activePageItemProp: activePageItem} = toRefs(props)
      const {relaysCountProp: relaysCount} = toRefs(props)
      const {resultsProp: results} = toRefs(props)
      return { 
        store : setupStore(),
        results: results,
        activePageItem: activePageItem,
        relaysCount: relaysCount
      }
    },
    mounted(){
      this.activePageData = this.navData.filter( item => item.slug == this.activePageItem )[0]
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
        navData: this.store.layout.getNavGroup('relays-find-pagenav'),
        activePageData: {}
      }
    },
    
    computed: {
      subsectionRelays(){
        return this.sortRelays( this.store.relays.getRelays(this.activePageItem, this.results ) )
      }
    },
    methods: Object.assign(RelaysLib, localMethods),
    // watch: {
    //   activePageItem: function(){
    //     // this.activePageData = this.navData.filter( item => item.slug == this.activePageItem )[0]
    //     // this.relaysUpdate()
    //   }
    // }
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