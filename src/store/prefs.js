import { defineStore } from 'pinia'

export const usePrefsStore = defineStore('prefs', {
  state: () => ({ 
    refresh: true,
    duration: 30*60*1000,
    pinFavorites: true
  }),
  getters: {
    doRefresh: (state) => state.refresh,
    expireAfter: (state) => state.duration,
    doPinFavorites: (state) => state.pinFavorites,
  },
  actions: {
    enable(){ this.refresh = true },
    disable(){ this.refresh = false },
    toggleRefresh(){ this.refresh = !this.refresh },
    updateExpiration(dur) { this.duration = dur },
    togglePinFavorites(){ this.pinFavorites = !this.pinFavorites },
  },
})