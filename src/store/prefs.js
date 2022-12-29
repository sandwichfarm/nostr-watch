import { defineStore } from 'pinia'

export const usePrefsStore = defineStore('prefs', {
  state: () => ({ 
    refresh: true,
    duration: 30*60*1000,
  }),
  getters: {
    doRefresh: (state) => state.refresh,
    expireAfter: (state) => state.duration,
  },
  actions: {
    enable(){ this.refresh = true },
    disable(){ this.refresh = false },
    toggleRefresh(){ this.refresh = !this.refresh },
    updateExpiration(dur) { this.duration = dur },
  },
})