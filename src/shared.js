import { Inspector, InspectorObservation } from 'nostr-relay-inspector'
import { messages as RELAY_MESSAGES, codes as RELAY_CODES } from '../codes.yaml'

import crypto from "crypto"

const connections = {}

export default {
	invalidate: async function(force, single){
      if(!this.isExpired() && !force) 
        return

      if(single) {
        await this.check(single) 
        this.relays[single] = this.getState(single)
        this.messages[single] = this.getState(`${single}_inbox`) 
      } 
      else {
        for(let index = 0; index < this.relays.length; index++) {
          let relay = this.relays[index]
          await this.delay(20).then( () => { 
            this.check(relay)
              .then(() => {
                this.result[relay] = this.getState(relay)
                this.messages[relay] = this.getState(`${relay}_inbox`) 
              }).catch( err => console.log(err))
          }).catch(err => console.log(err))
        }
      } 
    },

    isExpired: function(){
      return typeof this.lastUpdate === 'undefined' || Date.now() - this.lastUpdate > this.preferences.cacheExpiration
    },

    getState: function(key){
      return this.storage.getStorageSync(key)
    },

    query (aggregate) {
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
            let a = relay1,
                b = relay2
            return (a===null)-(b===null) || +(a>b)||-(a<b);
          })
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

        connections[relay] = new Inspector(relay, opts)

        connections[relay]
          .on('complete', (instance) => {   
            this.result[relay] = instance.result

            this.result[relay].aggregate = this.getAggregate(relay)

            this.saveState('relay', relay)
            this.saveState('messages', relay,  instance.inbox)
            this.saveState('lastUpdate')

            connections[relay].relay.close()
            
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

    onComplete(relay, resolve, reject){
      relay, resolve, reject
    },

    saveState: function(type, key, data){
      
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
    recheck: function(relay){
      const inspect = this.connections[relay]
      inspect.checkLatency()

    },

    adjustResult: function(relay) {
      this.result[relay].observations.forEach( observation => {
        if (observation.code == "BLOCKS_WRITE_STATUS_CHECK") {
          this.result[relay].check.write = false
          this.result[relay].aggregate = 'public'
        }
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
      return this.relays.length //TODO: Figure out WHY?
    },

    relaysConnected: function() {
      return Object.entries(this.result).length
    },

    relaysComplete: function() {
      return this.relays?.filter(relay => this.results?.[relay]?.state == 'complete').length
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
      var seconds = Math.floor((new Date() - date) / 1000);
      var interval = seconds / 31536000;
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
}