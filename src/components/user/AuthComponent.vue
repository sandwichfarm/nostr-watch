<template>
  <a 
    class="text-sm text-white hover:text-white" 
    v-if="signer && !isLoggedIn() && this.store.relays.getFavorites.length && this.store.jobs.isIdle" 
    @click="authenticateAction" 
    href="#">
      Login
  </a>
</template>

<script>
import { defineComponent } from 'vue'
import { useRoute } from 'vue-router'
import UserMethods from '@/shared/user-lib.js'
import RelayMethods from '@/shared/relays-lib.js'
import { setupStore } from '@/store'

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
    this.showLogin()
    if(!this.isLoggedIn())
      return 
    await this.getUserProfileAndTestEvent(this.store.relays.getFavorites, this.store.user.getPublicKey)
  },
  updated(){
  },
  computed: {},
  methods: Object.assign(UserMethods, RelayMethods, {
    authenticateAction: async function(){
      await this.authenticate()
      if(this.store.user.getPublicKey)
        this.getUserData()
    },
    showLogin: async function(){
      await new Promise( (resolve) => {
        setTimeout( () => {
          if(window.nostr instanceof Object)
            resolve(this.signer = true)
          else 
            resolve()
        }, 1001)
      })
    }
  }),
  props: {},
})
</script>

<style>
</style>