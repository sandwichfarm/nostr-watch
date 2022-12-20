<template>
  <table>
    <RelayGroupedListComponent
      section="public"
      :relays="relays"
      :result="result"
      :geo="geo"
      :messages="messages"
      :alerts="alerts"
      :connections="connections"
    />

    <RelayGroupedListComponent
      section="restricted"
      :relays="relays"
      :result="result"
      :geo="geo"
      :messages="messages"
      :alerts="alerts"
      :connections="connections"
    />

    <RelayGroupedListComponent
      section="offline"
      :relays="relays"
      :result="result"
      :geo="geo"
      :messages="messages"
      :alerts="alerts"
      :connections="connections"
    />

    <RelayGroupedListComponent
      section="processing"
      :relays="relays"
      :result="result"
      :messages="messages"
      :alerts="alerts"
      :connections="connections"
      :showJson="false"
    />
  </table>
</template>

<script>


import { defineComponent} from 'vue'
import RelayGroupedListComponent from '../lists/RelayGroupedListComponent.vue'

export default defineComponent({
  title: "nostr.watch registry & network status",
  name: 'GroupByAvailability',
  components: {
    RelayGroupedListComponent,
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
    return {}
  },
  computed: {},
})
</script>
<style scoped>
table {
  border-collapse: collapse !important;
}
</style>