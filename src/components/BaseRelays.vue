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
            <tr><td colspan="11"><h2><span class="indicator badge readwrite">{{ query('public').length }}</span>Public</h2></td></tr>
            <tr class="online public"  v-if="query('public').length > 0">
              <th class="table-column status-indicator"></th>
              <th class="table-column relay"></th>
              <th class="table-column verified"><span class="verified-shape-wrapper"><span class="shape verified"></span></span></th>
              <!-- <th class="table-column location" v-tooltip:top.tooltip="Ping">
                🌎
              </th> -->
              <th class="table-column latency" v-tooltip:top.tooltip="'Relay Latency on Read'">
                ⌛️
              </th>
              <th class="table-column connect" v-tooltip:top.tooltip="'Relay connection status'">
                🔌
              </th>
              <th class="table-column read" v-tooltip:top.tooltip="'Relay read status'">
                👁️‍🗨️
              </th>
              <th class="table-column write" v-tooltip:top.tooltip="'Relay write status'">
                ✏️
              </th>
              <th class="table-column info" v-tooltip:top.tooltip="'Additional information detected regarding the relay during processing'">
                ℹ️
              </th>
              <th class="table-column nip nip-15" v-tooltip:top.tooltip="'Does the relay support NIP-15'">
                NIP-15
              </th>
              <th class="table-column nip nip-20" v-tooltip:top.tooltip="'Does the relay support NIP-20'">
                NIP-20
              </th>
              <!-- <th>FILTER: LIMIT</th> -->
            </tr>
            <tr v-for="relay in query('public')" :key="{relay}" :class="getLoadingClass(relay)" class="online public">
              <td :key="generateKey(relay, 'aggregate')"><span :class="getAggregateResultClass(relay)"></span></td>
              <td class="left-align relay-url" @click="copy(relay)">{{ relay }}</td>
              <td></td>
              <!-- <td>{{result[relay].flag}}</td> -->
              <td><span>{{ result[relay].latency.final }}<span v-if="result[relay].check.latency">ms</span></span></td>
              <td :key="generateKey(relay, 'check.connect')"><span :class="getResultClass(relay, 'connect')"></span></td>
              <td :key="generateKey(relay, 'check.read')"><span :class="getResultClass(relay, 'read')"></span></td>
              <td :key="generateKey(relay, 'check.write')"><span :class="getResultClass(relay, 'write')"></span></td>
              <td>
                <ul v-if="result[relay].observations && result[relay].observations.length">
                  <li class="observation" v-for="(alert) in result[relay].observations" :key="generateKey(relay, alert.description)">
                    <span v-tooltip:top.tooltip="alert.description" :class="alert.type" v-if="alert.type == 'notice'">✉️</span>
                    <span v-tooltip:top.tooltip="alert.description" :class="alert.type" v-if="alert.type == 'caution'">⚠️</span>
                  </li>
                </ul>
              </td>
              <td>{{ setCheck(connections[relay].nip(15)) }}</td>
              <td>{{ setCheck(connections[relay].nip(20)) }}</td>
              <!-- <td>{{ setCaution(result[relay].didSubscribeFilterLimit) }}</td> -->
            </tr>
          <!-- </table>
        </div> -->
      <!-- </column>

      <column :xs="12" :md="12" :lg="6"> -->
        <!-- <div class="block"> -->
            <tr><td colspan="11"><h2><span class="indicator badge write-only">{{ query('restricted').length }}</span>Restricted</h2></td></tr>
          <!-- <table class="online"> -->
            <tr class="online"  v-if="query('restricted').length > 0">
              <th class="table-column status-indicator"></th>
              <th class="table-column relay"></th>
              <th class="table-column verified"><span class="verified-shape-wrapper"><span class="shape verified"></span></span></th>
              <!-- <th class="table-column location" v-tooltip:top.tooltip="Ping">
                🌎
              </th> -->
              <th class="table-column latency" v-tooltip:top.tooltip="'Relay Latency on Read'">
                ⌛️
              </th>
              <th class="table-column connect" v-tooltip:top.tooltip="'Relay connection status'">
                🔌
              </th>
              <th class="table-column read" v-tooltip:top.tooltip="'Relay read status'">
                👁️‍🗨️
              </th>
              <th class="table-column write" v-tooltip:top.tooltip="'Relay write status'">
                ✏️
              </th>
              <th class="table-column info" v-tooltip:top.tooltip="'Additional information detected regarding the relay during processing'">
                ℹ️
              </th>
              <th class="table-column nip nip-15" v-tooltip:top.tooltip="'Does the relay support NIP-15'">
                NIP-15
              </th>
              <th class="table-column nip nip-20" v-tooltip:top.tooltip="'Does the relay support NIP-20'">
                NIP-20
              </th>
            </tr>
            <tr v-for="relay in query('restricted')" :key="{relay}" :class="getLoadingClass(relay)" class="online">
              <td :key="generateKey(relay, 'aggregate')"><span :class="getAggregateResultClass(relay)"><span></span><span></span></span></td>
              <td class="left-align relay-url" @click="copy(relay)">{{ relay }}</td>
              <td></td>
              <!-- <td>{{result[relay].flag}}</td> -->
              <td><span>{{ result[relay].latency.final }}<span v-if="result[relay].check.latency">ms</span></span></td>
              <td :key="generateKey(relay, 'check.connect')"><span :class="getResultClass(relay, 'connect')"></span></td>
              <td :key="generateKey(relay, 'check.read')"><span :class="getResultClass(relay, 'read')"></span></td>
              <td :key="generateKey(relay, 'check.write')"><span :class="getResultClass(relay, 'write')"></span></td>
              <td>
                <ul v-if="result[relay].observations && result[relay].observations.length">
                  <li class="observation" v-for="(alert) in result[relay].observations" :key="generateKey(relay, alert.description)">
                    <span v-tooltip:top.tooltip="alert.description" :class="alert.type" v-if="alert.type == 'notice'">✉️</span>
                    <span v-tooltip:top.tooltip="alert.description" :class="alert.type" v-if="alert.type == 'caution'">⚠️</span>
                  </li>
                </ul>
              </td>
              <td>{{ setCheck(connections[relay].nip(15)) }}</td>
              <td>{{ setCheck(connections[relay].nip(20)) }}</td>
            </tr>
          <!-- </table> -->
        <!-- </div> -->
        <!-- <div class="block"> -->
          <tr> <td colspan="11"><h2><span class="indicator badge offline">{{ query('offline').length }}</span>Offline</h2></td></tr>
          <!-- <table v-if="query('offline').length > 0"> -->
            <tr class="offline"  v-if="query('offline').length > 0">
              <th class="table-column status-indicator"></th>
              <th class="table-column relay"></th>
              <th class="table-column verified"></th>
              <!-- <th class="table-column location"></th> -->
              <th></th>
              <th class="table-column connect" v-tooltip:top.tooltip="'Relay connection status'">
                🔌
              </th>
              <th class="table-column read" v-tooltip:top.tooltip="'Relay read status'">
                👁️‍🗨️
              </th>
              <th class="table-column write" v-tooltip:top.tooltip="'Relay write status'">
                ✏️
              </th>
              <th class="table-column info" v-tooltip:top.tooltip="'Additional information detected regarding the relay during processing'">
                ℹ️
              </th>
              <th></th>
              <th></th>
            </tr>
            <tr v-for="relay in query('offline')" :key="{relay}" :class="getLoadingClass(relay)">
              <td :key="generateKey(relay, 'aggregate')"><span :class="getAggregateResultClass(relay)"></span></td>
              <td class="left-align relay-url">{{ relay }}</td>
              <!-- <td></td> -->
              <td></td>
              <td></td>
              <td :key="generateKey(relay, 'check.connect')"><span :class="getResultClass(relay, 'connect')"></span></td>
              <td :key="generateKey(relay, 'check.read')"><span :class="getResultClass(relay, 'read')"></span></td>
              <td :key="generateKey(relay, 'check.write')"><span :class="getResultClass(relay, 'write')"></span></td>
              <td>
                <ul v-if="messages[relay].notices.length">
                  <li v-tooltip:left.tooltip="message" v-for="(message) in messages[relay].notices" :key="generateKey(relay, message)">✉️</li>
                </ul>
              </td>
              <td></td>
              <td></td>
              <td></td>
              <td></td>
            </tr>
          </table>
        </div>
      </column>
    </row>

    <row container :gutter="12">
      <column :xs="12" :md="12" :lg="12" class="processing-card loading">
        <span v-if="(relaysTotal()-relaysConnected()>0)">Processing {{ relaysCompleted() }}/{{ relaysTotal() }}</span>
      </column>
    </row>



    <!-- <h2>Processing</h2>
    <table v-if="relays.filter((relay) => result[relay] && !result[relay].state=='complete').length > 0">
      <tr>
        <th></th>
      </tr>
      <tr v-for="relay in relays.filter((url) => !result[url].state=='complete')" :key="{relay}" :class="getLoadingClass(relay)">
        <td>{{ relay }}</td>
      </tr>
    </table>
    <a href="./relays/">JSON API</a> -->

    <span class="credit"><a href="http://sandwich.farm">Another 🥪 by sandwich.farm</a>, built with <a href="">nostr-js</a> and <a href="">nostr-relay-inspector</a>, inspired by <a href="">nostr-relay-registry</a></span>

  </div>
</template>

<script>
/* eslint-disable */
import { defineComponent} from 'vue'
import TooltipComponent from './TooltipComponent.vue'

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

import { Inspector, Observation } from '../../lib/nostr-relay-inspector'

import crypto from "crypto"

const refreshMillis = 3*60*1000

export default defineComponent({
  title: "nostr.watch registry & netw ork status",
  name: 'BaseRelays',
  components: {
    Row,
    Column,
    TooltipComponent
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
    // //console.log(this.relays.filter((relay) => this.result?.[relay] && !this.result?.[relay].state=='complete').length)
    this.relays.forEach(relay => { this.check(relay) })
    // setTimeout(() => {
    //   this.relays.forEach(relay => { this.checkLatency(relay) })
    // }, 10000)

  },

  computed: {},

  methods: {

    check(relay){
      let inspect = new Inspector(relay, {
          checkLatency: true,
          run: true,
          setIP: false,
          setGeo: false
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
        .on('close', () => {
          // delete this.connections[relay]
        })
      //
      // setTimeout( () => {
      //   inspect
      //     .reset()
      //   inspect
      //     .run()
      //   //console.log('reset and run')
      // }, 25000)
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

    getAggregateResultClass (url) {
      let result = ''
      if (this.result?.[url]?.aggregate == null) {
        result = 'unprocessed'
      }
      else if (this.result?.[url]?.aggregate == 'public') {
        result = 'readwrite'
      }
      else if (this.result?.[url]?.aggregate == 'restricted') {
        if(this.result?.[url]?.check.write) {
          result = 'write-only'
        } else {
          result = 'read-only'
        }
      }
      else if (this.result?.[url]?.aggregate == 'offline') {
        result = 'offline'
      }
      return `aggregate indicator ${result}`
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
.q-tabs {
  border-bottom: 1px solid var(--q-accent)
}

table {
  width:100%;
}

.left-align {
  text-align:left;
}

tr.relay td {
  font-style: italic;
  opacity: 0.5;
}

tr.relay.loaded td {
  font-style: normal;
  opacity: 1;
}

.indicator {
  display:block;
  margin: 0 auto;
  height: 14px;
  width: 14px;
  border-radius: 7px;
  border-width:0px;
}

.badge {
  height:auto;
  width: auto;
  display:inline-block;
  padding: 2px 5px;
  font-size: 15px;
  position: relative;
  top: -3px;
  min-width: 15px;
  margin-right:5px;
}

.badge.readwrite,
.badge.offline {
  color: white;
}

.badge.write-only,
.badge.read-only,
tr.online.public .indicator.failure {
  background-color:orange !important;
}

.aggregate.indicator {
    background-color: transparent;
    border-radius: 0px;
    border-style: solid;
}

.indicator.pernding {
  background-color: #c0c0c0;
  border-color: rgba(55,55,55,0.5);
}

.indicator.success {
  background-color: green;
  border-color: rgba(0,255,0,0.5);
}

.indicator.failure {
  background-color: red;
border-color: rgba(255,0,0,0.5);
}

.indicator.caution {
  background-color: orange;
  border-color: rgba(255, 191, 0,0.5);
}

.indicator.readwrite {
  background-color: green;
  border-color: rgba(0,255,0,0.5);
}

.indicator.read-only {
  position:relative;
  border-color: transparent;
  background-color: transparent
}

.indicator.read-only span:first-child {
  position:absolute;
  width: 0;
  height: 0;
  border-top: 14px solid green;
  border-right: 14px solid transparent;
}

.indicator.read-only span:last-child {
  position:absolute;
  width: 0;
  height: 0;
  border-bottom: 14px solid orange;
  border-left: 14px solid transparent;
}


.indicator.write-only {
  position:relative;
  border-color: transparent;
  background-color: transparent
}

.indicator.write-only span:first-child {
  position:absolute;
  width: 0;
  height: 0;
  border-bottom: 14px solid orange;
  border-left: 14px solid transparent;
}

.indicator.write-only span:last-child {
  position:absolute;
  width: 0;
  height: 0;
  border-top: 14px solid green;
  border-right: 14px solid transparent;
}

.indicator.offline {
  background-color: red;
  border-color: rgba(255,0,0,0.5);
}

tr.online .relay-url {
  cursor: pointer;
}

.verified-shape-wrapper {
  display:inline-block;
  width: 16px;
  height: 16px;
}

.shape.verified {
  background: blue;
  width: 16px;
  height: 16px;
  position: relative;
  top: 5px;
  left:-5px;
  text-align: center;
}
.shape.verified:before,
.shape.verified:after {
  content: "";
  position: absolute;
  top: 0;
  left: 0;
  height: 13px;
  width: 13px;
  background: blue;
}
.shape.verified:before {
  transform: rotate(30deg);
}
.shape.verified:after {
  transform: rotate(75deg);
}

.credit {
  display:inline-block;

  color:#333;
  text-transform: lowercase;
  font-size:12px;
  margin-top:25px;
}

.credit a {
  text-decoration:none;
}

#wrapper {
  max-width:1400px;
  margin:0 auto;
}

div.block {
  display:block;
  margin:40px 0;
}

h1 {
  position:relative;
  display:inline-block;
  margin: 0 auto
}

h1 sup {
  color: #c0c0c0;
  font-size:15px;
  position:absolute;
  right: -45px;
  top:15px;
}

.title-card {
  text-align:center;
}

.title-card h1 {
  font-size:4.5em;
  text-align:center;
}

.row {
  -webkit-box-shadow: 0px 1px 32px 4px rgba(0,0,0,0.16);
  -moz-box-shadow: 0px 1px 32px 4px rgba(0,0,0,0.16);
  box-shadow: 0px 1px 32px 4px rgba(0,0,0,0.16);
}

.title-info-card {
  border-radius: 20px;
  text-align:center;
}

.title-info-card span {
  display:inline-block;
  margin-top:0.80em;
  font-size: 4em;
  letter-spacing: -0.1em;
  text-align:right;
}

.processing-card {
  margin: 0.8em 0;
  display:block;
  margin:1.5em 0;
  font-size: 4em;
  letter-spacing: -0.1em;
  text-align:center;
}


.loading {
    animation-duration: 1.8s;
    animation-fill-mode: forwards;
    animation-iteration-count: infinite;
    animation-name: placeHolderShimmer;
    animation-timing-function: linear;
    background: #f6f7f8;
    background: linear-gradient(to right, #fafafa 8%, #f4f4f4 38%, #fafafa 54%);
    background-size: 1000px 640px;
    position: relative;

}

.loaded .loading {
  animation: none;
  bakground:none;
  display:none;
}

@keyframes placeHolderShimmer{
    0%{
        background-position: -468px 0
    }
    100%{
        background-position: 468px 0
    }
}

li.observation {
  display: inline;
  cursor: pointer;
}

</style>
