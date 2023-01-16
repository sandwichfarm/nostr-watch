import { defineStore } from 'pinia'

export const usePrefsStore = defineStore('prefs', {
  state: () => ({ 
    refresh: true,
    duration: 30*60*1000,
    pinFavorites: true,
    rowTheme: 'comfortable',
    filters: [],
    filterFn: [],
    useKind3: true
  }),
  getters: {
    doRefresh: (state) => state.refresh,
    expireAfter: (state) => state.duration,
    doPinFavorites: (state) => state.pinFavorites,
    getTheme: (state) => state.rowTheme,
    getFilters: (state) => state.filterFn,
  },
  actions: {
    enable(){ this.refresh = true },
    disable(){ this.refresh = false },
    toggleRefresh(){ this.refresh = !this.refresh },
    updateExpiration(dur) { this.duration = dur },
    togglePinFavorites(){ 
      this.pinFavorites = !this.pinFavorites 
    },
    setRowTheme(theme){ this.rowTheme = theme },
    addFilter(key, fn){ 
      if(this.filters.includes(key))
        return 
      this.filters.push(key)
      this.filterFn.push(fn) 
      console.log('functions:', this.filterFn)
    }
  },
},
{
  persistedState: {
    // excludePathts: ['activeFilters']
    includePaths: ['refresh', 'duration', 'pinFavorites', 'rowTheme', 'filters']
    // store options goes here
  },
})