import { Inspector, InspectorObservation } from 'nostr-relay-inspector'
import { messages as RELAY_MESSAGES, codes as RELAY_CODES } from '../../codes.yaml'

import crypto from "crypto"

export default {
  invalidate: async function(force, single){
      
    if(!this.isExpired() && !force) 
      return

    this.store.relays.updateNow()

    // console.log('invalidate', 'total relays', this.relays.length)
    
    if(single) {
      await this.check(single) 
      // this.relays[single] = this.getCache(single)
      // this.messages[single] = this.getCache(`${single}_inbox`) 
    } 
    else {
      // console.log('total relays', this.relays.length)
      // console.log(this.relays.length)
      for(let index = 0; index < this.relays.length; index++) {
        let relay = this.relays[index]
        // console.log('invalidating', relay)
        await this.delay(20).then( () => { 
          this.check(relay)
            .then(() => {
              // this.store.relays.setResult(relay)
              // this.store.relays.results[relay] = this.getCache(relay)
              // this.messages[relay] = this.getCache(`${relay}_inbox`) 
            }).catch( err => console.log(err))
        }).catch(err => console.log(err))
      }
    } 
  },
    isExpired: function(){
      return !this.store.relays.lastUpdate 
              || Date.now() - this.store.relays.lastUpdate > this.store.prefs.duration
    },

    // getCache: function(key){
    //   return this.storage.getStorageSync(key)
    // },

    // removeCache: function(key){
    //   return this.storage.removeStorageSync(key)
    // },

    sort(relays) {
      let unsorted,
          sorted

      if(!relays && !this.relays)
        return []

      unsorted = relays || this.relays.map(x=>x)

      if (unsorted.length) {
        sorted = unsorted
          .sort((relay1, relay2) => {
            return this.store.relays.results?.[relay1]?.latency.final - this.store.relays.results?.[relay2]?.latency.final
          })
          .sort((relay1, relay2) => {
            let a = this.store.relays.results?.[relay1]?.latency.final ,
                b = this.store.relays.results?.[relay2]?.latency.final 
            return (b != null) - (a != null) || a - b;
          })
          .sort((relay1, relay2) => {
            let x = this.store.relays.results?.[relay1]?.check?.connect,
                y = this.store.relays.results?.[relay2]?.check?.connect
            return (x === y)? 0 : x? -1 : 1;
          })
          // .sort((relay1, relay2) => {
          //   let x = this.store.relays.results?.[relay1]?.check?.read,
          //       y = this.store.relays.results?.[relay2]?.check?.read
          //   return (x === y)? 0 : x? -1 : 1;
          // })
          // .sort((relay1, relay2) => {
          //   let x = this.store.relays.results?.[relay1]?.check?.write,
          //       y = this.store.relays.results?.[relay2]?.check?.write
          //   return (x === y)? 0 : x? -1 : 1;
          // });
        return sorted
      }

      return []
    },

    cleanUrl: function(relay){
      return relay.replace('wss://', '')
    },

    check: async function(relay){
      return new Promise( (resolve, reject) => {
        // if(!this.isExpired())
        //   return reject(relay)

        const opts = {
            checkLatency: true,          
            getInfo: true,
            getIdentities: true,
            debug: true,
            // data: { result: this.store.relays.results[relay] }
          }

        let socket = new Inspector(relay, opts)

        socket
          .on('complete', (instance) => {
            instance.result.aggregate = this.getAggregate(instance.result)
            this.store.relays.setResult(instance.result)
            // this.setCache('relay', relay)
            // this.setCache('messages', relay,  instance.inbox)
            this.store.relays.updateNow()
            instance.relay.close()
            
            resolve(instance.result)
          })
          .on('notice', (notice) => {
            const hash = this.sha1(notice)  
            let   message_obj = RELAY_MESSAGES[hash]
            
            if(!message_obj || !Object.prototype.hasOwnProperty.call(message_obj, 'code'))
              return

            let code_obj = RELAY_CODES[message_obj.code]

            let response_obj = {...message_obj, ...code_obj}

            this.store.relays.results[relay].observations.push( new InspectorObservation('notice', response_obj.code, response_obj.description, response_obj.relates_to) )
          })
          .on('close', () => {})
          .on('error', () => {
            reject(this.store.relays.results[relay])
          })
          .run()

        
      })
    },

    // setCache: function(type, key, data){
      
    //   const now = Date.now()

    //   let store, success, error, instance

    //   switch(type){
    //     case 'relay':
    //       if(data)
    //         data.aggregate = this.getAggregate(key)
    //       store = {
    //         key: key,
    //         data: data || this.store.relays.results[key],
    //         // expire: Date.now()+1000*60*60*24*180,
    //       }
    //       success = () => {
    //         if(data)
    //           this.store.relays.results[key] = data
    //       }
    //       break;
    //     case 'messages':
    //       store = {
    //         key: `${key}_inbox`,
    //         data: data || this.messages[key],
    //         // expire: Date.now()+1000*60*60*24*180,
    //       }
    //       success = () => {
    //         if(data)
    //           this.messages[key] = data
    //       }
    //       break;
    //     case 'lastUpdate':
    //       store = {
    //         key: "lastUpdate",
    //         data: now
    //       }
    //       success = () => {
    //         this.lastUpdate = now
    //       }
    //       break;
    //     case 'preferences':
    //       store = {
    //         key: "preferences",
    //         data: this.preferences
    //       }
    //       break;
    //   }

    //   if(store)
    //     instance = this.storage.setStorage(store)

    //   if(success && store)
    //     instance.then(success)

    //   if(error && store)
    //     instance.catch(error)
    // },

    // resetState: function(){
    //   this.relays.forEach(relay=>{
    //     this.storage.removeStorage(relay)
    //   })
    // },

    getAggregate: function(result) {
      let aggregateTally = 0
      aggregateTally += result?.check.connect ? 1 : 0
      aggregateTally += result?.check.read ? 1 : 0
      aggregateTally += result?.check.write ? 1 : 0

      console.log(result.uri, result?.check.connect, result?.check.read, result?.check.write, aggregateTally)

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
      return Object.entries(this.store.relays.results).length
    },

    relaysComplete: function() {
      return this.relays?.filter(relay => this.store.relays.results?.[relay]?.state == 'complete').length
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
}