<template>
  <a class="text-sm text-white hover:text-white" v-if="signer && !isLoggedIn()" @click="auth" href="#">Login</a>
</template>

<script>
import { defineComponent } from 'vue'
import { useRoute } from 'vue-router'
import UserLib from '@/shared/user-lib.js'
import { setupStore } from '@/store'


// import { validateEvent, verifySignature, getEventHash } from 'nostr-tools'
export default defineComponent({
  name: 'AlbyComponent',
  components: {},
  setup(){
    return { 
      store : setupStore()
    }
  },
  data() {
    return {
      authorizeEndpoint: "https://app.regtest.getalby.com/oauth",
      tokenEndpoint: "https://api.regtest.getalby.com/oauth/token",
      route: useRoute(),
      clientId: "test_client",
      clientSecret: "test_secret",
      scopes: "account:read",
      token : null,
      user: {},
      signer: false,
    }
  },
  mounted(){
    console.log('store?', this.store.user)
    this.showAuth()
    console.log('is logged in', this.isLoggedIn())
  },
  updated(){
    this.showAuth()
  },
  computed: {},
  methods: Object.assign(UserLib, {
    showAuth: async function(){
      await new Promise( (resolve) => {
        setTimeout( () => {
          if(window.nostr instanceof Object)
            if(!this.isLoggedIn())
              resolve(this.signer = true)
            else 
              resolve()
          else            
            resolve()  
        }, 1001)
      })
      console.log('signer enabled', this.signer)
    },
    watch: function(){
    },
    auth: async function(){
      // console.log('pukey', this.user.pubkey)
      this.store.user.setPublicKey(await window.nostr.getPublicKey())
      // console.log('relays', await window.nostr.getRelays().catch(err => console.warn(err)))

      // console.log(window.nostr)

      // const event = {
      //   tags: [],
      //   pubkey:this.user.pubkey,
      //   kind: 3,
      //   content: "hello world",
      //   created_at: Math.round(Date.now()/1000)
      // }

      // event.id = getEventHash(event)

      // console.log('unsigned event', event)

      // const signedEvent = await window.nostr.signEvent(event)
      //     .catch( function(error){
      //       console.log('there was an error', error)
      //     })

      // console.log('signed event', signedEvent)

      // let ok = validateEvent(signedEvent)
      // let veryOk = await verifySignature(signedEvent)

      // console.log('valid event?', ok, veryOk)
    },
    auth2: function(){
      var codeVerifier = this.generateRandomString(64);

      const challengeMethod = crypto.subtle ? "S256" : "plain"

      Promise.resolve()
        .then(() => {
          if (challengeMethod === 'S256')
              return this.generateCodeChallenge(codeVerifier)
          else
              return codeVerifier
        })
        .then((codeChallenge) => {
          window.sessionStorage.setItem("code_verifier", codeVerifier);
          let redirectUri ="http://localhost:8080/";
          let args = new URLSearchParams({
              response_type: "code",
              client_id: this.clientId,
              scope: this.scopes,
              code_challenge_method: challengeMethod,
              code_challenge: codeChallenge,
              redirect_uri: redirectUri
            });
        window.location = `${this.authorizeEndpoint}/?${args}`;
      });
    },

    generateCodeChallenge: async function(codeVerifier) {
      let digest = await crypto.subtle.digest("SHA-256",
          new TextEncoder().encode(codeVerifier));

      return btoa(String.fromCharCode(...new Uint8Array(digest)))
          .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')
    },

    generateRandomString: function(length) {
      let text = "";
      let possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

      for (let i = 0; i < length; i++) {
          text += possible.charAt(Math.floor(Math.random() * possible.length));
      }

      return text;
    },
  }),

  props: {
    // relay: {
    //   type: String,
    //   default(){
    //     return ""
    //   }
    // },
    // relaysProp:{
    //   type: Array,
    //   default(){
    //     return []
    //   }
    // },
    // messagesProp:{
    //   type: Object,
    //   default(){
    //     return {}
    //   }
    // },
    // resultProp: {
    //   type: Object,
    //   default(){
    //     return {}
    //   }
    // },
  },
})
</script>

<style>
</style>