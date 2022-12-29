<template>
  <table v-for="section of sections" :key="`section-${section}`">
    <tr :class="getHeadingClass(section)">
      <!-- <vue-final-modal v-model="showModal" classes="modal-container" content-class="modal-content">
        <div class="modal__content">
          <pre>
            {{ queryJson(section) }}
          </pre>
        </div>
      </vue-final-modal> -->
      <td colspan="11">
        <h2><span class="indicator badge">{{ sort(getByAggregate(section)).length }}</span>{{ section }} <a @click="showModal=true" class="section-json" v-if="showJson">{...}</a></h2>
      </td>
    </tr>
    <tr :class="getHeadingClass()"  v-if="sort(getByAggregate(section)). length > 0">
      <TableHeaders />
    </tr>
    <tr v-for="(relay, index) in sort(getByAggregate(section))" :key="{relay}" :class="getResultClass(relay, index, section)" class="relay">
      <RelaySingleComponent
        :relay="relay" />
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
  getByAggregate(section){
    return this.store.relays.getByAggregate(section)
  },
  getHeadingClass(section){
    return {
      online: section != "offline",
      public: section == "public",
      offline: section == "offline",
      restricted: section == "restricted"
    }
  },
  getResultClass (relay, index, section) {
    return {
      loaded: this.store.relays.results?.[relay]?.state == 'complete',
      online: section != "offline",
      offline: section == "offline",
      public: section == "public",
      even: index % 2,
    }
  },
  // queryJson(aggregate){
  //   // const relays = this.sort(this.store.relays.getByAggregate(aggregate))
  //   // const result = {}
  //   // result.relays = relays.map( relay => relay )
  //   // return JSON.stringify(result,null,'\t')
  // },
  relaysTotal () {
    return this.relays.length
  },
  relaysConnected () {
    return Object.keys(this.store.relays.results).length
  },
  relaysCompleted () {
    let value = Object.entries(this.store.relays.results).map((value) => { return value.state == 'complete' }).length
    return value
  },
  isDone(){
    return this.relaysTotal()-this.relaysCompleted() == 0
  },
}

export default defineComponent({
  name: 'GroupByAvailability',
  components: {
    RelaySingleComponent,
    TableHeaders
  },
  props: {},
  setup(){
    return { 
      store : setupStore()
    }
  },
  data() {
    return {
      showModal: false,
      showJson: false,
      sections: ['public', 'restricted', 'offline'],
      groups: {},
      relays: [],
      section: ""
    }
  },
  mounted(){
    this.relays = this.store.relays.getAll
    console.log(this.relays)
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
    text-align:left;
    position: relative;
    display: flex;
    flex-direction: Column;
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