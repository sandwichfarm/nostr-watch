<template>
  <tr :class="getHeadingClass()">
    <vue-final-modal v-model="showModal" classes="modal-container" content-class="modal-content">
      <div class="modal__content">
        <span>
          {{ queryJson(section) }}
        </span>
      </div>
    </vue-final-modal>
    <td colspan="11">
      <h2><span class="indicator badge">{{ query(section).length }}</span>{{ section }} <a @click="showModal=true" class="section-json" v-if="showJson">{...}</a></h2>
    </td>
  </tr>
  <tr :class="getHeadingClass()"  v-if="query(section).length > 0">
    <th class="table-column status-indicator"></th>

    <th class="table-column relay"></th>

    <th class="table-column verified">
      <span class="verified-shape-wrapper">
        <span class="shape verified"></span>
      </span>
    </th>
    <th class="table-column location" v-tooltip:top.tooltip="Ping">
      🌎
    </th>
    <th class="table-column latency" v-tooltip:top.tooltip="'Relay Latency on Read'">
      ⌛️
    </th>
    <th class="table-column connect" v-tooltip:top.tooltip="'Relay connection status'">
      🔌
    </th>
    <th class="table-column read" v-tooltip:top.tooltip="'Relay read status'">
      👁️‍🗨️
    </th>
    <th class="table-column write" v-tooltip:top.tooltip="'Relay write status'">
      ✏️
    </th>
    <th class="table-column info" v-tooltip:top.tooltip="'Additional information detected regarding the relay during processing'">
      ℹ️
    </th>
    <!-- <th class="table-column nip nip-20" v-tooltip:top.tooltip="'Does the relay support NIP-20'">
      <span>NIP-11</span>
    </th> -->
  </tr>
  <tr v-for="(relay, index) in query(section)" :key="{relay}" :class="getResultClass(relay, index)" class="relay">
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
import RelaySingleComponent from './RelaySingleComponent.vue'
import { VueFinalModal } from 'vue-final-modal'


export default defineComponent({
  name: 'RelayListComponent',
  components: {
    RelaySingleComponent,
    VueFinalModal
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
  methods: {
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
    query (aggregate) {
      let unsorted,
          sorted,
          filterFn

      filterFn = (relay) => this.grouping ? this.result?.[relay]?.aggregate == aggregate : true

      unsorted = this.relays.filter(filterFn);

      if(!this.isDone()) {
        return unsorted
      }

      if (unsorted.length) {
        sorted = unsorted.sort((relay1, relay2) => {
          return this.result?.[relay1]?.latency.final - this.result?.[relay2]?.latency.final
        })
        return sorted
      }

      return []
    },
    queryJson(aggregate){
      const relays = this.query(aggregate)
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
    position: relative;
    display: flex;
    flex-direction: column;
    max-height: 90%;
    max-width:400px;
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
