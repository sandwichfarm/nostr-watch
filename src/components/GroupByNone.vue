<template>
  <table>
    <RelayListComponent
      :relays="relays"
      :result="result"
      :geo="geo"
      :messages="messages"
      :alerts="alerts"
      :connections="connections"
    />
  </table>
</template> 

<script>
import { defineComponent} from 'vue'
import RelayListComponent from './RelayListComponent.vue'

export default defineComponent({
  title: "nostr.watch registry & network status",
  name: 'GroupByNone',
  components: {
    RelayListComponent,
  },

  props: {
    showJson: {
      type: Boolean,
      default(){
        return true
      }
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
  mounted(){
    console.log(this.relays)
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