<template>
<a @click="toggleZap">
  <svg fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z"></path>
  </svg>
</a>
<div class="popover" v-if="showPopover">
  Support nostr.watch by zapping @sandwich 
  <div>
    <span 
    v-for="amount in Object.keys(amountPresetsMillis)" 
    :class="{
      'bg-black/80': this.activePreset === amount
    }"
    @click="setZapAmount(amount)">
      {{ amount }}
    </span>
    <span 
      @click="setActiveAmount"
      :class="{
        'bg-black/80': this.activePreset === 'custom'
      }">
        Custom
      </span>
  </div>
  <input 
    v-if="activePreset === 'custom'"
    type="text" 
    :value="zapMillis"
    @input="isNumber($event)"
    />
    <label for="zapComment">Comment (optional):</label>
    <input 
    name="zapComment"
    type="text" 
    :value="zapComment"
    /> 
  
  <button 
    @click="commitZap">
      Zap
  </button>
</div>
</template>

<script>
import { defineComponent } from 'vue'

import { setupStore } from '@/store'

import ZapMethods from '@/shared/zaps'
import UserMethods from '@/shared/user-lib'

export default defineComponent({
  name: 'StatusHistoryNode',
  components: {},
  data(){
    return {
      showPopover: false,
      amountPresetsMillis: {
        '1k': 1000*1000,
        '5k': 5000*1000,
        '10k': 10000*1000,
        '25k': 25000*1000,
        '50k': 50000*1000
      },
      zapMillis: null,
      zapComment: "",
      activePreset: '5k'
    }
  },
  methods: Object.assign(UserMethods, ZapMethods, {
    async doAuth(){
      if(this.loggedIn)
        return 
      this.authenticate()
    },
    zapUser(pubkey){
      const relays = await getRelay
      const lnurlp = await this.getLnurlpData()
    },
    toggleZap(){
      this.showPopover = !this.showPopover
    },
    setActiveAmount(key){
      this.activePreset = key
    },
    setZapAmount(key){
      this.setActiveAmount(key)
      this.zapMillis = this.amountPresetsMillis[key]
    },
    isNumber: function(e) {
      e = (e) ? e : window.event;
      var charCode = (e.which) ? e.which : eet.keyCode;
      if ((charCode > 31 && (charCode < 48 || charCode > 57)) && charCode !== 46) {
        e.preventDefault();;
      } else {
        return true;
      }
    },
    commitZap: async function(){
      let relays = [],
          zapData,
          lnurlp,
          event,
          invoice,
          signedEvent
      if(this.isLoggedIn)
        await this.authenticate() 
      if(!this.store.user.getPublicKey)
        return this.error = "could not authenticate"
      if(!this.store.user.kind10002?.length) {
        this.store.user.kind10002Event = await this.getRelayList(this.store.relays.all, this.store.user.getPublicKey, 'user/zap/@sandwich', 1000)
        this.store.user.kind10002 = this.store.user.kind3Event.tags.filter( tag => tag[0] === 'r')
        relays = this.store.user.kind10002?.map( tag => tag[1] )
      }
      if(!relays.length)
        return this.error = "could not find user relays (kind 10002)"
      if(!(this.store.user.lud06 || this.store.user.lud16))
        this.getUserProfileAndTestEvent(relays, this.store.user.getPublicKey)
      if(!(this.store.user.lud06 || this.store.user.lud16))
        return this.error = "neither lud06 or lud16 is set in associated user profile"
      lnurlp = this.store.user.lud06 ? this.store.user.lud06 : this.store.user.lud16
      zapData = await this.getLnurlpData(lnurlp)
      if(!zapData.allowsNostr || !zapData.nostrPubkey)
        return this.error = `providing lnurl does not allowNostr or is missing the zapper's nostrPubkey`
      zapRequest = await this.makeZapRequest(this.store.user.getPublicKey, relays, this.zapMillis, zapData, this.zapComment)
      signedEvent = await window.nostr.signEvent(structuredClone(zapRequest))
      invoice = await this.getInvoice(zapData.callback, this.zapMillis, zapRequest)
      // this.publishEvent(signedEvent)
    }
  }),
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