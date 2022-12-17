<template>
  <LeafletSingleComponent
    :geo="geo"
    :relay="relay"
    :result="result"
  />
  <!-- <NavComponent /> -->
  <div id="wrapper">

    <row container :gutter="12">
      <column :xs="12" :md="12" :lg="12" class="title-card">
        <h1>{{ relayUrl() }}</h1>
      </column>
    </row>

    <row container :gutter="12">
      <column :xs="12" :md="12" :lg="12" class="title-card">
        <NavComponent />
      </column>
    </row>


    <row container :gutter="12">
      <column :xs="12" :md="12" :lg="12" class="title-card">
        <div style="display: none">{{result}}</div> <!-- ? -->
        <br >

        <span  class="badges">
          <span><img :src="badgeCheck('connect')" /></span>
          <span><img :src="badgeCheck('read')" /></span>
          <span><img :src="badgeCheck('write')" /></span>
        </span>

        <br />

        <span v-if="result.info?.supported_nips" class="badges">
          <span v-for="(nip) in result.info.supported_nips" :key="`${relay}_${nip}`">
              <a :href="nipLink(nip)" target="_blank"><img :src="badgeLink(nip)" /></a>
          </span>
        </span>

        <!--table>
          <tr>
            <th colspan="3"><h4>Status</h4></th>
          </tr>
          <tr v-if="result.checkClass">
            <td :class="result.checkClass.connect" class="connect indicator">Connected</td>
            <td :class="result.checkClass.read" class="read indicator">Read</td>
            <td :class="result.checkClass.write" class="write indicator">Write</td>
          </tr>
        </table-->


        <table v-if="result.info">
          <tr>
            <th colspan="2"><h4>Info</h4></th>
          </tr>
          <tr v-for="(value, key) in Object.entries(result.info).filter(value => value[0] != 'id' && value[0] != 'supported_nips')" :key="`${value}_${key}`">
              <td>{{ value[0] }}</td>
              <td v-if="value[0]!='contact' && value[0]!='pubkey' && value[0]!='software' && value[0]!='version'">{{ value[1] }} </td>
              <td v-if="value[0]=='contact'"><SafeMail :email="value[1]" /></td>
              <td v-if="value[0]=='pubkey' || value[0]=='version'"><code>{{ value[1] }}</code></td>
              <td v-if="value[0]=='software'"><a href="{{ value[1] }}">{{ value[1] }}</a></td>
          </tr>
        </table>

        <h4>Identities</h4>
        <table v-if="result.identities">

          <tr v-for="(value, key) in Object.entries(result?.identities)" :key="`${value}_${key}`">

            <td>{{ value[0] }}</td>
            <td><code>{{ value[1] }}</code></td>
          </tr>
        </table>

        <div style="display: none">{{result}}</div> <!-- ? -->
      </column>
    </row>

    <row container :gutter="12">
      <column :xs="12" :md="6" :lg="6" class="title-card">

        <h4>GEO {{geo?.countryCode ? getFlag() : ''}}</h4>
        <table v-if="geo[relay]">
          <tr v-for="(value, key) in Object.entries(geo[relay])" :key="`${value}_${key}`">
            <td>{{ value[0] }}</td>
            <td>{{ value[1] }} </td>
          </tr>
        </table>

      </column>
      <column :xs="12" :md="6" :lg="6" class="title-card">
        <h4>DNS</h4>
        <table v-if="geo[relay]">
          <tr v-for="(value, key) in Object.entries(geo[relay].dns)" :key="`${value}_${key}`">
            <td>{{ value[0] }}</td>
            <td>{{ value[1] }} </td>
          </tr>
        </table>

        <div style="display: none">{{result}}</div> <!-- ? -->

      </column>
    </row>

    <span class="credit"><a href="http://sandwich.farm">Another 🥪 by sandwich.farm</a>, built with <a href="https://github.com/jb55/nostr-js">nostr-js</a> and <a href="https://github.com/dskvr/nostr-relay-inspector">nostr-relay-inspector</a>, inspired by <a href="https://github.com/fiatjaf/nostr-relay-registry">nostr-relay-registry</a></span>

  </div>
</template>

<script>

import { defineComponent} from 'vue'
import { useStorage } from "vue3-storage";

import LeafletSingleComponent from '../components/LeafletSingleComponent.vue'
import NavComponent from '../components/NavComponent.vue'

import { Row, Column } from 'vue-grid-responsive';
import SafeMail from "@2alheure/vue-safe-mail";
import emoji from 'node-emoji';
import { countryCodeEmoji } from 'country-code-emoji';

// import { Inspector, InspectorObservation } from 'nostr-relay-inspector'
// import { Inspector, InspectorObservation } from '../../lib/nostr-relay-inspector' 
import { Inspector, InspectorObservation } from '../../lib/nostr-relay-inspector' 

import { version } from '../../package.json'
import { relays } from '../../relays.yaml'
import { geo } from '../../geo.yaml'
import { messages as RELAY_MESSAGES, codes as RELAY_CODES } from '../../codes.yaml'




import crypto from "crypto"

export default defineComponent({
  title: "nostr.watch registry & network status",
  name: 'SingleRelay',
  components: {
    Row,
    Column,
    LeafletSingleComponent,
    NavComponent,
    SafeMail,
  },

  data() {
    return {
      relays,
      result: {},
      messages: {},
      nips: {},
      alerts: {},
      timeouts: {},
      intervals: {},
      lastPing: Date.now(),
      nextPing: Date.now() + (60*1000),
      count: 0,
      geo,
      relay: "",
      version: version,
      storage: null,
      lastUpdate: null,
      cacheExpiration: 10*60*1000 //10 minutes
    }
  },

  async mounted() {
    this.relay = this.relayUrl()

    this.storage = useStorage()
    this.lastUpdate = this.storage.getStorageSync('lastUpdate')
    this.result = this.storage.getStorageSync(this.relay)
    
    if(this.isExpired())
      this.check(this.relay)

    // console.log('zing ', (Date.now() - this.lastUpdate) /1000)
  },

  computed: {

  },

  updated() {
     Object.keys(this.timeouts).forEach(timeout => clearTimeout(this.timeouts[timeout]))
     Object.keys(this.intervals).forEach(interval => clearInterval(this.intervals[interval]))
  },

  methods: {
    isExpired(){
      return typeof this.lastUpdate === 'undefined' || Date.now() - this.lastUpdate > this.cacheExpiration
    },

    saveState(relay){
      this.storage
        .setStorage({
          key: relay,
          data: this.result
        })
        .then(successCallback => {
          console.log(successCallback.errMsg);
        })
        .catch(failCallback => {  
          console.log(failCallback.errMsg);
        })

      this.storage
        .setStorage({
          key: "lastUpdate",
          data: Date.now()
        })
        .then(successCallback => {
          console.log(successCallback.errMsg);
          this.lastUpdate = Date.now()
        })
        .catch(failCallback => {
          console.log(failCallback.errMsg);
        })
    },
    relayUrl() {
      // We will see what `params` is shortly
      return `wss://${this.$route.params.relayUrl}`
    },
    async check(relay){
      //const self = this
      /* return new Promise(function(resolve, reject) { */
        /* let nip = new Array(99).fill(false);
        nip[5] = true
        nip[11] = true */

      const opts = {
          checkLatency: true,
          checkNips: true,
          /* checkNip: nip, */
          /* debug: true */
        }

      let inspect = new Inspector(relay, opts)
        .on('run', (result) => {
          result.aggregate = 'processing'
        })
        .on('open', (e, result) => {
          this.result = result
          this.result.checkClass = {read: null, write: null, connect: null}
          this.setResultClass('connect')
          /* console.log('result on open', this.result) */
        })
        .on('complete', (instance) => {
          /* console.log('on_complete', instance.result.aggregate) */
          this.result = instance.result
          this.messages[this.relay] = instance.inbox

          /* this.setFlag(relay) */
          this.setAggregateResult()
          /* this.adjustResult(relay) */
          this.setResultClass('read')
          this.setResultClass('write')
          this.saveState(relay)
          /* console.log(this.result)
          console.log(this.result.info.supported_nips) */
          /* resolve(this.result) */
        })
        .on('notice', (notice) => {
          const hash = this.sha1(notice)
          let   message_obj = RELAY_MESSAGES[hash]
          let   code_obj = RELAY_CODES[message_obj.code]

          let response_obj = {...message_obj, ...code_obj}

          this.result.observations.push( new InspectorObservation('notice', response_obj.code, response_obj.description, response_obj.relates_to) )

          /* console.log(this.result.observations) */
        })
        .on('close', (msg) => {
          console.warn("CAUTION", msg)
          /* console.log('supported_nips', inspect.result.info) */
          })
        .on('error', (err) => {
          console.error("ERROR", err)
          /* reject(err) */
        })
        .run()

      return inspect;
      /* }) */

    },
    setResultClass (key) {
      let result = this.result?.check?.[key] === true
      ? 'success'
      : this.result?.check?.[key] === false
        ? 'failure'
        : 'pending'

      /* console.log('result class', result) */
      this.result.checkClass[key] = result
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

    badgeLink(nip){
      return `https://img.shields.io/static/v1?style=for-the-badge&label=NIP&message=${this.nipSignature(nip)}&color=black`
    },

    badgeCheck(which){
      return `https://img.shields.io/static/v1?style=for-the-badge&label=&message=${which}&color=${this.result?.check?.[which] ? 'green' : 'red'}`
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

       // console.log(this.result.uri, 'admin', this.result.identities.serverAdmin)

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
      // console.log('copy', text)
      try {
        await navigator.clipboard.writeText(text);
      } catch($e) {
        //console.log('Cannot copy');
      }
    },

    // adjustResult (relay) {
    //   this.result.observations.forEach( observation => {
    //     if (observation.code == "BLOCKS_WRITE_STATUS_CHECK") {
    //       this.result.check.write = false
    //       this.result.aggregate = 'public'
    //     }
    //   })
    // },

    setAggregateResult () {
      if(!this.result) return

      let aggregateTally = 0
      aggregateTally += this.result?.check.connect ? 1 : 0
      aggregateTally += this.result?.check.read ? 1 : 0
      aggregateTally += this.result?.check.write ? 1 : 0
      if (aggregateTally == 3) {
        this.result.aggregate = 'public'
      }
      else if (aggregateTally == 0) {
        this.result.aggregate = 'offline'
      }
      else {
        this.result.aggregate = 'restricted'
      }
    },



    sha1 (message) {
      const hash = crypto.createHash('sha1').update(JSON.stringify(message)).digest('hex')
      // //console.log(message, ':', hash)
      return hash
    },

  },

})
</script>
<style scoped>
ul, ul li { padding:0; margin:0; list-style:none; }
td { padding:5px 10px; }
th h4 { text-align:center; padding:5px 10px; margin:0 0 6px; background:#f0f0f0; }
table {width:90%; max-width:90%; margin:0 auto 20px ; border: 2px solid #f5f5f5; padding:20px}
tr td:first-child { text-align:right }
tr td:last-child { text-align:left }
.indicator { display: table-cell; width:33% ; font-weight:bold; text-align: center !important; color: white; text-transform: uppercase; font-size:0.8em}
body, .grid-column { padding:0; margin:0; }
.badges { display:block; margin: 10px 0 0}
.badges > span {margin-right:5px}
#wrapper {max-width:800px}
h1 {margin: 25px 0 15px; padding:0 0 10px; border-bottom:3px solid #e9e9e9}
</style>
