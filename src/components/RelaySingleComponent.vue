<template>
  <td class="status-indicator" :key="generateKey(relay, 'aggregate')">
    <span :class="result.aggregate" class="aggregate indicator">
        <span></span>
        <span></span>
    </span>
  </td>

  <td class="relay left-align relay-url">
    <span @click="copy(relay)" v-tooltip:top.tooltip="'Click to copy'">{{ relay }}</span>
  </td>

  <td class="verified">
    <span v-tooltip:top.tooltip="identityList()"> <span class="verified-shape-wrapper" v-if="Object.entries(result.identities).length"><span class="shape verified"></span></span></span>
  </td>

  <td class="location">{{ getFlag() }}</td>

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

  <td class="nip nip-11">
    <a v-if="result.info" @click="showModal=true">✅ </a>
  </td>

  <vue-final-modal v-model="showModal" classes="modal-container" content-class="modal-content">
    <div class="modal__title">
      <span>{{ result.info?.name }}</span>
    </div>
    <div class="modal__content">
        <div v-if="result.info?.description">
          {{ result.info?.description }} <br/>
          <strong v-if="result.info?.pubkey">Public Key:</strong> {{ result.info?.pubkey }} <br/>
          <strong v-if="result.info?.contact">Contact:</strong> <SafeMail :email="result.info?.contact" v-if="result.info?.contact" />
        </div>
        <div>
          <h4>Status</h4>
          <ul>
            <li><strong>Connected</strong> <span :class="getResultClass(relay, 'connect')" class="connect indicator"></span></li>
            <li><strong>Read</strong> <span :class="getResultClass(relay, 'read')" class="read indicator"></span></li>
            <li><strong>Write</strong> <span :class="getResultClass(relay, 'write')" class="write indicator"></span></li>
          </ul>
        </div>
        <h4>Relay Info</h4>
        <ul>
          <li><strong>Software:</strong> {{ result.info?.software }} </li>
          <li><strong>Version</strong>: {{ result.info?.version }} </li>
        </ul>
        <h4>NIP Support</h4>
        <ul>
          <li v-for="(nip) in result.info?.supported_nips" :key="`${relay}_${nip}`">
              <a :href="nipLink(nip)" target="_blank">{{ nipFormatted(nip) }}</a>
          </li>
        </ul>
    </div>
  </vue-final-modal>
</template>

<script>
import { defineComponent} from 'vue'
import { VueFinalModal } from 'vue-final-modal'
import InspectorRelayResult from 'nostr-relay-inspector'
import SafeMail from "@2alheure/vue-safe-mail";
import { countryCodeEmoji } from 'country-code-emoji';
import emoji from 'node-emoji';

export default defineComponent({
  name: 'RelaySingleComponent',
  components: {
    VueFinalModal,
    SafeMail
  },
  props: {
    relay: String,
    result: {
      type: Object,
      default(){
        return structuredClone(InspectorRelayResult)
      }
    },
    geo: {
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
    connection: {
      type: Object,
      default() {
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
    return {
      showModal: false
    }
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
     getLoadingClass () {
       return this.result?.state == 'complete' ? "relay loaded" : "relay"
     },
     generateKey (url, key) {
       return `${url}_${key}`
     },

     getFlag () {
       return this.geo?.countryCode ? countryCodeEmoji(this.geo.countryCode) : emoji.get('shrug');
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
     identityList () {
       let string = '',
           extraString = '',
           users = Object.entries(this.result.identities),
           count = 0

        console.log(this.result.uri, 'admin', this.result.identities.serverAdmin)

       if(this.result.identities) {
         if(this.result.identities.serverAdmin) {
           string = `Relay has registered an administrator pubkey: ${this.result.identities.serverAdmin}. `
           extraString = "Additionally, "
         }

         const total = users.filter(([key]) => key!='serverAdmin').length,
               isOne = total==1

         if(total) {
           string = `${string}${extraString}Relay domain contains NIP-05 verification data for:`
           users.forEach( ([key]) => {
             if(key == "serverAdmin") return
             count++
             string = `${string} ${(count==total && !isOne) ? 'and' : ''}  @${key}${(count!=total && !isOne) ? ', ' : ''}`
           })
         }
       }
       return string
     },
     nipSignature(key){
       return key.toString().length == 1 ? `0${key}` : key
     },
     nipFormatted(key){
       return `NIP-${this.nipSignature(key)}`
     },
     nipLink(key){
       return `https://github.com/nostr-protocol/nips/blob/master/${this.nipSignature(key)}.md`
     },
     async copy(text) {
       console.log('copy', text)
       try {
         await navigator.clipboard.writeText(text);
       } catch($e) {
         //console.log('Cannot copy');
       }
     },
   }
})
</script>

<style scoped>
ul {
  margin:0;
  padding:0;
}

li {
  margin:0;
  padding:0;
  list-style:none;
}

td.nip-11,
td.verified span {
  cursor: pointer
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


.dark-mode div ::v-deep(.modal-content) {
  border-color: #2d3748;
  background-color: #1a202c;
}
</style>
