<template>
<a @click="toggleZap">
  <svg fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"></path>
  </svg>
</a>
</template>

<script>
import { defineComponent } from 'vue'

import { setupStore } from '@/store'

import {hasNip07Extension, getPubKey, signEvent, eventIsValid} from `@/shared/events`
import {getLnurlpCallback, getInvoice, makeZapRequest} from `@/shared/zaps`

export default defineComponent({
  name: 'StatusHistoryNode',
  components: {},
  data(){
    return {
      showPopover: false 
    }
  },
  methods: {
    async doAuth(){
      if(this.loggedIn)
        return 
      this.authenticate()
    },
    zapUser(pubkey){
      const lnurlp = this.getLnurlpData()
    },
    toggleZap(){
      this.showPopover = !this.showPopover
    }
  },
  computed: {
    
  },
  data() {
    return {}
  },
  setup(){
    return { 
      store : setupStore(),
    }
  },
})
</script>