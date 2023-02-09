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
      pulses: {},
    }),
    getters: {
      getHistory: (state) => state.history,
      getBySoftware: (state) => state.software,
      getByNip: (state) => state.nips,
      getByCountry: (state) => state.countries,
      getByContinent: (state) => state.continents,
      getHeartbeat: state => relay => state.pulses[relay],
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
        this.pulses = payload
      },
      addHeartbeat(relay, payload){
        if( !(this.pulses[relay] instanceof Array) )
          this.pulses[relay] = new Array()
        this.pulses[relay] = payload
      },
      addHeartbeats(payload){
        const relaysNow = Object.keys(payload) 

        // if(relaysThen.length !== relaysNow.length) {
        //   if(relaysNow.length > relaysThen.length ) {
        //     relaysNow.forEach(relay => {
        //       if(this.pulses[relay] instanceof Array)
        //         return 
        //       this.pulses[relay] = new Array()
        //     })
        //   }
        // }
        //console.log(this.pulses)

        relaysNow.forEach(relay => {
          if( !(this.pulses[relay] instanceof Array) )
            this.pulses[relay] = new Array()
          this.pulses[relay] = this.pulses[relay].concat(payload[relay])
          this.pulses[relay].sort((h1, h2) => h1.date - h2.date )
          if(this.pulses[relay].length <= 48) 
            return 
          const delta = this.pulses.length - 48
          this.pulses = this.pulses.splice(0, delta);
        })

        //console.log('new pulses', this.pulses)
      },
      persistedState: {
        excludePaths: ['nips', 'software', 'countries', 'continents']
      },
      share: {
        // An array of fields that the plugin will ignore.
        omit: ['nips', 'software', 'countries', 'continents'],
        // Override global config for this store.
        enable: true,
      },
    }
  },
  
)