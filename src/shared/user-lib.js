import { RelayPool } from 'nostr'
import { subscribeKind3, subscribeKind10002 } from '@/utils'
import crypto from 'crypto'

export default {
  isLoggedIn: function(){
    return this.store.user.getPublicKey ? true : false
  },
  signOut: function(){
    this.store.user.$reset()
  },
  authenticate: async function(){
    const pubkey = await window.nostr.getPublicKey()
    this.store.user.setPublicKey(pubkey)
    const relays = this.store.relays.getFavorites
    if(!relays?.length)
      return
    await this.getUserProfileAndTestEvent(relays)
    await this.getContactList(relays, this.store.user.getPublicKey)
    await this.getRelayList(relays, this.store.user.getPublicKey)
    this.setUserFavoritesFromContactList()
  },
  getUserProfileAndTestEvent: function(relays){
    const pool = new RelayPool(relays, { reconnect: false })
    return new Promise( resolve => {
      const subid = crypto.randomBytes(40).toString('hex'),
            filterProfile = { limit: 1, kinds:[0], authors: [this.store.user.getPublicKey ] },
            filterEvent = { limit: 1, kinds:[1], authors: [this.store.user.getPublicKey ] }

      let foundProfile,
          foundEvent 

      pool
        .on('open', $relay => {
          $relay.subscribe(`${subid}_profile`, filterProfile)
          $relay.subscribe(`${subid}_event`, filterEvent)
        })
        .on('event', ($relay, sub_id, event) => {
          if(`${subid}_profile` === sub_id && !foundProfile) {
            this.store.user.setProfile(event.content)
            pool.unsubscribe(sub_id)
            foundProfile = true
          }
          if(`${subid}_event` === sub_id && !foundEvent) {
            this.store.user.setTestEvent(event)
            pool.unsubscribe(sub_id)
            foundEvent = true
          }
          if(!foundProfile || !foundEvent)
            return 
          resolve()
        })
    })
  },
  addUserContactListJob: async function(slug){
    const relays = this.store.relays.getFavorites
    if(!slug)
      slug = 'user/list/contacts'
    if(!relays?.length)
      return
    if(!this.isLoggedIn)
      return 
    this.queueJob(
      slug,
      async () => {
        this.store.user.kind3Event = await this.getContactList(relays, this.store.user.getPublicKey)
        console.log('kind3', this.store.user.kind3Event)
        this.store.user.kind3 = this.store.user.kind3Event.content
        this.addRelaysFromContactList()
        this.addExistingFavoritesToContactList()
        this.setUserFavoritesFromContactList()
        this.store.jobs.completeJob(slug)
      },
      true
    )
  },
  getContactList: async function(relays, pubkey, slug){
    if(!slug)
      slug = 'user/list/contacts'
    return subscribeKind3(relays, pubkey).catch( err => {
      console.error('error!', err)
      this.store.jobs.completeJob(slug)
    })
  },
  addRelaysFromContactList: function(){
    this.store.relays.addRelays(Object.keys(this.store.user.kind3))
  },
  
  addExistingFavoritesToContactList: function(){
    this.store.relays.getFavorites.forEach( relay => {
      if(this.store.user?.kind3?.[relay])
        return 
      this.store.user.kind3[relay] = { read: false, write: false }
    })
  },
  setUserFavoritesFromContactList: function(){
    Object.keys(this.store.user.kind3).forEach( key => {
      this.store.relays.setFavorite(key)
    })
  },

  addUserRelayListJob: async function(slug){
    const relays = this.store.relays.getFavorites
    if(!slug)
      slug = 'user/list/relays'
    if(!relays?.length)
      return
    if(!this.isLoggedIn)
      return 
    this.queueJob(
      slug,
      async () => {
        this.store.user.kind10002Event = await this.getRelayList(relays, this.store.user.getPublicKey)
        this.store.user.kind10002 = this.store.user.kind3Event.tags.filter( tag => tag[0] === 'r')
        console.log('kind10002', this.store.user.kind10002)
        this.addRelaysFromRelayList()
        this.addExistingFavoritesToRelayList()
        this.setUserFavoritesFromRelayList()
        this.store.jobs.completeJob(slug)
      },
      true
    )
  },
  getRelayList: async function(relays, pubkey, slug){
    if(!slug)
      slug = 'user/list/relays'
    return subscribeKind10002(relays, pubkey).catch( err => {
      console.error('error!', err)
      this.store.jobs.completeJob(slug)
    })
  },

  addRelaysFromRelayList: function(){
    this.store.relays.addRelays(Object.keys(this.store.user.kind10002))
  },
  addExistingFavoritesToRelayList: function(){
    this.store.relays.getFavorites.forEach( relay => {
      if(this.store.user?.kind10002?.[relay])
        return 
      this.store.user.kind10002.push(['r', relay])
    })
  },
  setUserFavoritesFromRelayList: function(){
    this.store.user.kind10002.forEach( relayTag => {
      this.store.relays.setFavorite(relayTag[1])
    })
  },
}