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
      addHeartbeat(relay, payload){
        if( !(this.heartbeats[relay] instanceof Array) )
          this.heartbeats[relay] = new Array()
        this.heartbeats[relay] = payload
      },
      addHeartbeats(payload){
        const relaysNow = Object.keys(payload) 

        // if(relaysThen.length !== relaysNow.length) {
        //   if(relaysNow.length > relaysThen.length ) {
        //     relaysNow.forEach(relay => {
        //       if(this.heartbeats[relay] instanceof Array)
        //         return 
        //       this.heartbeats[relay] = new Array()
        //     })
        //   }
        // }
        console.log(this.heartbeats)

        relaysNow.forEach(relay => {
          if( !(this.heartbeats[relay] instanceof Array) )
            this.heartbeats[relay] = new Array()
          this.heartbeats[relay] = this.heartbeats[relay].concat(payload[relay])
          this.heartbeats[relay].sort((h1, h2) => h1.date - h2.date )
          if(this.heartbeats[relay].length <= 48) 
            return 
          const delta = this.heartbeats.length - 48
          this.heartbeats = this.heartbeats.splice(0, delta);
        })

        console.log('new heartbeats', this.heartbeats)
      }
        
    },
  },
  // {
  //   persistedState: {
  //     excludePaths: ['heartbeats']
  //   }
  // }
)