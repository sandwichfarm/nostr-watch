import { defineStore } from 'pinia'

export const useUserStore = defineStore('user', {
  state: () => ({ 
    pubKey: "",
    events: [],
    profile: {},
    testEvent: false,
    likes: {}
  }),
  getters: {
    getPublicKey: (state) => state.pubKey,
    getProfile: (state) => state.profile,
    getName: (state) => state.profile.name,
    getPicture: (state) => state.profile.picture,
    getNip05: (state) => state.profile.nip05,
    isProfile: (state) => Object.keys(state.profile).length ? true : false,
    getTestEvent: (state) => state.testEvent,

    getLikes: state => state.likes,
    isLiked: state => relay => state.likes[relay]
  },
  actions: {
    unlike: function(relay){ this.likes[relay] = false },
    like: function(relay){ this.likes[relay] = true },
    setPublicKey: function(pubKey){ this.pubKey = pubKey },
    setProfile: function(stringifiedEvContent){ 
      this.profile = JSON.parse(stringifiedEvContent)
    },
    setTestEvent: function(event){
      this.testEvent = event
    },
  },

})