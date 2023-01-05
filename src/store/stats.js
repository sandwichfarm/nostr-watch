import { defineStore } from 'pinia'

export const useStatStore = defineStore('stats', {
  state: () => ({ 
    history: [],
    software: {},
    nips: {},
    countries: {},
    continents: {},
    oldestRelayStillOnline: null,
    newestRelayOnline: null,
  }),
  getters: {
    getHistory: (state) => state.history,
    getBySoftware: (state) => state.software,
    getByNip: (state) => state.nips,
    getByCountry: (state) => state.countries,
    getByContinent: (state) => state.continents,

    get: (state) => (which) => state[which]
  },
  actions: {
    setHistory(payload){ 
      this.history = payload 
    },
    set(type, payload){ 
      Object.keys(payload).forEach( key => this[type][key] = Array.from(payload[key] ) )
    },
  },
})