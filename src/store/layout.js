import { defineStore } from 'pinia'

export const useLayoutStore = defineStore('layout', {
  state: () => ({ 
    active: {},
    mapExpanded: false,
    mapVisible: true
  }),
  getters: {
    getActive: (state) => (page) => state.active[page]
  },
  actions: {
    setActive(page, tab){ this.active[page] = tab },
    toggleMapState(){ this.mapExpanded = !this.mapExpanded },
    toggleMapShow(){ this.mapVisible = !this.mapVisible }
  },
})