<template>
  <div>
    <div class="text-h5 text-bold q-py-md q-px-sm full-width flex row justify-start">
      <h1>Nostr Relay Status <sup>alpha</sup></h1>
      <span>Next ping in {{ nextPing }} seconds</span> |
      <span v-if="relays.filter((url) => status[url] && !status[url].complete).length > 0">Processing {{relays.filter((url) => status[url].complete).length}}/{{relays.length}}</span>
    </div>

    <row container :gutter="12">
      <column :xs="12" :md="12" :lg="6">
        <div>
          <h2><span class="indicator badge readwrite">{{ query('public').length }}</span>Public</h2>
          <table class="online public"  v-if="query('public').length > 0">
            <tr>
              <th></th>
              <th></th>
              <th>ℹ️</th>
              <th>🔌</th>
              <th>👁️‍🗨️</th>
              <th>✏️</th>
              <th><span class="verified-shape-wrapper"><span class="shape verified"></span></span></th>
              <th>🌎</th>
              <!-- <td>wl</td>
              <td>nip-05><td> -->
              <th>⌛️</th>
              <th>NIP-15</th>
              <th>NIP-20</th>
              <th>FILTER: LIMIT</th>
            </tr>
            <tr v-for="relay in query('public')" :key="{relay}" :class="getLoadingClass(relay)">
              <td :key="generateKey(relay, 'aggregate')"><span :class="getAggregateStatusClass(relay)"></span></td>
              <td class="left-align relay-url" @click="copy(relay)">{{ relay }}</td>
              <td>
                <ul v-if="Object.keys(status[relay].notes).length">
                  <li v-tooltip:left.tooltip="key" v-for="(message, key) in status[relay].notes" :key="generateKey(relay, key)">✉️</li>
                </ul>
              </td>
              <td :key="generateKey(relay, 'didConnect')"><span :class="getStatusClass(relay, 'didConnect')"></span></td>
              <td :key="generateKey(relay, 'didRead')"><span :class="getStatusClass(relay, 'didRead')"></span></td>
              <td :key="generateKey(relay, 'didWrite')"><span :class="getStatusClass(relay, 'didWrite')"></span></td>
              <td></td>
              <td>{{status[relay].flag}}</td>
              <td><span v-if="status[relay].didConnect">{{ status[relay].latency }}<span v-if="status[relay].latency">ms</span></span></td>
              <td>{{ setCheck(status[relay].didNip15) }}</td>
              <td>{{ setCheck(status[relay].didNip20) }}</td>
              <td>{{ setCaution(status[relay].didSubscribeFilterLimit) }}</td>
            </tr>
          </table>
        </div>
      </column>

      <column :xs="12" :md="12" :lg="6">
        <div>
          <h2><span class="indicator badge write-only">{{ query('restricted').length }}</span>Restricted</h2>
          <table class="online">
            <tr>
              <th></th>
              <th></th>
              <th>🔌</th>
              <th>👁️‍🗨️</th>
              <th>✏️</th>
              <th>🌎</th>
              <th>⌛️</th>
              <th>ℹ️</th>
            </tr>
            <tr v-for="relay in query('restricted')" :key="{relay}" :class="getLoadingClass(relay)">
              <td :key="generateKey(relay, 'aggregate')"><span :class="getAggregateStatusClass(relay)"><span></span><span></span></span></td>
              <td class="left-align relay-url"  @click="copy(relay)">{{ relay }}</td>
              <td :key="generateKey(relay, 'didConnect')"><span :class="getStatusClass(relay, 'didConnect')"></span></td>
              <td :key="generateKey(relay, 'didRead')"><span :class="getStatusClass(relay, 'didRead')"></span></td>
              <td :key="generateKey(relay, 'didWrite')"><span :class="getStatusClass(relay, 'didWrite')"></span></td>
              <td>{{status[relay].flag}}</td>
              <td><span v-if="status[relay].didConnect">{{ status[relay].latency }}<span v-if="status[relay].latency">ms</span></span></td>
              <td>
                <ul v-if="Object.keys(status[relay].notes).length">
                  <li v-tooltip:left.tooltip="key" v-for="(message, key) in status[relay].notes" :key="generateKey(relay, key)">✉️</li>
                </ul>
              </td>
            </tr>
          </table>

          <h2><span class="indicator badge offline">{{ query('offline').length }}</span>Offline</h2>
          <table v-if="query('offline').length > 0">
            <tr>
              <th></th>
              <th></th>
              <th>🔌</th>
              <th>👁️‍🗨️</th>
              <th>✏️</th>
              <th>ℹ️</th>
            </tr>
            <tr v-for="relay in query('offline')" :key="{relay}" :class="getLoadingClass(relay)">
              <td :key="generateKey(relay, 'aggregate')"><span :class="getAggregateStatusClass(relay)"></span></td>
              <td class="left-align relay-url">{{ relay }}</td>
              <td :key="generateKey(relay, 'didConnect')"><span :class="getStatusClass(relay, 'didConnect')"></span></td>
              <td :key="generateKey(relay, 'didRead')"><span :class="getStatusClass(relay, 'didRead')"></span></td>
              <td :key="generateKey(relay, 'didWrite')"><span :class="getStatusClass(relay, 'didWrite')"></span></td>
              <td>
                <ul v-if="Object.keys(status[relay].notes).length">
                  <li v-tooltip:left.tooltip="key" v-for="(message, key) in status[relay].notes" :key="generateKey(relay, key)">✉️</li>
                </ul>
              </td>
            </tr>
          </table>
        </div>
      </column>
    </row>

    <!-- <h2>Processing</h2>
    <table v-if="relays.filter((url) => status[url] && !status[url].complete).length > 0">
      <tr>
        <th></th>
      </tr>
      <tr v-for="relay in relays.filter((url) => !status[url].complete)" :key="{relay}" :class="getLoadingClass(relay)">
        <td>{{ relay }}</td>
      </tr>
    </table>
    <a href="./relays/">JSON API</a> -->
    <a class="credit" href="http://sandwich.farm">Another 🥪 by sandwich.farm</a>

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
import { RelayPool, Relay } from 'nostr'

import { Row, Column } from 'vue-grid-responsive';
import Popper from "vue3-popper";
import onionRegex from 'onion-regex';
import countryCodeEmoji from 'country-code-emoji'
import emoji from 'node-emoji'

import { relays } from '../../relays.yaml'
import { messages as RELAY_MESSAGES, codes as RELAY_CODES } from '../../codes.yaml'

import { Inspector, Observation } from '../../../nostr-relay-inspector'

import crypto from "crypto"

const refreshMillis = 3*60*1000

export default defineComponent({
  name: 'BaseRelays',
  components: {
    Row,
    Column,
    TooltipComponent
  },

  data() {
    return {
      relays,
      status: {},
      lastPing: Date.now(),
      nextPing: Date.now() + (60*1000),
      connections: {},
      latency: {},
      pool: null,
      timeouts: {},
      nips: {},
    }
  },

  mounted() {
    this.relays.forEach(async relay => {
      this.status[relay] = {}
      const inspect = new Inspector(relay)
      console.dir(inspect)
      inspect.run()
      // await this.testRelay(url)
    })

    // let latencyIntVal
    // let counterIntVal
    //
    // // eslint-disable-next-line
    // let latencyTimeout = setTimeout(() => {
    //   this.testRelayLatency()
    //   // eslint-disable-next-line
    //   latencyIntVal = setInterval(() => { this.testRelayLatency() }, refreshMillis)
    //   // eslint-disable-next-line
    //   latencyIntVal = setInterval(() => { this.nextPing = Math.round((this.lastPing + refreshMillis - Date.now())/1000)}, 1000)
    // }, 10000)
  },

  methods: {

    hardFail(url) {
      if(!this.status[url]) this.status[url] = {}
      this.status[url].didConnect = false
      this.status[url].didRead = false
      this.status[url].didWrite = false
      this.tryComplete(url)
      if(this.connections[url].close) this.connections[url].close()
    },

    async testRelay (url) {
      this.lastPing = Date.now()
      this.latency[url] = {}
      this.timeouts[url] = {}
      this.status[url].notes = {}
      this.status[url].state = 'pending'
      this.nips[url] = new Array(99).fill(null);
      this.status[url].readEventCount = 0
      this.status[url].writeEventCount = 0
      this.status[url].latencyEventCount = 0
      this.status[url].didNip15 = false
      this.status[url].didNip20 = false

      this.timeouts[url].didConnect = setTimeout(() => {
        console.log(url, "TIMEOUT")
        if(Object.keys(this.status[url].notes).length == 0) this.status[url].notes['Reason: Timeout'] = {}
        this.hardFail(url)
      }, 20000)

      let relay = Relay(url, {reconnect: false})
      relay.on('open', e => {
        console.log(url, "OPEN")
        clearTimeout(this.timeouts[url].didConnect)
        this.status[url].didConnect = true
        this.testRead(url, "testRead")
        this.testWrite(url, "testWrite")
        this.tryComplete(url)
        console.log(url, "did connect", this.status[url].didConnect)
      })
      relay.on('eose', e => {
        //console.log('EOSE', e)
        // relay.close()
        this.tryComplete(url)
        this.status[url].didNip15 = true
      })
      relay.on('error', (e) => {
        //console.log('ERROR', e)
        clearTimeout(this.timeouts[url].didConnect)
        this.status[url].notes['Reason: Error'] = {}
        this.hardFail(url)
      })

      relay.on('ok', () => {
        this.status[url].didNip20 = true
      })

      relay.on('close', (e) => {
        console.log('close', e)
        // console.dir(arguments)
      })

      relay.on('other', (e) => {
        // console.log('OTHER!!!!', e)
      })

      relay.on('event', (sub_id, ev) => {
        // console.log('event', sub_id, ev)
        if(sub_id == this.getID(url, "testRead")) {
          // console.log("SUCCESS:", "READ")
          this.status[url].readEventCount++
          this.status[url].didRead = true
          clearTimeout(this.timeouts[url].testRead)
          this.connections[url].unsubscribe(sub_id)
          // this.tryComplete(url)
          this.tryComplete(url)
        }
        if(sub_id == this.getID(url, "testWrite")) {
          if(this.status[url].writeEventCount < 1) {
            // console.log("SUCCESS:", "WRITE")
            this.status[url].didWrite = true
            console.log(ev)
            // this.tryComplete(url)
            //console.log(url, this.timeouts[url].testWrite)
            clearTimeout(this.timeouts[url].testWrite)
            this.tryComplete(url)
          }
          this.status[url].writeEventCount++
        }
        if(sub_id == this.getID(url, "testLatency")) {
          if(this.status[url].latencyEventCount < 1) {
            console.log(url, "SUCCESS:", "test latency")
            clearTimeout(this.timeouts[url].testLatency)
            console.log(this.latency[url].start, this.latency[url].final)
            this.latency[url].final = Date.now() - this.latency[url].start
            this.setLatency(url)
          }
          this.status[url].latencyEventCount++
          // this.tryComplete(url)
          //console.log(url, this.timeouts[url].testRead)
        }
        // relay.unsubscribe(sub_id)
      })

      relay.on('message', (message) => {
        // console.log('message', message)
        // console.dir(arguments)
      })

      relay.on('notice', (message) => {
        const hash = this.sha1(message)
        let   message_obj = RELAY_MESSAGES[hash]
        let   code_obj = RELAY_CODES[message_obj.code]

        message_obj.type = code_obj.type
        message_obj.hash = hash
        this.status[url].notes[code_obj.description] = message_obj
        // this.adjustStatus(url, hash)
      })
      this.connections[url] = relay
      await this.getIP(url)
      await this.setGeo(url)
      this.setFlag(url)
      // this.setNip05(url)
    },

    // query (group, filterType) {
    query (group) {
      let unordered,
          filterFn

      // if(filterByType) {
      //   filterFn = (relay) => this.status?.[relay]?.aggregate == group || this.status?.[relay]?.[filterType];
      // } else {
      filterFn = (relay) => this.status?.[relay]?.aggregate == group
      // }

      unordered = this.relays.filter(filterFn);

      if (unordered.length) {
        return unordered.sort((relay1, relay2) => {
          return this.status?.[relay1]?.latency - this.status?.[relay2]?.latency
        })
      }

      return []
    },

    getAggregateStatusClass (url) {
      let status = ''
      if (this.status?.[url]?.aggregate == null) {
        status = 'unprocessed'
      }
      else if (this.status?.[url]?.aggregate == 'public') {
        status = 'readwrite'
      }
      else if (this.status?.[url]?.aggregate == 'restricted') {
        if(this.status?.[url]?.didWrite) {
          status = 'write-only'
        } else {
          status = 'read-only'
        }
      }
      else if (this.status?.[url]?.aggregate == 'offline') {
        status = 'offline'
      }
      return `aggregate indicator ${status}`
    },

    getStatusClass (url, key) {
      let status = this.status?.[url]?.[key] === true
      ? 'success'
      : this.status?.[url]?.[key] === false
        ? 'failure'
        : 'pending'
      return `indicator ${status}`
    },

    getLoadingClass (url) {
      return this.status?.[url]?.complete ? "relay loaded" : "relay"
    },

    // setNip05(url){
    //   const data = nip05(url.replace('wss://', ''))
    //   if(data.length) {
    //     this.nips[url][5] = data
    //     this.status[url].nip05 = true
    //   }
    // },

    setAggregateStatus (url) {
      let aggregateTally = 0
      aggregateTally += this.status?.[url]?.didConnect ? 1 : 0
      aggregateTally += this.status?.[url]?.didRead ? 1 : 0
      aggregateTally += this.status?.[url]?.didWrite ? 1 : 0
      if (aggregateTally == 3) {
        this.status[url].aggregate = 'public'
      }
      else if (aggregateTally == 0) {
        this.status[url].aggregate = 'offline'
      }
      else {
        this.status[url].aggregate = 'restricted'
      }
    },

    async copy(text) {
      try {
        await navigator.clipboard.writeText(text);
      } catch($e) {
        console.log('Cannot copy');
      }
    },

    tryComplete (url) {
      let connect = typeof this.status?.[url]?.didConnect !== 'undefined',
          read = typeof this.status?.[url]?.didRead !== 'undefined',
          write = typeof this.status?.[url]?.didWrite !== 'undefined'

      console.log(url, 'trying complete', connect, read, write)

      if(connect && read && write) {
        console.log(url, 'did complete')
        this.setAggregateStatus(url)
        this.adjustStatus(url)
        this.status[url].complete = true
        this.status[url].testing = false
        if(this.status[url].readEventCount > 1) {
          this.status[url].didSubscribeFilterLimit = false
        } else {
          this.status[url].didSubscribeFilterLimit = true
        }
      }
    },
    generateKey (url, key) {
      return `${url}_${key}`
    },

    async testRead (url, id, benchmark) {
      const subid = this.getID(url, id)
      if(benchmark) this.latency[url].start = Date.now()
      if(benchmark) console.log(url, subid, this.latency[url].start)
      this.connections[url].subscribe(subid, {limit: 1, kinds:[1]})
      this.timeouts[url][id] = setTimeout(() => {
        if(!benchmark) this.status[url].didRead = false
        this.tryComplete(url)
      }, 3000)
    },

    async testWrite (url, id, benchmark) {
      // console.log(url, "WRITE", "TEST")
      const message = {
        id: '41ce9bc50da77dda5542f020370ecc2b056d8f2be93c1cedf1bf57efcab095b0',
        pubkey:
          '5a462fa6044b4b8da318528a6987a45e3adf832bd1c64bd6910eacfecdf07541',
        created_at: 1640305962,
        kind: 1,
        tags: [],
        content: 'running branle',
        sig: '08e6303565e9282f32bed41eee4136f45418f366c0ec489ef4f90d13de1b3b9fb45e14c74f926441f8155236fb2f6fef5b48a5c52b19298a0585a2c06afe39ed'
      }
      this.connections[url].send(["EVENT", message])
      this.connections[url].subscribe(this.getID(url, id), {limit: 1, kinds:[1], ids:['41ce9bc50da77dda5542f020370ecc2b056d8f2be93c1cedf1bf57efcab095b0']})
      this.timeouts[url][id] = setTimeout(() => {
        console.log(url, "did write", id, false)
        if(!benchmark) this.status[url].didWrite = false
        this.tryComplete(url)
      }, 10000)
    },

    getID(url, keyword) {
      return `${keyword}_${url}`
    },

    isOnion(url){
      return onionRegex().test(url)
    },

    setLatency(url) {
      // console.log(this.status[url].didConnect === true, this.status[url]. latency,this.latency[url].final)
      if (this.status[url].didConnect === true) this.status[url].latency = this.latency[url].final
      // console.log(this.status[url].didConnect === true, this.status[url]. latency,this.latency[url].final)
      console.log("latency",this.latency[url])
    },

    testRelayLatency(){
      console.log('testing latency')
      this.relays.forEach(url => {
        console.log(url, 'did read', this.status[url].didRead)
        if(this.status[url].didRead) {
          console.log(url, 'testing read')
          this.testRead(url, "testLatency", true)
        }
        this.lastPing = Date.now()
      })
    },

    async getIP(url){
      let ip
      await fetch(`https://1.1.1.1/dns-query?name=${url.replace('wss://', '')}`, { headers: { 'accept': 'application/dns-json' } })
        .then(response => response.json())
        .then((data) => { ip = data.Answer ? data.Answer[data.Answer.length-1].data : false });
      this.status[url].ip = ip
      // console.log('IP:', ip)
    },

    async setGeo(url){
      if (!this.status[url].ip) return
      await fetch(`http://ip-api.com/json/${this.status[url].ip}`, { headers: { 'accept': 'application/dns-json' } })
        .then(response => response.json())
        .then((data) => { this.status[url].geo = data });
      // console.dir(this.status[url].geo)
    },

    setFlag (url) {
      this.status[url].flag = this.status[url].geo?.countryCode ? countryCodeEmoji(this.status[url].geo.countryCode) : emoji.get('shrug');
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



    adjustStatus (url) {
      Object.entries(this.status[url].notes).forEach( ([key, value]) => {
        if(!value.hasOwnProperty("hash")) return
        let code = RELAY_MESSAGES[value.hash].code,
            type = RELAY_CODES[code].type

        this.status[url][type] = code
        if (type == "maybe_public") {
          this.status[url].didWrite = false
          this.status[url].aggregate = 'public'
        }
        if (type == "write_restricted") {
          this.status[url].didWrite = false
        }
      })
    },

    sha1 (message) {
      const hash = crypto.createHash('sha1').update(JSON.stringify(message)).digest('hex')
      // console.log(message, ':', hash)
      return hash
    },
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
table.online.public .indicator.failure {
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

table.online .relay-url {
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

sup {
  color: #c0c0c0;
  font-size:15px;
}

.credit {
  display:inline-block;
  text-decoration:none;
  color:#333;
  text-transform: uppercase;
  font-size:12px;
  margin-top:25px;
}

</style>
