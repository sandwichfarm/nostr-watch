<template>
  <a class="text-sm text-white hover:text-white" v-if="signer && !isLoggedIn() && this.store.relays.getFavorites.length && this.store.jobs.isIdle" @click="auth" href="#">Login</a>
</template>

<script>
import { defineComponent } from 'vue'
import { useRoute } from 'vue-router'
import UserLib from '@/shared/user-lib.js'
import { setupStore } from '@/store'
import crypto from 'crypto'
import { RelayPool } from 'nostr'

// import { validateEvent, verifySignature, getEventHash } from 'nostr-tools'
export default defineComponent({
  name: 'AuthComponent',
  components: {},
  setup(){
    return { 
      store : setupStore()
    }
  },
  data() {
    return {
      route: useRoute(),
      token : null,
      user: {},
      signer: false,
      pool: null
    }
  },
  async mounted(){
    this.showAuth()
    if(this.isLoggedIn())
      await this.getData()
  },
  updated(){
  },
  computed: {},
  methods: Object.assign(UserLib, {
    showAuth: async function(){
      await new Promise( (resolve) => {
        setTimeout( () => {
          if(window.nostr instanceof Object)
            resolve(this.signer = true)
          else 
            resolve()
        }, 1001)
      })
    },
    auth: async function(){
      const pubkey = await window.nostr.getPublicKey()
      this.store.user.setPublicKey(pubkey)
      await this.getData()
      this.queueKind3('user/list/contacts')
    },
    getData: function(){
      const pool = new RelayPool([...this.store.relays.getFavorites], { reconnect: false })
      return new Promise( resolve => {
        const subid = crypto.randomBytes(40).toString('hex')
        const filterProfile = { limit: 1, kinds:[0], authors: [this.store.user.getPublicKey ] }
        const filterEvent = { limit: 1, kinds:[1], authors: [this.store.user.getPublicKey ] }
        let foundProfile = false,
            foundEvent = false 
        pool
          .on('open', Relay => {
            Relay.subscribe(`${subid}_profile`, filterProfile)
            Relay.subscribe(`${subid}_event`, filterEvent)
          })
        pool 
          .on('event', (relay, sub_id, event) => {
            if(`${subid}_profile` == sub_id && !foundProfile) {
              this.store.user.setProfile(event.content)
              pool.unsubscribe(sub_id)
              foundProfile = true
            }
            if(`${subid}_event` == sub_id && !foundEvent) {
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
  }),
  props: {},
})
</script>

<style>
</style>