import { defineStore } from 'pinia'

export const useUserStore = defineStore('user', {
  state: () => ({ 
    pubKey: "",
    events: []
  }),
  getters: {
    getPublicKey: (state) => state.pubKey
  },
  actions: {
    setPublicKey: function(pubKey){ this.pubKey = pubKey }
  },
})