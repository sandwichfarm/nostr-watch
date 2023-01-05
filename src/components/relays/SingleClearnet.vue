<template>

  <td class="status-indicator" :key="generateKey(relay, 'aggregate')">
    <span :class="result?.aggregate" class="aggregate indicator">
        <span></span>
        <span></span>
    </span>
  </td>

  <td class="relay left-align relay-url">
    <router-link :to="`/relay/${relayClean(relay)}`" active-class="active">{{ relay }}</router-link>
  </td>

  <td class="verified text-center">
    <span v-if="result?.identities">
      <span v-tooltip:top.tooltip="identityList"> <span class="verified-shape-wrapper" v-if="Object.entries(result?.identities).length"><span class="shape verified"></span></span></span>
    </span>
  </td>

  <td class="location text-center">{{ getFlag(relay) }}</td>

  <td class="latency text-center">
    <span>{{ result?.latency?.final }}<span v-if="result?.check?.latency">ms</span></span>
  </td>

  <td class="connect text-center" :key="generateKey(relay, 'check.connect')">
    <span :class="getIndicatorClass(relay, 'connect')"></span>
  </td>

  <td class="read text-center" :key="generateKey(relay, 'check.read')">
    <span :class="getIndicatorClass(relay, 'read')"></span>
  </td>

  <td class="write text-center" :key="generateKey(relay, 'check.write')">
    <span :class="getIndicatorClass(relay, 'write')"></span>
  </td>

  <td class="fav text-center" :key="generateKey(relay, 'check.write')">
    <a
      class=" hover:opacity-100 cursor-pointer" 
      :class="store.relays.isFavorite(relay) ? 'opacity-100' : 'opacity-10'"
      @click="store.relays.toggleFavorite(relay)">
      ❤️
    </a>
  </td>

  <!-- <td class="info">
    <ul v-if="result?.observations && result?.observations.length">
      <li class="observation" v-for="(alert) in result?.observations" :key="generateKey(relay, alert.description)">
        <span v-tooltip:top.tooltip="alert.description" :class="alert.type" v-if="alert.type == 'notice'">✉️</span>
        <span v-tooltip:top.tooltip="alert.description" :class="alert.type" v-if="alert.type == 'caution'">⚠️</span>
      </li>
    </ul>
  </td>-->
</template>

<script>
import { defineComponent, toRefs } from 'vue'
// import { InspectorResult } from 'nostr-relay-inspector'
import { countryCodeEmoji } from 'country-code-emoji';
import emoji from 'node-emoji';
import { setupStore } from '@/store'
import crypto from 'crypto'

export default defineComponent({
  name: 'RelaySingleComponent',
  components: {
  },
  props: {
    relay:{
      type: String,
      default(){
        return ""
      }
    },
    selectedRelays:{
      type: Array,
      default(){
        return []
      }
    },
    resultProp:{
      type: Object,
      default(){
        return {}
      }
    },
  },
  data() {
    return {
      geo: {},
      showModal: false
    }
  },
  mounted(){
    this.geo = this.store.relays.getGeo(this.relay)

  },
  setup(props){
    const {resultProp: result} = toRefs(props)
    return { 
      store : setupStore(),
      result: result
    }
  },
  computed: {
    relayGeo(){
      return (relay) => this.store.relays.getGeo(relay)
    },
    getIndicatorClass(){
      return (url, key) => {
        let cl = this.result?.check?.[key] === true
            ? 'success'
            : this.result?.check?.[key] === false
              ? 'failure'
              : 'pending'
        return `indicator ${cl}`
      }  
    },
    generateKey(){
       return (url, key) => crypto.createHash('md5').update(`${url}_${key}`).digest('hex')
    },
    getFlag () {
      return (relay) => this.relayGeo(relay)?.countryCode ? countryCodeEmoji(this.relayGeo(relay)?.countryCode) : emoji.get('shrug');
    },
    identityList () {
       let string = '',
           extraString = '',
           users = Object.entries(this.result?.identities),
           count = 0

       if(this.result?.identities) {
         if(this.result?.identities.serverAdmin) {
           string = `Relay has registered an administrator pubkey: ${this.result?.identities.serverAdmin}. `
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
     relayClean() {
       return (relay) => relay.replace('wss://', '')
     },
  },
  methods: {
    //  setCheck (bool) {
    //    return bool ? '✅ ' : ''
    //  },
    //  setCross (bool) {
    //    return !bool ? '❌' : ''
    //  },
    //  setCaution (bool) {
    //    return !bool ? '⚠️' : ''
    //  },     
    //  nipSignature(key){
    //    return key.toString().length == 1 ? `0${key}` : key
    //  },
    //  nipFormatted(key){
    //    return `NIP-${this.nipSignature(key)}`
    //  },
    //  nipLink(key){
    //    return `https://github.com/nostr-protocol/nips/blob/master/${this.nipSignature(key)}.md`
    //  },
     async copy(text) {
       try {
         await navigator.clipboard.writeText(text);
       } catch(err) {
        console.error(err)
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
  flex-direction: Column;
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

.restricted.aggregate.indicator {
  position:relative;
}

 td {
    padding-top:2px;
    padding-bottom:2px;
  }

</style>
