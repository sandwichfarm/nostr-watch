<template>
<div class="flex flex-wrap">
    <div class="w-full text-left">
      <button 
        ref="btnRef" 
        type="button" 
        v-on:click="togglePopover()" 
        class="items-start cursor-not-allowed inline-flex items-center rounded border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2">
            Sync Favs with Nostr
        </button>
      <div  ref="popoverRef" 
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
      </div>
    </div>
  </div>
</template>
<script>
import { createPopper } from "@popperjs/core";

export default {
  name: "NostrSyncPopoverNag",
  data() {
    return {
      popoverShow: false
    }
  },
  methods: {
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