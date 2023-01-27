import { defineStore } from 'pinia'

export const useLayoutStore = defineStore(
  'layout', 
  {
    state: () => ({ 
      mapExpanded: false,
      editorExpanded: false,
      active: {},
      nav: {},
      activeTab: null,
    }),
    getters: {
      getActiveTab: (state) => state.activeTab,
      getActive: (state) => (section) => state.active[section],
      getActiveItem: (state) => (section) => state.nav[section]?.filter( item => item.slug == state.active[section])[0],
      getNav: (state) => state.nav,
      getNavGroup: (state) => (group) => state.nav[group],
      mapIsExpanded: (state) => state.mapExpanded,
      editorIsExpanded: state => state.editorExpanded,
    },
    actions: {
      deactivateTab(tabId){
        if(this.activeTab === tabId) 
          this.activeTab = null
      },
      setActiveTab(tabId){ this.activeTab = tabId },
      setNavItems(section, items){ this.nav[section] = items },
      setActive(section, slug){ this.active[section] = slug },
      toggleMap(){ this.mapExpanded = !this.mapExpanded },
      toggleEditor(){ this.editorExpanded = !this.editorExpanded },
      editorOff(){ this.editorExpanded = false }
    },
    share: {
      // An array of fields that the plugin will ignore.
      omit: ['mapExpanded', 'editorExpanded', 'activeTab', 'active'],
      // Override global config for this store.
      enable: true,
    },
  }
)