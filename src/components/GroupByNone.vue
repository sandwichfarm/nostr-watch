<template>
  <table>
    <tr>
      <td colspan="11">
        <h2><span class="indicator badge">{{ this.relays.length }}</span>Relays <a @click="showModal=true" class="section-json" v-if="showJson">{...}</a></h2>
      </td>
    </tr>
    <tr v-if="this.relays.length > 0">
      <TableHeaders />
    </tr>
    <tr v-for="(relay, index) in sort()" :key="{relay}" class="relay" :class="getResultClass(relay, index)">
      <RelaySingleComponent 
        :relay="relay"
      />
    </tr>
  </table>
</template>

<script>
import { defineComponent} from 'vue'

import RelaySingleComponent from './RelaySingleComponent.vue'
import TableHeaders from './TableHeaders.vue'

import RelaysLib from '../shared/relays-lib.js'

import { setupStore } from '../store'

const localMethods = {
    // getHeadingClass(){
    //   return {
    //     online: this.section != "offline",
    //     public: this.section == "public",
    //     offline: this.section == "offline",
    //     restricted: this.section == "restricted"
    //   }
    // },
    getResultClass (relay, index) {
      return {
        loaded: this.store.relays.getResult(relay)?.state == 'complete',
        even: index % 2
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
  name: 'GroupByNone',
  components: {
    RelaySingleComponent,
    TableHeaders,
  },
  setup(){
    return { 
      store : setupStore()
    }
  },
  mounted(){
    this.relays = this.store.relays.getAll
  },
  props: {
    showJson: {
      type: Boolean,
      default(){
        return true
      }
    },
  },
  data() {
    return {
      showModal: false,
      relays: []
    }
  },
  
  computed: {},
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
    background:#f9f9f9
  }
  </style>