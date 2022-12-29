import { defineStore } from 'pinia'

export const useRelaysStore = defineStore('relays', {
  state: () => ({ 
    urls: new Array(),
    results: new Object(),
    geo: new Object(),
    lastUpdate: null,
    count: {}
  }),
  getters: {
    getAll: (state) => state.urls.map((x)=>x), //clone it
    getByAggregate: (state) => (aggregate) => {
      return state.urls
              .filter( (relay) => state.results?.[relay]?.aggregate == aggregate)
              .map((x)=>x) //clone it
    },

    getResults: (state) => state.results,
    getResult: (state) => (relayUrl) => state.results?.[relayUrl],
    
    getGeo: (state) => (relayUrl) => state.geo[relayUrl],

    getLastUpdate: (state) => state.lastUpdate,

    getCount: (state) => (type) => state.count[type],
    getCounts: (state) => state.count
  },
  actions: {
    addRelay(relayUrl){ this.urls.push(relayUrl) },
    addRelays(relayUrls){ this.urls = Array.from(new Set(this.urls.concat(this.urls, relayUrls))) },
    setRelays(relayUrls){ this.urls = relayUrls },

    setResult(result){ this.results[result.uri] = result },
    setResults(results){ this.results = results },
    clearResults(){ this.results = {} },

    setGeo(geo){ this.geo = geo },

    updateNow(){ this.lastUpdate = Date.now() },

    setStat(type, value){ 
      this.count[type] = value 
    }
  },
})