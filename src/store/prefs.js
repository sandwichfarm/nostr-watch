import { defineStore } from 'pinia'

export const usePrefsStore = defineStore('prefs', {
  state: () => ({ 
    firstVisit: true,
    refresh: true,
    duration: 6*60*60*1000,
    pinFavorites: true,
    rowTheme: 'comfortable',
    filters: [],
    filterFn: [],
    useKind3: true,
    clientSideProcessing: false,
    clientSideProcessingUpgrade: false,
    latencyFast: 200,
    latencySlow: 1000,
    sortUptime: true,
    sortLatency: true, 
    autoDetectRegion: true,
    region: 'eu-west',
    ignoreTopics: 'canonical,nostr',
    showMaps: true,
    discoverRelays: true,
    checkNip11: true,
    CheckNip11Frequency: 24*60*60*1000,
    disableGeoDetection: false
  }),
  getters: {
    get: state => key => state?.[key],
    isFirstVisit: state => state.firstVisit,
    doRefresh: (state) => state.refresh,
    expireAfter: (state) => state.duration,
    doPinFavorites: (state) => state.pinFavorites,
    getTheme: (state) => state.rowTheme,
    getFilters: (state) => state.filterFn,
  },
  actions: {
    setClientSideProcessing(value){
      this.clientSideProcessing = value
      this.clientSideProcessingUser = value
    },
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
      //console.log('functions:', this.filterFn)
    }
  },
  persistedState: {},
})