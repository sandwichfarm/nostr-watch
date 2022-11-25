<template>
  <td class="status-indicator" :key="generateKey(relay, 'aggregate')">
    <span :class="result.aggregate" class="aggregate indicator">
        <span></span>
        <span></span>
    </span>
  </td>

  <td class="relay left-align relay-url" @click="copy(relay)">
    {{ relay }}
  </td>

  <td class="verified">
    <span v-tooltip:top.tooltip="nip05List()"> <span class="verified-shape-wrapper" v-if="result.nips[5]"><span class="shape verified"></span></span></span>
  </td>

  <!-- <td>{{result.flag}}</td> -->

  <td class="latency">
    <span>{{ result.latency.final }}<span v-if="result.check.latency">ms</span></span>
  </td>

  <td class="connect" :key="generateKey(relay, 'check.connect')">
    <span :class="getResultClass(relay, 'connect')"></span>
  </td>

  <td class="read" :key="generateKey(relay, 'check.read')">
    <span :class="getResultClass(relay, 'read')"></span>
  </td>

  <td class="write" :key="generateKey(relay, 'check.write')">
    <span :class="getResultClass(relay, 'write')"></span>
  </td>

  <td class="info">
    <ul v-if="result.observations && result.observations.length">
      <li class="observation" v-for="(alert) in result.observations" :key="generateKey(relay, alert.description)">
        <span v-tooltip:top.tooltip="alert.description" :class="alert.type" v-if="alert.type == 'notice'">✉️</span>
        <span v-tooltip:top.tooltip="alert.description" :class="alert.type" v-if="alert.type == 'caution'">⚠️</span>
      </li>
    </ul>
  </td>

  <td class="nip nip-15">
    {{ setCheck(connection.nip(15)) }}
  </td>

  <td class="nip nip-20">
    {{ setCheck(connection.nip(20)) }}
  </td>
</template>

<script>
/* eslint-disable */
import { defineComponent} from 'vue'
// import InspectorRelayResult from 'nostr-relay-inspector'

export default defineComponent({
  name: 'RelaySingleComponent',
  components: {},
  props: {
    relay: String,
    result: {
      type: Object,
      default(rawProps){
        return {}
      }
    },
    showColumns: {
      type: Object,
      default(rawProps) {
        return {
          connectionStatuses: false,
          nips: false,
          geo: false,
          additionalInfo: false
        }
      }
    },
    connection: {
      type: Object,
      default(rawProps) {
        return {
          connectionStatuses: false,
          nips: false,
          geo: false,
          additionalInfo: false
        }
      }
    }
  },
  data() {
    return {}
  },
  methods: {
     getResultClass (url, key) {

       let result = this.result?.check?.[key] === true
       ? 'success'
       : this.result?.check?.[key] === false
         ? 'failure'
         : 'pending'
       return `indicator ${result}`
     },
     getLoadingClass (url) {
       return this.result?.state == 'complete' ? "relay loaded" : "relay"
     },
     generateKey (url, key) {
       return `${url}_${key}`
     },
     setFlag (url) {
       this.result.flag = this.result.geo?.countryCode ? countryCodeEmoji(this.result.geo.countryCode) : emoji.get('shrug');
     },

     setCheck (bool) {
       return bool ? '✅ ' : ''
     },

     setCross (bool) {
       return !bool ? '❌' : ''
     },
     setCaution (bool) {
       return !bool ? '⚠️' : ''
     },
     nip05List () {
       // console.log(this.result)
       let string = ''

       if(this.result.nips[5]) {
         string = `${string}Relay domain contains NIP-05 verification data for:`
         let users = Object.entries(this.result.nips[5]),
             count = 0
         users.forEach( ([key, value]) => {
           count++
           string = `${string} @${key} ${(count!=users.length) ? 'and' : ''}`
         })
       }
       return string
     },
   }
})
</script>
