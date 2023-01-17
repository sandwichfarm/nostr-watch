<template>
<div class="inline">
    <div class="inline text-left">
      <button 
        ref="btnRef" 
        type="button" 
        v-on:click="toggleEditor()" 
        class="
          ml-8
          cursor-pointer
          inline-flex 
          items-center 
          rounded 
        bg-white 
          dark:bg-black/20
          px-2.5 
          py-1.5 
          text-xs 
          font-medium 
          text-gray-700 
          shadow-sm 
          hover:bg-gray-50 
          dark:hover:bg-black/90
          focus:outline-none 
          focus:ring-2 
          focus:ring-indigo-500 
          dark:focus:ring-white/10
          focus:ring-offset-2">
            <span v-if="this.store.layout.editorExpanded">
              Cancel
            </span>
            
            <span v-if="!this.store.layout.editorExpanded">
              Edit Relay List <sup><code class="text-cs text-white/20 ml-1">kind3</code></sup>
            </span>
        </button>

        <button 
        ref="btnRef" 
        type="button" 
        v-on:click="persistChanges()" 
        v-if="this.store.layout.editorExpanded && store.tasks.getActiveSlug !== 'user/relay/list'"
        class="
          ml-2
          cursor-pointer
          inline-flex 
          items-center 
          rounded 
        bg-white 
          dark:bg-black/20
          px-2.5 
          py-1.5 
          text-xs 
          font-medium 
          text-gray-700 
          shadow-sm 
          hover:bg-gray-50 
          dark:hover:bg-black/90
          focus:outline-none 
          focus:ring-2 
          focus:ring-indigo-500 
          dark:focus:ring-white/10
          focus:ring-offset-2">
            Save
        </button>
    </div>
  </div>
</template>
<script>
// import { createPopper } from "@popperjs/core";
import { defineComponent, toRefs } from 'vue'
import { setupStore } from '@/store/'
import safeStringify from 'fast-safe-stringify'
import { getEventHash, validateEvent, verifySignature } from 'nostr-tools'
import RelaysLib from '@/shared/relays-lib'
import { RelayPool } from 'nostr'

export default defineComponent({
  name: "NostrSyncPopoverNag",
  setup(props){
    const {editorProp: editor} = toRefs(props)
    return { 
      store : setupStore(),
      editor: editor
    }
  },
  data() {
    return {
      changed: false
      // editor: false,
      // popoverShow: false
    }
  },
  mounted(){
    this.store.layout.editorOff()
  },
  unmounted(){
    this.store.layout.editorOff()
  },
  methods: Object.assign(RelaysLib, {
    toggleEditor: async function(){
      this.store.layout.toggleEditor()
      if(this.store.layout.editorExpanded)
        this.queueJob(
          'user/relay/list',
          async () => {
            await this.store.user.setKind3()
              .then( () => {
                Object.keys(this.store.user.kind3).forEach( key => {
                  this.store.relays.setFavorite(key)
                })
                this.store.tasks.completeJob()
              })
              .catch( err => {
                console.error('error!', err)
                this.store.tasks.completeJob()
              })
          },
          true
        )
    },  
    persistChanges: async function(){
      const event = {
        created_at: Math.floor(Date.now()/1000),
        kind: 3,
        content: safeStringify(this.store.user.kind3),
        tags: [...this.store.user.kind3Event.tags],
        pubkey: this.store.user.getPublicKey,
      }
      event.id = getEventHash(event)

      console.log('kind3 event', event)

      console.log(window.nostr, typeof window.nostr.signEvent)

      const signedEvent = await window.nostr.signEvent(structuredClone(event))

      let ok = validateEvent(signedEvent)
      let veryOk = verifySignature(signedEvent)

      if(!ok || !veryOk)
        return 

      console.log('valid event?', ok, veryOk)

      const pool = new RelayPool( Object.keys(this.store.user.kind3) )

      pool.on('open', relay=>{
        relay.send(['EVENT', signedEvent])
      })
    },
    togglePopover: function(){
      // if(this.popoverShow){
      //   this.popoverShow = false;
      // } else {
      //   this.popoverShow = true;
      //   createPopper(this.$refs.btnRef, this.$refs.popoverRef, {
      //     placement: "left"
      //   });
      // }
    },
  })
})
</script>