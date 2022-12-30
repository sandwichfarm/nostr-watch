import { defineStore } from 'pinia'

export const useLayoutStore = defineStore('layout', {
  state: () => ({ 
    active: {},
    sidebar: {},
    mapExpanded: false,
    mapVisible: true
  }),
  getters: {
    getActive: (state) => (page) => state.active[page],
    getSidebar: (state) => state.sidebar,
    getSidebarGroup: (state) => (group) => state.sidebar[group]
  },
  actions: {
    setSidebarItems(items){ 
      const groups = new Set(items.map( item => item.group ))
      groups.forEach(group => this.sidebar[group] = [])
      items.forEach( (item) => {
        this.sidebar[item.group].push(item)
      })
    },
    setActive(page, tab){ this.active[page] = tab },
    toggleMapState(){ this.mapExpanded = !this.mapExpanded },
    toggleMapShow(){ this.mapVisible = !this.mapVisible }
  },
})