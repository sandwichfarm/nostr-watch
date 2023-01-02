import { defineStore } from 'pinia'

export const useLayoutStore = defineStore('layout', {
  state: () => ({ 
    active: {},
    nav: {},
    mapExpanded: false,
    mapVisible: true,
  }),
  getters: {
    getActive: (state) => (section) => state.active[section],
    getNav: (state) => state.nav,
    getNavGroup: (state) => (group) => state.nav[group]
  },
  actions: {
    setNavItems(section, items){ this.nav[section] = items },
    setActive(section, slug){ this.active[section] = slug },
    toggleMapState(){ this.mapExpanded = !this.mapExpanded },
    toggleMapShow(){ this.mapVisible = !this.mapVisible }
  },
})