import { defineStore } from 'pinia'
import { useUserStore } from '@/store/user'
// import { relays } from '../../relays.yaml'
// import { geo } from '../../relays.yaml'

export const useRelaysStore = defineStore('relays', {
  state: () => ({ 
    urls: new Array(),
    urlsOnline: new Array(),
    // results: new Object(),
    geo: new Object(),
    lastUpdate: null,
    count: new Object(),
    processing: false,
    favorites: new Array(),
    aggregates: {},
    aggregatesAreSet: false,
    cached: new Object(),
    canonicals: new Object(),
    filters: new Object(),
    dns: new Object()
  }),
  getters: {
    getAll: (state) => state.urls,
    getOnline: (state) => state.urlsOnline,
    getOffline: (state) => state.urls.filter( relay => !state.urlsOnline.includes(relay)),
    getShuffled: state => shuffle(state.urls),
    getShuffledPublic: state => {
      return state.aggregatesAreSet ? shuffle(state.aggregates.public) : shuffle(state.urls)
    },
    getRelays: (state) => (aggregate, results) => {
      if( 'all' == aggregate )
        return state.urls.map(x=>x)

      if( 'paid' == aggregate ){
        // console.log('paid!', state.urls.filter( (relay) => results?.[relay]?.info?.payments_url )?.length, state.urls.length )
        return state.urls.filter( (relay) => results?.[relay]?.info?.limitation?.payment_required )
      }

      if( 'online' == aggregate )
        return state.urls.filter( (relay) => results?.[relay]?.check?.connect )
      
      // if( 'nips' === aggregate)
      //   return state.urls.filter( (relay) => { 
      //     return  results?.[relay]?.info?.supported_nips  
      //             && Object.keys(results[relay].info.supported_nips).length 
      //             && results?.[relay]?.pubkeyValid
      //   })

      if( 'favorite' == aggregate )
        return state.favorites

      if(aggregate === 'public')
        return state.urls.filter( (relay) => results?.[relay]?.aggregate == 'public' && !results?.[relay]?.info?.limitation?.payment_required )
      else 
        return state.urls.filter( (relay) => results?.[relay]?.aggregate == aggregate)
    },
    
    getByNip: (state) => (nip, results) => {
      return state.urls.filter( relay => results?.[relay]?.info?.supported_nips?.includes(nip) )
    },

    getByAggregate: state => aggregate => {
      let results
      if(aggregate === 'public')
        results = state.urls.filter( (relay) => state.results?.[relay]?.aggregate == 'public' && !(state.results?.[relay]?.info?.payments_url instanceof String) )
      else 
        results = state.urls.filter( (relay) => state.results?.[relay]?.aggregate == aggregate)

      this.setAggregate(aggregate, results)
      return results
    },
    
    getGeo: state => relayUrl => state.geo[relayUrl],

    getLastUpdate: state => state.lastUpdate,

    getCount: state => type => state.count[type],
    getCounts: state => state.count,

    getAggregates: state => state.aggregates,
    getAggregate: state => which => state.aggregates[which],
    areAggregatesSet: state => state.aggregatesAreSet,

    getFavorites: state => state.favorites,
    isFavorite: state => relayUrl => state.favorites.includes(relayUrl),

    getAggregateCache: state => aggregate => state.cached[aggregate] instanceof Array ? state.cached[aggregate] : [],

    getCanonicals: state => state.canonicals,
    getCanonical: state => relay => state.canonicals[relay],
  },
  actions: {
    addRelay(relayUrl){ this.urls.push(relayUrl) },
    addRelays(relayUrls){ 
      const deduped = removeDuplicateHostnames( [...this.urls, ...relayUrls])
      let newRelays = []
      if(deduped.length > this.urls.length)
        newRelays = deduped.filter( relay => !this.urls.includes(relay) )
      this.urls = Array.from(new Set(deduped)) 
      return newRelays
    },
    setRelays(relayUrls){ this.urls = relayUrls },
    // setResult(result){ 
    //   // this.setStat('relays', this.)
    //   this.results[result.url] = result 
    // },
    // setResults(results){ this.results = results },
    // clearResults(){ this.results = {} },

    setGeo(geo){ this.geo = geo },

    setStat(type, value){ 
      this.count[type] = value 
    },

    setAggregate(aggregate, arr){ this.aggregates[aggregate] = arr },

    setAggregates(obj){ 
      this.aggregatesAreSet = true
      this.aggregates = obj 
    },
  
    setFavorite(relayUrl){ 
      if(this.favorites.includes(relayUrl))
        return
      this.favorites.push(relayUrl)
      this.favorites = this.favorites.map( x => x )
      
      const store = useUserStore()
      if(store.kind3[relayUrl] instanceof Object)
        return 
      store.kind3[relayUrl] = {
        read: false,
        write: false
      }
    },

    unsetFavorite(relayUrl){ 
      this.favorites = this.favorites.filter(item => item !== relayUrl)
      const store = useUserStore()
      delete store.kind3[relayUrl]
    },

    toggleFavorite(relayUrl){
      ////console.log('toggle favorite', relayUrl)
      if( this.isFavorite(relayUrl) )
        this.unsetFavorite(relayUrl)
      else 
        this.setFavorite(relayUrl)
      return this.isFavorite(relayUrl)
    },

    setAggregateCache(aggregate, array){
      if( !(this.cached[aggregate] instanceof Array) )
        this.cached[aggregate] = new Array()
      this.cached[aggregate] = array
    },

    setCanonicals(c){
      this.canonicals = c
    }
  },
})

function shuffle(array) {
  let currentIndex = array.length,  randomIndex;

  // While there remain elements to shuffle.
  while (currentIndex != 0) {

    // Pick a remaining element.
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;

    // And swap it with the current element.
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex], array[currentIndex]];
  }

  return array;
}


const removeDuplicateHostnames = function(array) {
  const hostnameMap = new Map();
  const result = [];
  
  for (const url of array) {
    const hostname = new URL(url).hostname;
    if (!hostnameMap.has(hostname)) {
      hostnameMap.set(hostname, true);
      result.push(url);
    }
  }
  
  return result;
}