<template>
  <div>
    <div class="text-h5 text-bold q-py-md q-px-sm full-width flex row justify-start">
      <h1>Nostr Relay Registry</h1>
      <span>Next ping in {{ nextPing }} seconds</span> |
      <span v-if="relays.filter((url) => status[url] && !status[url].complete).length > 0">Processing {{relays.filter((url) => status[url].complete).length}}/{{relays.length}}</span>
    </div>

    <row container :gutter="12">
      <column :xs="12" :md="12" :lg="6">
        <div>
          <h2><span class="indicator badge readwrite">{{ query('public').length }}</span>Public</h2>
          <table class="online"  v-if="query('public').length > 0">
            <tr>
              <th></th>
              <th></th>
              <th>🔌</th>
              <th>👁️‍🗨️</th>
              <th>✏️</th>
              <th>🌎</th>
              <!-- <td>wl</td>
              <td>nip-05><td> -->
              <th>⌛️</th>
              <th>ℹ️</th>
            </tr>
            <tr v-for="relay in query('public')" :key="{relay}" :class="getLoadingClass(relay)">
              <td :key="generateKey(relay, 'aggregate')"><span :class="getAggregateStatusClass(relay)"></span></td>

              <td class="left-align relay-url" @click="copy(relay)">{{ relay }}</td>
              <td :key="generateKey(relay, 'didConnect')"><span :class="getStatusClass(relay, 'didConnect')"></span></td>
              <td :key="generateKey(relay, 'didRead')"><span :class="getStatusClass(relay, 'didRead')"></span></td>
              <td :key="generateKey(relay, 'didWrite')"><span :class="getStatusClass(relay, 'didWrite')"></span></td>
              <td>{{status[relay].flag}}</td>
              <td><span v-if="status[relay].didConnect">{{ status[relay].latency }}<span v-if="status[relay].latency">ms</span></span></td>
              <td>
                <Popper v-if="Object.keys(status[relay].messages).length">
                  {{ status[relay].type }}
                  <button @mouseover="showPopper">log</button>
                  <template #content>
                    <ul>
                      <li v-for="(message, key) in status[relay].messages" :key="generateKey(relay, key)">{{key}}</li>
                    </ul>
                  </template>
                </Popper>
              </td>
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
                <Popper v-if="Object.keys(status[relay].messages).length">
                  <button @mouseover="showPopper">log</button>
                  <template #content>
                    <ul>
                      <li v-for="(message, key) in status[relay].messages" :key="generateKey(relay, key)">{{key}}</li>
                    </ul>
                  </template>
                </Popper>
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
              <th>msg</th>
            </tr>
            <tr v-for="relay in query('offline')" :key="{relay}" :class="getLoadingClass(relay)">
              <td :key="generateKey(relay, 'aggregate')"><span :class="getAggregateStatusClass(relay)"></span></td>
              <td class="left-align relay-url">{{ relay }}</td>
              <td :key="generateKey(relay, 'didConnect')"><span :class="getStatusClass(relay, 'didConnect')"></span></td>
              <td :key="generateKey(relay, 'didRead')"><span :class="getStatusClass(relay, 'didRead')"></span></td>
              <td :key="generateKey(relay, 'didWrite')"><span :class="getStatusClass(relay, 'didWrite')"></span></td>
              <td>
                <Popper v-if="Object.keys(status[relay].messages).length">
                  <button>log</button>
                  <template #content>
                    <ul>
                      <li v-for="(message, key) in status[relay].messages" :key="generateKey(relay, key)">{{key}}</li>
                    </ul>
                  </template>
                </Popper>
              </td>
            </tr>
          </table>
        </div>
      </column>
    </row>

    <!-- <h2>Processing</h2>
    <table v-if="relays.filter((url) => !status[url].complete).length > 0">
      <tr>
        <th></th>
      </tr>
      <tr v-for="relay in relays.filter((url) => !status[url].complete)" :key="{relay}" :class="getLoadingClass(relay)">
        <td>{{ relay }}</td>
      </tr>
    </table>
    <a href="./relays/">JSON API</a> -->
  </div>
</template>

<script>
/* eslint-disable */
import { defineComponent} from 'vue'
// import { relayConnect } from 'nostr-tools/relay'
import { RelayPool, Relay } from 'nostr'

import { Row, Column } from 'vue-grid-responsive';
import Popper from "vue3-popper";
import onionRegex from 'onion-regex';
import countryCodeEmoji from 'country-code-emoji'
import emoji from 'node-emoji'

import { relays } from '../../relays.yaml'
import { messages as RELAY_MESSAGES, codes as RELAY_CODES } from '../../codes.yaml'

import crypto from "crypto"

const refreshMillis = 3*60*1000

export default defineComponent({
  name: 'BaseRelays',
  components: {
    Row,
    Column,
    Popper
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
    }
  },

  methods: {

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
      ? 'green'
      : this.status?.[url]?.[key] === false
        ? 'red'
        : 'silver'
      return `indicator ${status}`
    },

    getLoadingClass (url) {
      return this.status?.[url]?.complete ? "relay loaded" : "relay"
    },

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

    setComplete (url) {
      let connect = typeof this.status?.[url]?.didConnect !== 'undefined',
          read = typeof this.status?.[url]?.didRead !== 'undefined',
          write = typeof this.status?.[url]?.didWrite !== 'undefined'

      console.log(connect, read, write)

      this.setAggregateStatus(url)

      if(connect && read && write) {
        this.status[url].complete = true
        this.connections[url].close()
      }

    },
    generateKey (url, key) {
      return `${url}_${key}`
    },

    testConnect (url) {
      // console.log(url, "CONNECT", "TEST")
      // const self = this
      // this.connections[url] = Relay(url)
      // console.log(this.connections[url])
      // this.connections[url]
      //   .on('open', (e) => {
      //     console.log('open', e)
      //     self.testWrite(url)
      //     self.testRead(url)
      //   })
      //   .on('error', (e) => {
      //     console.log('error', e)
      //   })
      //
      //   .on('message', (message) => {
      //     console.log('message', message)
      //
      //     // console.log(url, "CONNECT", "SUCCESS")
      //     // const hash = this.sha1(message)
      //     // let   message_obj = RELAY_MESSAGES[hash]
      //     // let   code_obj = RELAY_CODES[message_obj.code]
      //     //
      //     // message_obj.type = code_obj.type
      //     // this.status[url].messages[message] = message_obj
      //     // this.adjustStatus(url, hash)
      //   })
      //   .on('event', (relay, sub_id, ev) => {
      //     console.log('event', relay, sub_id, ev)
      //   })
      //   .on('notice', (message) => {
      //     console.log('notice', message)
      //   })
      //   .on('close', (e) => {
      //     console.log('close', e)
      //   })


      //   // () => {},
      //   (message) => {
      //
      //
      //     console.log(hash)
      //     console.dir(message_obj)
      //     console.dir(code_obj)
      //
      //
      //     // console.log("RECIEVED MESSAGE!")
      //     // console.dir(this.status[url].messages)
      //   },
      //   () => {
      //     console.log(url, "CONNECT", "FAILURE")
      //     this.status[url].didConnect = false
      //     this.status[url].didRead = false
      //     this.status[url].didWrite = false
      //     this.setComplete(url)
      //   }
      // )
      // this.status[url].didConnect = true
    },

    async testRead (url) {
      // console.log(url, "READ", "TEST")
      this.connections[url].subscribe(this.getID(url, "read"), {limit: 1, kinds:[1]})
      // console.dir(this.connections[url])
      // // console.log(this.connections[url]['get status']())
      // console.log(url, "READ", "TEST")
      // let start
      // start = Date.now();
      //
      //
      // let {unsub} = await this.connections[url].sub(
      //   {
      //     cb: () => {
      //       console.log(url, "READ", "SUCCESS")
      //       this.status[url].didRead = true
      //       this.setComplete(url)
      //       this.latency[url].read = Date.now() - start;
      //       unsub()
      //       clearTimeout(willUnsub)
      //     },
      //     filter: {
      //       ids: [
      //         '41ce9bc50da77dda5542f020370ecc2b056d8f2be93c1cedf1bf57efcab095b0'
      //       ]
      //     }
      //   },
      //   'nostr-registry'
      // )
      // let willUnsub = setTimeout(() => {
      //   unsub()
      //   console.log(url, "READ", "FAILURE")
      //   if(!this.status[url].maybe_public) this.status[url].didRead = false
      //   this.setComplete(url)
      // }, 10000)
    },

    async testWrite (url) {
      this.connections[url].send({
        id: '41ce9bc50da77dda5542f020370ecc2b056d8f2be93c1cedf1bf57efcab095b0',
        pubkey:
          '5a462fa6044b4b8da318528a6987a45e3adf832bd1c64bd6910eacfecdf07541',
        created_at: 1640305962,
        kind: 1,
        tags: [],
        content: 'running branle',
        sig: '08e6303565e9282f32bed41eee4136f45418f366c0ec489ef4f90d13de1b3b9fb45e14c74f926441f8155236fb2f6fef5b48a5c52b19298a0585a2c06afe39ed'
      })
      this.connections[url].subscribe(this.getID(url, "write"), {limit: 1, kinds:[1], ids:['41ce9bc50da77dda5542f020370ecc2b056d8f2be93c1cedf1bf57efcab095b0']})
    },

    getID(url, keyword) {
      return `${keyword}_${url}`
    },

    async testRelay (url) {
      this.lastPing = Date.now()
      this.latency[url] = {}
      this.status[url].messages = {}

      let relay

      relay = Relay(url)
      relay.on('open', e => {
          console.log(url, "OPEN")
          this.status[url].didConnect = true
          this.testRead(url)
          this.testWrite(url)
          this.setComplete(url)
        })
      relay.on('eose', e => {
      	// relay.close()
      })
      relay.on('ok', () => {
        // console.log('ok')
        // console.dir(arguments)
      })
      relay.on('error', (e, b) => {
        this.status[url].didConnect = false
      })
      relay.on('close', (e) => {
        // console.log('close', e)
        // console.dir(arguments)
      })

      relay.on('other', (e) => {
        console.log('OTHER!!!!', e)
      })

      relay.on('event', (sub_id, ev) => {
        // console.log('event', sub_id, ev)
        if(sub_id == this.getID(url, "read")) {
          // console.log("SUCCESS:", "READ")
          this.status[url].didRead = true
          this.setComplete(url)
        }
        if(sub_id == this.getID(url, "write")) {
          // console.log("SUCCESS:", "WRITE")
          this.status[url].didWrite = true
          this.setComplete(url)
        }
        // relay.unsubscribe(sub_id)
      })

      relay.on('message', (message) => {
        // console.log('message', message)
        // console.dir(arguments)
      })

      relay.on('notice', (message) => {
        // console.log('notice', message)
        // console.dir(arguments)
      })

      this.connections[url] = relay

      this.setLatency(url)
      await this.getIP(url)
      await this.setGeo(url)
      this.setFlag(url)
    },

    isOnion(url){
      return onionRegex().test(url)
    },

    setLatency(url) {
      this.status[url].latency = this.latency[url].read
    },

    testRelayLatency(){
      // console.log('testing latency')
      this.relays.forEach(url => {
        // this.testWrite(url, true)
        this.testRead(url, true)
        this.setLatency(url)
      })
      this.lastPing = Date.now()
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

    adjustStatus (url, hash) {
      let code = RELAY_MESSAGES[hash].code,
          type = RELAY_CODES[code].type

      this.status[url][type] = code
      if (type == "maybe_public") {
        this.status[url].didWrite = true
        this.status[url].didRead = true
      }
      if (type == "write_restricted") {
        this.status[url].didWrite = false
      }

    },

    sha1 (message) {
      const hash = crypto.createHash('sha1').update(JSON.stringify(message)).digest('hex')
      // console.log(message, ':', hash)
      return hash
    },
  },



  mounted() {
    this.relays.forEach(async url => {
      this.status[url] = {} //statusInterface
      if (this.isOnion(url)) {
        url = `${url}.to` //add proxy
      }
      await this.testRelay(url)
    })

    // // eslint-disable-next-line
    // let latencyTimeout = setTimeout(() => { this.testRelayLatency() }, 10000)
    //
    // // eslint-disable-next-line
    // let latencyIntVal = setInterval(() => { this.testRelayLatency() }, refreshMillis)
    // // eslint-disable-next-line
    // let counterIntVal = setInterval(() => {
    //   this.nextPing = Math.round((this.lastPing + refreshMillis - Date.now())/1000)
    // }, 1000)

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
.badge.read-only {
  background-color:orange !important;
}

.aggregate.indicator {
    background-color: transparent;
    border-radius: 0px;
    border-style: solid;
}

.indicator.silver {
  background-color: #c0c0c0;
  border-color: rgba(55,55,55,0.5);
}

.indicator.green {
  background-color: green;
  border-color: rgba(0,255,0,0.5);
}

.indicator.red {
  background-color: red;
border-color: rgba(255,0,0,0.5);
}

.indicator.orange {
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

</style>
