import { defineStore } from 'pinia'

export const useProfileStore = defineStore('profiles', {
  state: () => ({ 
    name:     new String(),
    about:    new String(),
    picture:  new String(),
    nip05:    new String(),
    lud06:    new String(),
  }),
  getters: {},
  actions: {
    setProfile(profile){ 
      Object.keys(profile).forEach( key => {
        if( !(profile[key] instanceof String) )
          return 
        if( !(this[key] instanceof String) )
          return
        this[key] = profile[key]
      })
    },
  },
})