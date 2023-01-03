import crypto from "crypto"
import {sort} from 'array-timsort'

export default {
  psuedoRouter: function(){
    console.log(this)
    const route = this.parseRouterHash()
    console.log('pseudo route', route)
    if(route.section)
      this.activeNavItem = route.section
    if(route.subsection)
      this.activePageItem = route.subsection
  },

  parseRouterHash: function(){
    const hashParams = this.$route.hash.replace('#', '').replace(/^\/+/g, '').split('/')  
    return {
      page: hashParams[0],
      section: hashParams[1],
      subsection: hashParams[2]
    }
  },

  writeRouterHashPath: function(page, section, subsection){
    console.log('hash updated?', this.$route)
    this.$route.hash = `#/${page}/${section}/${subsection}`
    console.log('hash updated?', this.$route)
  },

  loadPageContent(which){
    const route = this.parseRouterHash()
    console.log(`route from ${which}`, route)
    if(route[which])
      this.setActive(this.navSlug, route[which])
    else 
      this.active = this.store.layout.getActive(this.navSlug)
  },

  relaysUpdate: function(){
    if(this.store.relays.isProcessing || !this.store.relays.areAggregatesSet ) {
      console.log('filtering relays at runtime')
      this.relays = this.store.relays.getAll
      this.filterRelaysMutate()
      this.sortRelaysMutate()
    } else {
      console.log('getting relays from cache')
      if(this.activePageItem == 'favorite')
        this.relays = this.sortRelays(this.store.relays.getFavorites)
      else
        this.relays = this.sortRelaysFavoritesOnTop(this.store.relays.getAggregate(this.activePageItem))
    }

    return this.relays
  },
  setRelayCount: function(){
    this.store.layout.getNavGroup('relays').forEach( item => {
      this.store.relays.setStat(item, this.relays.filter( (relay) => this.results?.[relay]?.aggregate == item))
    })
  },
  filterRelaysMutate: function(){
    if( 'favorite' == this.activePageItem )
      this.relays = this.getFavoriteRelays()
    if( 'public' == this.activePageItem )
      this.relays = this.getPublicRelays()
    if( 'restricted' == this.activePageItem )
      this.relays = this.getRestrictedRelays()
    if( 'offline' == this.activePageItem)
      this.relays = this.getOfflineRelays()
  },
  getAllRelays: function(){
    return this.store.relays.getAll
  },
  getFavoriteRelays: function(){
    return this.store.relays.getFavorites
  },
  getPublicRelays: function(){
    return this.relays.filter( (relay) => this.results?.[relay]?.aggregate == 'public')
  },
  getRestrictedRelays: function(){
    return this.relays.filter( (relay) => this.results?.[relay]?.aggregate == 'restricted')
  },
  getOfflineRelays: function(){
    return this.relays.filter( (relay) => this.results?.[relay]?.aggregate == 'offline')
  },
  getSortedAllRelays: function(){
    return this.sortRelays(this.getAllRelays())
  },
  getSortedFavoriteRelays: function(){
    return this.sortRelays(this.getFavoriteRelays())
  },
  getSortedPublicRelays: function(){
    return this.sortRelays(this.getPublicRelays())
  },
  getSortedRestrictedRelays: function(){
    return this.sortRelays(this.getRestrictedRelays())
  },
  getSortedOfflineRelays: function(){
    return this.sortRelays(this.getOfflineRelays())
  },
  sortRelays(relays){
    sort(relays, (relay1, relay2) => {
      return this.results?.[relay1]?.latency.final - this.results?.[relay2]?.latency.final
    })
    sort(relays, (relay1, relay2) => {
      let a = this.results?.[relay1]?.latency.final ,
          b = this.results?.[relay2]?.latency.final 
      return (b != null) - (a != null) || a - b;
    })
    sort(relays, (relay1, relay2) => {
      let x = this.results?.[relay1]?.check?.connect,
          y = this.results?.[relay2]?.check?.connect
      return (x === y)? 0 : x? -1 : 1;
    })
    relays = this.sortRelaysFavoritesOnTop(relays)
    return relays
  },
  sortRelaysFavoritesOnTop(relays){
    sort(relays, (relay1, relay2) => {
      let x = this.store.relays.isFavorite(relay1),
          y = this.store.relays.isFavorite(relay2)
      return (x === y)? 0 : x? -1 : 1;
    })
    return relays
  },
  sortRelaysMutate: function() {
    if (this.relays.length) {
      this.relays = this.sortRelays(this.relays)
        
        // .sort((relay1, relay2) => {
        //   let x = this.results?.[relay1]?.check?.read,
        //       y = this.results?.[relay2]?.check?.read
        //   return (x === y)? 0 : x? -1 : 1;
        // })
        // .sort((relay1, relay2) => {
        //   let x = this.results?.[relay1]?.check?.write,
        //       y = this.results?.[relay2]?.check?.write
        //   return (x === y)? 0 : x? -1 : 1;
        // });
      // return this.relays
    }

    return []
  },

    isExpired: function(){
      return !this.store.relays.lastUpdate 
              || Date.now() - this.store.relays.lastUpdate > this.store.prefs.duration
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

    cleanUrl: function(relay){
      return relay.replace('wss://', '')
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