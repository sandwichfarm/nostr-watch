<template>
  <button @click="auth">Login with Alby</button>
</template>

<script>
import { defineComponent } from 'vue'
import { useRoute } from 'vue-router'

export default defineComponent({
  name: 'AlbyComponent',
  components: {},
  data() {
    return {
      authorizeEndpoint: "https://app.regtest.getalby.com/oauth",
      tokenEndpoint: "https://api.regtest.getalby.com/oauth/token",
      route: useRoute(),
      clientId: "test_client",
      clientSecret: "test_secret",
      scopes: "account:read",
      token : null,
      user: {}
    }
  },
  mounted(){
    const args = this.route.query

    if(!Object.prototype.hasOwnProperty.call(args, 'code'))
      return
    
    const code = args?.code;

    console.log('args', args)

    if (code) {
      let xhr = new XMLHttpRequest();

      xhr.onload = function() {
        let response = xhr.response;
        let message;

        if (xhr.status == 200) {
            message = "Access Token: " + response.access_token;
        }
        else {
            message = "Error: " + response.error_description + " (" + response.error + ")";
        }
        this.token = message
        console.log('token', this.token)
      };

      xhr.responseType = 'json';
      
      xhr.open("POST", this.tokenEndpoint, true);

      xhr.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
      xhr.setRequestHeader("Authorization", "Basic " + btoa(this.clientId + ":" + this.clientSecret));

      xhr.send(new URLSearchParams({
        code_verifier: window.sessionStorage.getItem("code_verifier"),
        grant_type: "authorization_code",
        redirect_uri: "http://localhost:8080/",
        code: code
      }));
    }
  },
  updated(){},
  computed: {},
  methods: {
    auth: async function(){

      this.user.pubkey = await window.nostr.getPublicKey()
      console.log('relays', await window.nostr.getRelays())
      .catch(err => console.warn(err))

      const event = {
        tags: []
        pubkey:this.user.p
        kind: 1,
        content: "hello world"
      }
      const signedEvent = await window.nostr
        .signEvent(event)
          .then(event => {
            console.log('event', event)
            console.log('signed event', signedEvent)
          })
          .catch(err => console.warn(err)) 

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
  },

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