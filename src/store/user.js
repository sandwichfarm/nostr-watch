import { defineStore } from 'pinia'

import { useRelaysStore } from '@/store/relays'
import { subscribeKind3 } from '@/utils'
// import { isJson } from '@/utils'

export const useUserStore = defineStore('user', {
  state: () => ({ 
    pubKey:           "",
    events:           [],
    profile:          {},
    testEvent:        false,
    kind3:            new Object(),
    kind3Event:       new Object(),
    kind30001:        new Object(),
    kind30001Event:   new Object(),
    ip:               null,
  }),
  getters: {
    getPublicKey: (state) => state.pubKey,
    getProfile: (state) => state.profile,
    getName: (state) => state.profile.name,
    getPicture: (state) => state.profile.picture,
    getNip05: (state) => state.profile.nip05,
    isProfile: (state) => Object.keys(state.profile).length ? true : false,
    getTestEvent: (state) => state.testEvent,
    getKind3: (state) => state.kind3,
    getKind3Event: (state) => state.kind3Event,
    getKind30001: state => state.kind30001,
    getKind30001Event: state => state.kind30001Event,
  },
  actions: {
    retrieveKind3: async function() {
      const store = useRelaysStore()
      const relays = store.getFavorites.length ? store.getFavorites : ['wss://nostr.sandwich.farm']
      this.kind3Event = await subscribeKind3(this.pubKey, relays)
      // console.log('kind3', this.kind3Event)
      return this.kind3Event?.content || {}
    },
    setKind3: async function(obj) { 
      if(obj instanceof Object && Object.keys(obj).length)
        this.kind3 = obj
      else 
        this.kind3 = Object.assign(this.kind3, await this.retrieveKind3())
    },
    setPublicKey: function(pubKey){ this.pubKey = pubKey },
    setProfile: function(stringifiedEvContent){ 
      this.profile = JSON.parse(stringifiedEvContent)
    },
    setTestEvent: function(event){
      this.testEvent = event
    },
  },

})