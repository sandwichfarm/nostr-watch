<template>
  <tr :class="getHeadingClass()">
    <vue-final-modal v-model="showModal" classes="modal-container" content-class="modal-content">
      <div class="modal__content">
        <pre>
          {{ queryJson(section) }}
        </pre>
      </div>
    </vue-final-modal>
    <td colspan="11">
      <h2><span class="indicator badge">{{ sort(section).length }}</span>{{ section }} <a @click="showModal=true" class="section-json" v-if="showJson">{...}</a></h2>
    </td>
  </tr>
  <tr :class="getHeadingClass()"  v-if="sort(section).length > 0">
    <TableHeaders />
  </tr>
  <tr v-for="(relay, index) in sort(section)" :key="{relay}" :class="getResultClass(relay, index)" class="relay">
    <RelaySingleComponent
      :relay="relay"
      :result="result[relay]"
      :geo="geo[relay]"
      :showColumns="showColumns"
      :connection="connections[relay]"
    />
  </tr>
</template>

<script>
import { defineComponent} from 'vue'
import { VueFinalModal } from 'vue-final-modal'

import RelaySingleComponent from './RelaySingleComponent.vue'
import TableHeaders from './TableHeaders.vue'

import RelaysLib from '../lib/relays-lib.js'

const localMethods = {
  getHeadingClass(){
    return {
      online: this.section != "offline",
      public: this.section == "public",
      offline: this.section == "offline",
      restricted: this.section == "restricted"
    }
  },
  getResultClass (relay, index) {
    return {
      loaded: this.result?.[relay]?.state == 'complete',
      online: this.section != "offline",
      offline: this.section == "offline",
      public: this.section == "public",
      even: index % 2,
    }
  },
  sort_by_latency(ascending) {
    const self = this
    return function (a, b) {
      // equal items sort equally
      if (self.result?.[a]?.latency.final === self.result?.[b]?.latency.final) {
          return 0;
      }

      // nulls sort after anything else
      if (self.result?.[a]?.latency.final === null) {
          return 1;
      }
      if (self.result?.[b]?.latency.final === null) {
          return -1;
      }

      // otherwise, if we're ascending, lowest sorts first
      if (ascending) {
          return self.result?.[a]?.latency.final - self.result?.[b]?.latency.final;
      }

      // if descending, highest sorts first
      return self.result?.[b]?.latency.final-self.result?.[a]?.latency.final;
    };
  },
  queryJson(aggregate){
    const relays = this.sort(aggregate)
    const result = {}
    result.relays = relays.map( relay => relay )
    return JSON.stringify(result,null,'\t')
  },
  relaysTotal () {
    return this.relays.length
  },
  relaysConnected () {
    return Object.keys(this.result).length
  },
  relaysCompleted () {
    let value = Object.entries(this.result).map((value) => { return value.state == 'complete' }).length
    return value
  },
  isDone(){
    return this.relaysTotal()-this.relaysCompleted() == 0
  },
}

export default defineComponent({
  name: 'RelayListComponent',
  components: {
    RelaySingleComponent,
    VueFinalModal,
    TableHeaders
  },
  props: {
    showJson: {
      type: Boolean,
      default(){
        return true
      }
    },
    section: {
      type: String,
      required: true,
      default: ""
    },
    relays:{
      type: Object,
      default(){
        return {}
      }
    },
    result: {
      type: Object,
      default(){
        return {}
      }
    },
    geo: {
      type: Object,
      default(){
        return {}
      }
    },
    messages: {
      type: Object,
      default(){
        return {}
      }
    },
    alerts: {
      type: Object,
      default(){
        return {}
      }
    },
    connections: {
      type: Object,
      default(){
        return {}
      }
    },
    showColumns: {
      type: Object,
      default() {
        return {
          connectionStatuses: false,
          nips: false,
          geo: false,
          additionalInfo: false
        }
      }
    },
    grouping: {
      type: Boolean,
      default(){
        return true
      }
    }
  },
  data() {
    return {
      showModal: false
    }
  },
  mounted(){},
  computed: {},
  methods: Object.assign(localMethods, RelaysLib)
})
</script>

<style lang='css' scoped>
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
    text-align:left;
    position: relative;
    display: flex;
    flex-direction: column;
    max-height: 500px;
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
