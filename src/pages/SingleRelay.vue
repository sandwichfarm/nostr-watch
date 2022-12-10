<template>
  <!-- <NavComponent /> -->
  <div id="wrapper" :class="loadingComplete()">

    <row container :gutter="12">
      <column :xs="12" :md="12" :lg="12" class="title-card">
        <h1>nostr.watch<sup>{{version}}</sup></h1>
        <h2>{{relayUrl()}}</h2>
      </column>
    </row>

    <row container :gutter="12">
      <column :xs="12" :md="12" :lg="12">
        <LeafletSingleComponent
          :geo="geo"
          :relay="relay"
          :result="result"
        />
      </column>
    </row>

    <row container :gutter="12">
      <column :xs="12" :md="12" :lg="12">
        <div class="block">
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
      </column>
    </row>

    <!-- <row container :gutter="12">
      <column :xs="12" :md="12" :lg="12" class="processing-card loading">
        <span v-if="(relaysTotal()-relaysConnected()>0)">Processing {{ relaysConnected() }}/{{ relaysTotal() }}</span>
      </column>
    </row> -->

    <span class="credit"><a href="http://sandwich.farm">Another 🥪 by sandwich.farm</a>, built with <a href="https://github.com/jb55/nostr-js">nostr-js</a> and <a href="https://github.com/dskvr/nostr-relay-inspector">nostr-relay-inspector</a>, inspired by <a href="https://github.com/fiatjaf/nostr-relay-registry">nostr-relay-registry</a></span>

  </div>
</template>

<script>
import { defineComponent} from 'vue'
import LeafletSingleComponent from '../components/LeafletSingleComponent.vue'
// import NavComponent from './NavComponent.vue'\

import { countryCodeEmoji } from 'country-code-emoji';
import emoji from 'node-emoji';

import { Row, Column } from 'vue-grid-responsive';

import { version } from '../../package.json'

import { relays } from '../../relays.yaml'
import { geo } from '../../geo.yaml'
import { messages as RELAY_MESSAGES, codes as RELAY_CODES } from '../../codes.yaml'

import { Inspector, InspectorObservation } from 'nostr-relay-inspector'
// import { Inspector, InspectorObservation } from '../../lib/nostr-relay-inspector'

import crypto from "crypto"

export default defineComponent({
  title: "nostr.watch registry & network status",
  name: 'SingleRelay',
  components: {
    Row,
    Column,
    LeafletSingleComponent
    // NavComponent
  },

  data() {
    return {
      relays,
      result: {},
      messages: {},
      connections: {},
      nips: {},
      alerts: {},
      timeouts: {},
      lastPing: Date.now(),
      nextPing: Date.now() + (60*1000),
      count: 0,
      geo,
      relay: "",
      version: version
    }
  },

  async mounted() {
    console.log('mounted')
    this.relay = this.relayUrl()
    this.check(this.relay)
  },

  computed: {

  },

  methods: {
    relayUrl() {
      // We will see what `params` is shortly
      return `wss://${this.$route.params.relayUrl}`
    },
    check(relay){

      const opts = {
          checkLatency: true,
          setIP: false,
          setGeo: false,
        }

      let inspect = new Inspector(relay, opts)
        .on('run', (result) => {
          result.aggregate = 'processing'
        })
        .on('open', (e, result) => {
          this.result = result
        })
        .on('complete', (instance) => {
          console.log('on_complete', instance.result.aggregate)
          this.result = instance.result
          this.messages[relay] = instance.inbox
          // this.setFlag(relay)
          this.setAggregateResult(relay)
          // this.adjustResult(relay)
        })
        .on('notice', (notice) => {
          const hash = this.sha1(notice)
          let   message_obj = RELAY_MESSAGES[hash]
          let   code_obj = RELAY_CODES[message_obj.code]

          let response_obj = {...message_obj, ...code_obj}

          this.result.observations.push( new InspectorObservation('notice', response_obj.code, response_obj.description, response_obj.relates_to) )

          console.log(this.result.observations)
        })
        .on('close', () => {})
        .on('error', () => {

        })
        .run()

      this.connections[relay] = inspect
    },
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

    // adjustResult (relay) {
    //   this.result.observations.forEach( observation => {
    //     if (observation.code == "BLOCKS_WRITE_STATUS_CHECK") {
    //       this.result.check.write = false
    //       this.result.aggregate = 'public'
    //     }
    //   })
    // },

    setAggregateResult (relay) {
      let aggregateTally = 0
      aggregateTally += this.result?.[relay]?.check.connect ? 1 : 0
      aggregateTally += this.result?.[relay]?.check.read ? 1 : 0
      aggregateTally += this.result?.[relay]?.check.write ? 1 : 0
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

    relaysTotal () {
      return this.relays.length-1 //TODO: Figure out WHY?
    },

    relaysConnected () {
      return Object.entries(this.result).length
    },

    sha1 (message) {
      const hash = crypto.createHash('sha1').update(JSON.stringify(message)).digest('hex')
      // //console.log(message, ':', hash)
      return hash
    },

    isDone(){
      return this.relaysTotal()-this.relaysConnected() == 0
    },

    loadingComplete(){
      return this.isDone() ? 'loaded' : ''
    },
  },

})
</script>
