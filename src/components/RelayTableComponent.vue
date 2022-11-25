<template>
  <div id="wrapper" :class="loadingComplete()">
    <!-- <div class="text-h5 text-bold q-py-md q-px-sm full-width flex row justify-start">
       |
      <span></span> -->

    <!-- </div> -->
    <row container :gutter="12">
      <column :xs="12" :md="12" :lg="12" class="title-card">
        <h1>nostr.watch<sup>alpha</sup></h1>
        <!-- <span>Next ping in {{ nextPing }} seconds</span> -->
      </column>
    </row>

    <row container :gutter="12">
      <column :xs="12" :md="12" :lg="12">
        <div class="block">
          <table>
            <RelayListComponent
              section="public"
              :relays="relays"
              :result="result"
              :messages="messages"
              :alerts="alerts"
              :connections="connections"
            />

            <RelayListComponent
              section="restricted"
              :relays="relays"
              :result="result"
              :messages="messages"
              :alerts="alerts"
              :connections="connections"
            />

            <RelayListComponent
              section="offline"
              :relays="relays"
              :result="result"
              :messages="messages"
              :alerts="alerts"
              :connections="connections"
            />

          </table>
        </div>
      </column>
    </row>

    <row container :gutter="12">
      <column :xs="12" :md="12" :lg="12" class="processing-card loading">
        <span v-if="(relaysTotal()-relaysConnected()>0)">Processing {{ relaysCompleted() }}/{{ relaysTotal() }}</span>
      </column>
    </row>

    <span class="credit"><a href="http://sandwich.farm">Another 🥪 by sandwich.farm</a>, built with <a href="https://github.com/jb55/nostr-js">nostr-js</a> and <a href="https://github.com/dskvr/nostr-relay-inspector">nostr-relay-inspector</a>, inspired by <a href="https://github.com/fiatjaf/nostr-relay-registry">nostr-relay-registry</a></span>

  </div>
</template>

<script>
/* eslint-disable */
import { defineComponent} from 'vue'
import TooltipComponent from './TooltipComponent.vue'
import RelayListComponent from './RelayListComponent.vue'

// import nip04 from 'nostr-tools/nip04'
// import nip05 from '../../node_modules/nostr-tools/nip05'
// import nip06 from 'nostr-tools/nip06'

// import { relayConnect } from 'nostr-tools/relay'
import {  Relay } from 'nostr'

import { Row, Column } from 'vue-grid-responsive';
import Popper from "vue3-popper";
import onionRegex from 'onion-regex';
import countryCodeEmoji from 'country-code-emoji'
import emoji from 'node-emoji'


import { relays } from '../../relays.yaml'
import { messages as RELAY_MESSAGES, codes as RELAY_CODES } from '../../codes.yaml'

import { Inspector, Observation } from 'nostr-relay-inspector'
// import { Inspector, Observation } from '../../lib/nostr-relay-inspector'

import crypto from "crypto"

const refreshMillis = 3*60*1000

export default defineComponent({
  title: "nostr.watch registry & netw ork status",
  name: 'RelayTableComponent',
  components: {
    Row,
    Column,
    TooltipComponent,
    RelayListComponent
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
    }
  },

  async mounted() {
    this.relays.forEach(async relay => {
      this.check(relay)
    })
  },

  computed: {},

  methods: {

    check(relay){

      let inspect = new Inspector(relay, {
          checkLatency: true,
          run: true,
          setIP: false,
          setGeo: false,
          checkNip05: true
        })
        .on('open', (e, result) => {
          this.result[relay] = result
        })
        .on('complete', (instance) => {
          this.result[relay] = instance.result
          this.messages[relay] = instance.inbox
          this.setFlag(relay)
          this.setAggregateResult(relay)
          this.adjustResult(relay)
        })
        .on('notice', (notice) => {
          const hash = this.sha1(notice)
          let   message_obj = RELAY_MESSAGES[hash]
          let   code_obj = RELAY_CODES[message_obj.code]

          let response_obj = {...message_obj, ...code_obj}

          this.result[relay].observations.push( new Observation('notice', response_obj.code, response_obj.description, response_obj.relates_to) )

          console.log(this.result[relay].observations)
        })
        .on('close', () => {})

      this.connections[relay] = inspect
    },

    checkLatency(relay) {
      this.connections[relay].opts.checkLatency = true
      this.connections[relay].checkLatency()
    },

    // query (group, filterType) {
    query (group) {
      let unordered,
          filterFn

      filterFn = (relay) => this.result?.[relay]?.aggregate == group

      unordered = this.relays.filter(filterFn);

      if (unordered.length) {
        return unordered.sort((relay1, relay2) => {
          return this.result?.[relay1]?.latency.final - this.result?.[relay2]?.latency.final
        })
      }

      return []
    },

    adjustResult (relay) {
      this.result[relay].observations.forEach( observation => {
        if (observation.code == "BLOCKS_WRITE_STATUS_CHECK") {
          this.result[relay].check.write = false
          this.result[relay].aggregate = 'public'
        }
      })
    },

    getResultClass (url, key) {

      let result = this.result?.[url]?.check?.[key] === true
      ? 'success'
      : this.result?.[url]?.check?.[key] === false
        ? 'failure'
        : 'pending'
      return `indicator ${result}`
    },

    getLoadingClass (url) {
      return this.result?.[url]?.state == 'complete' ? "relay loaded" : "relay"
    },

    // setNip05(url){
    //   const data = nip05(url.replace('wss://', ''))
    //   if(data.length) {
    //     this.nips[url][5] = data
    //     this.result[url].nip05 = true
    //   }
    // },

    setAggregateResult (url) {
      let aggregateTally = 0
      aggregateTally += this.result?.[url]?.check.connect ? 1 : 0
      aggregateTally += this.result?.[url]?.check.read ? 1 : 0
      aggregateTally += this.result?.[url]?.check.write ? 1 : 0
      if (aggregateTally == 3) {
        this.result[url].aggregate = 'public'
      }
      else if (aggregateTally == 0) {
        this.result[url].aggregate = 'offline'
      }
      else {
        this.result[url].aggregate = 'restricted'
      }
    },

    async copy(text) {
      try {
        await navigator.clipboard.writeText(text);
      } catch($e) {
        //console.log('Cannot copy');
      }
    },

    generateKey (url, key) {
      return `${url}_${key}`
    },

    getID(url, keyword) {
      return `${keyword}_${url}`
    },

    isOnion(url){
      return onionRegex().test(url)
    },

    setLatency(url) {
      // //console.log(this.result[url].check.connect === true, this.result[url]. latency,this.latency[url].final)
      if (this.result[url].check.connect === true) this.result[url].latency = this.latency[url].final
      // //console.log(this.result[url].check.connect === true, this.result[url]. latency,this.latency[url].final)
      //console.log("latency",this.latency[url])
    },




    setFlag (url) {
      this.result[url].flag = this.result[url].geo?.countryCode ? countryCodeEmoji(this.result[url].geo.countryCode) : emoji.get('shrug');
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

    relaysTotal () {
      return this.relays.length
    },

    relaysConnected () {
      return Object.keys(this.result).length
    },

    relaysCompleted () {
      let value = Object.entries(this.result).length
      console.log(value)
      return value
    },

    nip05List (url) {
      let string = ''
      if(this.result[url].nips[5]) {
        string = `${string}Relay domain contains NIP-05 verification data for:`
        let users = Object.entries(this.result[url].nips[5]),
            count = 0
        users.forEach( ([key, value]) => {
          count++
          string = `${string} @${key} ${(count!=users.length) ? 'and' : ''}`
        })
      }
      return string
    },

    // searchDomain(domain){
    //   return searchDomain(domain)
    // },


    sha1 (message) {
      const hash = crypto.createHash('sha1').update(JSON.stringify(message)).digest('hex')
      // //console.log(message, ':', hash)
      return hash
    },

    loadingComplete(){
      return this.relaysTotal()-this.relaysCompleted() == 0 ? 'loaded' : ''
    }
  },

})
</script>

<style lang='css' scoped>


</style>
