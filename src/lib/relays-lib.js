import { Inspector, InspectorObservation } from 'nostr-relay-inspector'
import { messages as RELAY_MESSAGES, codes as RELAY_CODES } from '../../codes.yaml'

import crypto from "crypto"

export default {
    isExpired: function(){
      return typeof this.lastUpdate === 'undefined' || Date.now() - this.lastUpdate > this.preferences.cacheExpiration
    },

    getCache: function(key){
      return this.storage.getStorageSync(key)
    },

    removeCache: function(key){
      return this.storage.removeStorageSync(key)
    },

    sort(aggregate) {
      let unsorted,
          sorted,
          filterFn

      filterFn = (relay) => this.grouping ? this.result?.[relay]?.aggregate == aggregate : true

      unsorted = this.relays.filter(filterFn);

      // if(!this.isDone()) {
      //   return unsorted
      // }

      if (unsorted.length) {
        sorted = unsorted
          .sort((relay1, relay2) => {
            return this.result?.[relay1]?.latency.final - this.result?.[relay2]?.latency.final
          })
          .sort((relay1, relay2) => {
            let a = this.result?.[relay1]?.latency.final ,
                b = this.result?.[relay2]?.latency.final 
            return (b != null) - (a != null) || a - b;
          })
          .sort((relay1, relay2) => {
            let x = this.result?.[relay2]?.check?.connect,
                y = this.result?.[relay2]?.check?.connect

            return (x === y)? 0 : x? -1 : 1;
          });
        return sorted
      }

      return []
    },

    check: async function(relay){
      return new Promise( (resolve, reject) => {
        // if(!this.isExpired())
        //   return reject(relay)

        const opts = {
            checkLatency: true,          
            getInfo: true,
            getIdentities: true,
            // debug: true,
            // data: { result: this.result[relay] }
          }

        let socket = new Inspector(relay, opts)

        socket
          .on('complete', (instance) => {   
            this.result[relay] = instance.result

            this.result[relay].aggregate = this.getAggregate(relay)

            this.setCache('relay', relay)
            this.setCache('messages', relay,  instance.inbox)
            this.setCache('lastUpdate')

            instance.relay.close()
            
            resolve(this.result[relay])
          })
          .on('notice', (notice) => {
            const hash = this.sha1(notice)  
            let   message_obj = RELAY_MESSAGES[hash]
            
            if(!message_obj || !Object.prototype.hasOwnProperty.call(message_obj, 'code'))
              return

            let code_obj = RELAY_CODES[message_obj.code]

            let response_obj = {...message_obj, ...code_obj}

            this.result[relay].observations.push( new InspectorObservation('notice', response_obj.code, response_obj.description, response_obj.relates_to) )
          })
          .on('close', () => {})
          .on('error', () => {
            reject(this.result[relay])
          })
          .run()

        
      })
    },

    setCache: function(type, key, data){
      
      const now = Date.now()

      let store, success, error, instance

      switch(type){
        case 'relay':
          if(data)
            data.aggregate = this.getAggregate(key)
          store = {
            key: key,
            data: data || this.result[key],
            // expire: Date.now()+1000*60*60*24*180,
          }
          success = () => {
            if(data)
              this.result[key] = data
          }
          break;
        case 'messages':
          store = {
            key: `${key}_inbox`,
            data: data || this.messages[key],
            // expire: Date.now()+1000*60*60*24*180,
          }
          success = () => {
            if(data)
              this.messages[key] = data
          }
          break;
        case 'lastUpdate':
          store = {
            key: "lastUpdate",
            data: now
          }
          success = () => {
            this.lastUpdate = now
          }
          break;
        case 'preferences':
          store = {
            key: "preferences",
            data: this.preferences
          }
          break;
      }

      if(store)
        instance = this.storage.setStorage(store)

      if(success && store)
        instance.then(success)

      if(error && store)
        instance.catch(error)
    },

    resetState: function(){
      this.relays.forEach(relay=>{
        this.storage.removeStorage(relay)
      })
    },

    getAggregate: function(relay) {
      let aggregateTally = 0
      aggregateTally += this.result?.[relay]?.check.connect ? 1 : 0
      aggregateTally += this.result?.[relay]?.check.read ? 1 : 0
      aggregateTally += this.result?.[relay]?.check.write ? 1 : 0
      if (aggregateTally == 3) {
        return 'public'
      }
      else if (aggregateTally == 0) {
        return 'offline'
      }
      else {
        return 'restricted'
      }
    },

    relaysTotal: function() {
      return this.relays.length
    },

    relaysConnected: function() {
      return Object.entries(this.result).length
    },

    relaysComplete: function() {
      return this.relays?.filter(relay => this.result?.[relay]?.state == 'complete').length
    },

    sha1: function(message) {
      const hash = crypto.createHash('sha1').update(JSON.stringify(message)).digest('hex')
      return hash
    },

    isDone: function(){
      return this.relaysTotal()-this.relaysComplete() <= 0
    },

    loadingComplete: function(){
      return this.isDone() ? 'loaded' : ''
    },

    timeSince: function(date) {
      let seconds = Math.floor((new Date() - date) / 1000);
      let interval = seconds / 31536000;
      if (interval > 1) {
        return Math.floor(interval) + " years";
      }
      interval = seconds / 2592000;
      if (interval > 1) {
        return Math.floor(interval) + " months";
      }
      interval = seconds / 86400;
      if (interval > 1) {
        return Math.floor(interval) + " days";
      }
      interval = seconds / 3600;
      if (interval > 1) {
        return Math.floor(interval) + " hours";
      }
      interval = seconds / 60;
      if (interval > 1) {
        return Math.floor(interval) + " minutes";
      }
      return Math.floor(seconds) + " seconds";
    },

    delay(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    },
    sort_by_latency(ascending) {
      const self = this
      return function (a, b) {
        // equal items sort equally
        if (self.result?.[a]?.latency.final === self.result?.[b]?.latency.final) {
            return 0;
        }

        // nulls sort after anything else
        if (self.result?.[a]?.latency.final === null) {
            return 1;
        }
        if (self.result?.[b]?.latency.final === null) {
            return -1;
        }

        // otherwise, if we're ascending, lowest sorts first
        if (ascending) {
            return self.result?.[a]?.latency.final - self.result?.[b]?.latency.final;
        }

        // if descending, highest sorts first
        return self.result?.[b]?.latency.final-self.result?.[a]?.latency.final;
      };
    },
    sortByLatency () {
      let unsorted

      unsorted = this.relays;

      if (unsorted.length)
        return unsorted.sort(this.sort_by_latency(true))

      return []
    },
}