<template>
  <td :key="generateKey(relay, 'aggregate')"><span :class="getAggregateResultClass(relay)"></span></td>
  <td class="left-align relay-url" @click="copy(relay)">{{ relay }}</td>
  <td>
    <span v-tooltip:top.tooltip="nip05List(relay)"> <span class="verified-shape-wrapper" v-if="result.nips[5]"><span class="shape verified"></span></span></span>
  </td>
  <!-- <td>{{result.flag}}</td> -->
  <td><span>{{ result.latency.final }}<span v-if="result.check.latency">ms</span></span></td>
  <td :key="generateKey(relay, 'check.connect')"><span :class="getResultClass(relay, 'connect')"></span></td>
  <td :key="generateKey(relay, 'check.read')"><span :class="getResultClass(relay, 'read')"></span></td>
  <td :key="generateKey(relay, 'check.write')"><span :class="getResultClass(relay, 'write')"></span></td>
  <td>
    <ul v-if="result.observations && result.observations.length">
      <li class="observation" v-for="(alert) in result.observations" :key="generateKey(relay, alert.description)">
        <span v-tooltip:top.tooltip="alert.description" :class="alert.type" v-if="alert.type == 'notice'">✉️</span>
        <span v-tooltip:top.tooltip="alert.description" :class="alert.type" v-if="alert.type == 'caution'">⚠️</span>
      </li>
    </ul>
  </td>
  <td>{{ setCheck(connection.nip(15)) }}</td>
  <td>{{ setCheck(connection.nip(20)) }}</td>
</template>

<script>
/* eslint-disable */
import { defineComponent} from 'vue'
import InspectorRelayResult from 'nostr-relay-inspector'

export default defineComponent({
  name: 'RelaySingleComponent',
  components: {},
  props: {
    relay: String,
    result: {
      type: Object,
      default(rawProps){
        return InspectorRelayResult
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
     getAggregateResultClass (url) {
       let result = ''
       if (this.result?.aggregate == null) {
         result = 'unprocessed'
       }
       else if (this.result?.aggregate == 'public') {
         result = 'readwrite'
       }
       else if (this.result?.aggregate == 'restricted') {
         if(this.result?.check.write) {
           result = 'write-only'
         } else {
           result = 'read-only'
         }
       }
       else if (this.result?.aggregate == 'offline') {
         result = 'offline'
       }
       return `aggregate indicator ${result}`
     },
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
     nip05List (url) {
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
