import { defineStore } from 'pinia'

export const useRelaysStore = defineStore('relays', {
  state: () => ({ 
    urls: new Array(),
    // results: new Object(),
    geo: new Object(),
    lastUpdate: null,
    count: new Object(),
    processing: false,
    processedRelays: new Set(),
    favorites: new Array(),
    aggregates: {},
    aggregatesAreSet: false
  }),
  getters: {
    getAll: (state) => state.urls,
    getRelays: (state) => (aggregate, results) => {
      if( 'all' == aggregate )
        return state.urls.map(x=>x)
      if( 'favorite' == aggregate )
        return state.favorites
      return state.urls.filter( (relay) => results?.[relay]?.aggregate == aggregate)
    },
    getByAggregate: (state) => (aggregate) => {
      return state.urls
              .filter( (relay) => state.results?.[relay]?.aggregate == aggregate)
    },

    // getResults: (state) => state.results,
    // getResult: (state) => (relayUrl) => state.results?.[relayUrl],
    
    getGeo: (state) => (relayUrl) => state.geo[relayUrl],

    getLastUpdate: (state) => state.lastUpdate,

    getCount: (state) => (type) => state.count[type],
    getCounts: (state) => state.count,

    getAggregate: (state) => (which) => state.aggregates[which],
    areAggregatesSet: (state) => state.aggregatesAreSet,

    getProcessedRelays: (state) => Array.from(state.processedRelays),
    isProcessing: (state) => state.processing,

    getFavorites: (state) => state.favorites,
    isFavorite: (state) => (relayUrl) => state.favorites.includes(relayUrl)
  },
  actions: {
    addRelay(relayUrl){ this.urls.push(relayUrl) },
    addRelays(relayUrls){ this.urls = Array.from(new Set(this.urls.concat(this.urls, relayUrls))) },
    setRelays(relayUrls){ this.urls = relayUrls },

    // setResult(result){ 
    //   // this.setStat('relays', this.)
    //   this.results[result.uri] = result 
    // },
    // setResults(results){ this.results = results },
    // clearResults(){ this.results = {} },

    setGeo(geo){ this.geo = geo },

    updateNow(){ this.lastUpdate = Date.now() },

    setStat(type, value){ 
      this.count[type] = value 
    },

    setAggregate(aggregate, arr){ this.aggregates[aggregate] = arr },
    setAggregates(obj){ 
      this.aggregatesAreSet = true
      this.aggregates = obj 
    },
    
    addProcessedRelay(relay){
      //console.log(`this.processedRelays is set`, this.processedRelays instanceof Set)
      this.processedRelays.add(relay) 
    },
    finishProcessing() { this.processing = false },
    startProcessing() { this.processing = true },
    completeProcessing() { 
      //console.log('setting as complete')
      this.processedRelays = []
      this.finishProcessing()
    },

    setFavorite(relayUrl){ 
      this.favorites.push(relayUrl)
      this.favorites = this.favorites.map( x => x )
    },

    unsetFavorite(relayUrl){ 
      this.favorites = this.favorites.filter(item => item !== relayUrl)
    },

    toggleFavorite(relayUrl){
      //console.log('toggle favorite', relayUrl)
      if( this.isFavorite(relayUrl) )
        this.unsetFavorite(relayUrl)
      else 
        this.setFavorite(relayUrl)
      return this.isFavorite(relayUrl)
    },
  },
})