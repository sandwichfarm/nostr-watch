import { defineStore } from 'pinia'

export const useStatStore = defineStore(
  'stats', 
  {
    state: () => ({ 
      history: [],
      software: {},
      nips: {},
      countries: {},
      continents: {},
      oldestRelayStillOnline: null,
      newestRelayOnline: null,
      heartbeats: {},
    }),
    getters: {
      getHistory: (state) => state.history,
      getBySoftware: (state) => state.software,
      getByNip: (state) => state.nips,
      getByCountry: (state) => state.countries,
      getByContinent: (state) => state.continents,
      getHeartbeat: state => relay => state.heartbeats[relay],
      get: (state) => (which) => state[which],
    },
    actions: {
      setHistory(payload){ 
        this.history = payload 
      },
      set(type, payload){ 
        Object.keys(payload).forEach( key => this[type][key] = Array.from(payload[key] ) )
      },
      setHeartbeats(payload){
        this.heartbeats = payload
      },
    },
  },
  // {
  //   persistedState: {
  //     excludePaths: ['heartbeats']
  //   }
  // }
)