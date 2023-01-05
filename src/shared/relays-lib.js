import crypto from "crypto"
import {sort} from 'array-timsort'

export default {
  sortRelays(relays){
    sort(relays, (relay1, relay2) => {
      let a = this.results?.[relay1]?.latency.final || 100000,
          b = this.results?.[relay2]?.latency.final || 100000
      return a-b
    })
    sort(relays, (relay1, relay2) => {
      let x = this.results?.[relay1]?.check?.connect || false,
          y = this.results?.[relay2]?.check?.connect || false
      return (x === y)? 0 : x? -1 : 1;
    })
    sort(relays, (relay1, relay2) => {
      let a = this.results?.[relay1]?.latency.final || null,
          b = this.results?.[relay2]?.latency.final || null
      return (b != null) - (a != null) || a - b;
    })
    if(this.store.prefs.doPinFavorites)
      sort(relays, (relay1, relay2) => {
        let x = this.store.relays.isFavorite(relay1) || false,
            y = this.store.relays.isFavorite(relay2) || false
        return (x === y)? 0 : x? -1 : 1;
      })
    // relays = this.sortRelaysFavoritesOnTop(relays)
    return relays
  },
    setCache: function(result){
      this.$storage.setStorageSync(result.uri, result);      
    },

    getCache: function(key){
      return this.$storage.getStorageSync(key)
    },

    removeCache: function(key){
      return this.$storage.removeStorageSync(key)
    },

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

      // console.log(result.uri, result?.check.connect, result?.check.read, result?.check.write, aggregateTally)

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