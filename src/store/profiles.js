import { defineStore } from 'pinia'

export const useProfileStore = defineStore(
  'profiles', 
  {
    state: () => ({
      data: new Object()
    }),
    getters: {
      getProfiles: (state) => state.data,
      
      hasProfile: state => pubkey => typeof state.data[pubkey] !== 'undefined',
      hasLud06: state => pubkey => typeof state.data[pubkey] !== 'undefined' && typeof state.data[pubkey].lud06 !== 'undefined',
      getProfile: state => pubkey => state.data[pubkey],
      getLud06: state => pubkey => state.data[pubkey]?.lud06,
      getPicture: state => pubkey => state.data[pubkey]?.picture,
      getName: state => pubkey => state.data[pubkey]?.name,
      getNip05: state => pubkey => state.data[pubkey]?.nip05,
    },
    actions: {
      setProfile(pubkey, profile){ 
        console.log('setting ', pubkey, profile)
        if( !(this.data[pubkey] instanceof Object) )
          this.data[pubkey] = new Object()
        Object.keys(profile).forEach( key => {
          // if( !(profile[key] instanceof String) )
          //   return 
          console.log('setting profile', key, profile[key])
          this.data[pubkey][key] = profile[key]
        })
      },
    },
  }
)