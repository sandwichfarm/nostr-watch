import { defineStore } from 'pinia'
import { RelayPool } from 'nostr'
import { useRelaysStore } from '@/store/relays'
import crypto from 'crypto'
// import { isJson } from '@/utils'

export const useUserStore = defineStore('user', {
  state: () => ({ 
    pubKey: "",
    events: [],
    profile: {},
    testEvent: false,
    kind3: new Object(),
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
  },
  actions: {
    retrieveKind3: async function() {
      return new Promise( (resolve) => {
        console.log('retrieveKind3 promise()', useRelaysStore())
        const subid = crypto.randomBytes(40).toString('hex')
        const store = useRelaysStore()
        const relays = store.getAggregateCache('public').length ? store.getAggregateCache('public') : ['wss://nostr.sandwich.farm']
        const pool = new RelayPool(relays)
        const ordered = []
        pool
          .on('open', r => {
            console.log('subscribing', subid)
            r.subscribe(subid, {
              limit: 1,
              kinds: [3],
              authors:[ this.pubKey ]
            })
          })
          .on('event', (relay, _subid, ev) => {
            if(_subid == subid){

              if(!ev.content.length)
                return
              console.log('the content', ev.content)
              try {
                ev.content = JSON.parse(ev.content)
              }
              catch(e){
                ev.content = {}
              }
              ordered.push(ev)
            }
            ordered.push(ev)
          })
          .on('error', (relay, err) => { 
            relay
            console.log('there was an error', err)
            // reject(err)
          })
        setTimeout( () => {
          ordered.sort( (a, b) => a.created_at - b.created_at )
          const result = ordered.length? ordered[0].content: false
          console.log('final', result)
          resolve(result)
          pool.close()
        },5000)
      })
    },
    setKind3: async function(obj) { 
      if(obj instanceof Object && Object.keys(obj).length)
        this.kind3 = obj
      else 
        this.kind3 = await this.retrieveKind3()
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