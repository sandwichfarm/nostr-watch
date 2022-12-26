import { defineStore } from 'pinia'
import { useResultsStore } from './results.js'
import { userGeoStore } from './geo.js'

export const useRelayStore = defineStore('counter', {
  state: () => ({ 
    relays: []
  }),
  getters: {
    getRelayResult: (state) => {
      return (relay_url) => state.results[relay_url]
    },
    getRelaysByAvailability: (state) => {
      return (type) => { 
        for(const result in results) {
          
        }
      }
    },
    getRelayByAvailability
  },
  actions: {
    increment() {
      this.count++
    },
  },
})