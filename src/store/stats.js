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
  },
  actions: {
  },
})