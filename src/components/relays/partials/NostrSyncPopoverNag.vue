<template>
<span>
  <button 
  ref="btnRef" 
  type="button" 
  v-on:click="togglePopover()" 
  class="items-start cursor-not-allowed inline-flex items-center rounded border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2">
      Sync Favs with Nostr
  </button>
  <span  ref="popoverRef" 
        v-bind:class="{'hidden': !popoverShow, 'block': popoverShow}" 
        class="bg-pink-600 block border-0 mr-3 z-50 font-normal leading-normal text-sm max-w-xs text-left no-underline break-words rounded-lg
        ">
  </span>
</span>

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