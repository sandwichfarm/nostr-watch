<template>
<div class="inline">
    <div class="inline text-left">
      <button 
        ref="btnRef" 
        type="button" 
        v-on:click="updateNip23()" 
        class="items-start cursor-pointer inline-flex items-center rounded border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2">
            Sync with Nostr
        </button>
      <!-- <div  ref="popoverRef" 
            v-bind:class="{'hidden': !popoverShow, 'block': popoverShow}" 
            class="bg-pink-600 border-0 mr-3 z-50 font-normal leading-normal text-sm max-w-xs text-left no-underline break-words rounded-lg
            ">
        <div>
          <div class="bg-pink-600 text-white opacity-75 font-semibold p-3 mb-0 border-b border-solid border-slate-100 uppercase rounded-t-lg">
            Coming soon
          </div>
          <div class="text-white p-3">
            This feature depends on the finalization of 
            <a href="https://github.com/nostr-protocol/nips/pull/32" target="_blank">NIP-23 [link]</a>,
            if you actively develop a nostr client, please provide input on the NIP to help make the 
            implementation of user relay lists easier for everyone.
          </div>
        </div>
      </div> -->
    </div>
  </div>
</template>
<script>
import { toRefs } from "vue"
import { createPopper } from "@popperjs/core";
import { validateEvent, verifySignature, getEventHash } from 'nostr-tools'
import safeStringify from 'fast-safe-stringify'

import { setupStore } from '@/store'

export default {
  name: "NostrSyncPopoverNag",
  setup(props){
    const {favoritesProp: favorites} = toRefs(props)
    return { 
      store : setupStore(),
      favorites: favorites,
    }
  },
  data() {
    return {
      popoverShow: false
    }
  },
  async mounted(){
    this.setFavoritesAsNip23()
    await this.getNip23()
    console.log('nip23', this.store.relays.getNip23)
    this.store.relays.$subscribe( mutation => {
      console.log(mutation.events)
    })
  },  
  methods: {
    setFavoritesAsNip23: function(){
      // const nip23 = {}
      // this.store.relays.getFavorites.forEach( relay => {
      //   nip23[relay] = {}
      //   nip23[relay].read = true
      //   nip23[relay].write = true
      // })
      // this.store.relays.setNip23(nip23)
      return true
    },  
    getNip23: async function(){
      return new Promise( resolve => {
        const subid = `kind1001-${this.store.user.getPublicKey}`
        const filters = { limit:1, kinds:[10001], authors: [this.store.user.getPublicKey] }
        console.log(filters) 
        this.$pool
          .subscribe(subid, filters)
        this.$pool
          .on('event', (relay, sub_id, event) => {
            console.log(event)
            if(sub_id !== subid)
              return 
            this.$pool.unsubscribe(subid)
            const parsed = this.parseNip23(event)
            // this.updateFavorites(parsed)
            this.persistNip23(parsed)
            console.log(event)
            resolve()
          })
        setTimeout( () => resolve(), 2000 ) 
      })
    },
    updateNip23: async function(){
      await this.getNip32
      const currentNip23 = this.store.relays.getNip23
      const event = {
        kind: 10001,
        created_at: Math.floor(Date.now()/1000),
        content: safeStringify(currentNip23),
        tags: [],
        pubkey: this.store.user.getPublicKey
      }
      console.log(event)
      event.id = getEventHash(event)
      console.log(event)
      const signedEvent = await window.nostr.signEvent(event)

      let ok = validateEvent(signedEvent)
      let veryOk = await verifySignature(signedEvent)

      if(!ok || !veryOk)
        return

      this.$pool.send(['EVENT', signedEvent])
    },
    parseNip23: function(event){
      return JSON.parse(event.content)
    },
    updateFavorites: function(relays){
      Object.keys(relays).forEach( relayUrl => {
        this.store.relays.setFavorite(relayUrl)
      })
    }, 
    persistNip23: function(relays){
      this.store.relays.setNip23(relays)
    },
    togglePopover: function(){
      if(this.popoverShow){
        this.popoverShow = false;
      } else {
        this.popoverShow = true;
        createPopper(this.$refs.btnRef, this.$refs.popoverRef, {
          placement: "left"
        });
      }
    }
  }
}
</script>