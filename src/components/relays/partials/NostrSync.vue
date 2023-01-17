<template>
<div class="inline" v-if="store.user.getPublicKey.length">
    <div class="inline text-left">

      <span v-if="savedSuccess" class="inline-block mr-3"> 
          <svg class="h-4 w-4 inline-block" fill="none" stroke="#32CD32" stroke-width="1.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          Saved to <span>{{ savedSuccess }}</span>
      </span>

      <button 
        :title="this.store.tasks.getActiveSlug === 'relays/check' ? 'disabled while relays are checking' : ''"
        ref="btnRef" 
        type="button" 
        v-on:click="this.store.tasks.getActiveSlug === 'relays/check' ? false : toggleEditor()" 
        :class="{
          'cursor-not-allowed opacity-40': this.store.tasks.getActiveSlug === 'relays/check',
          'cursor-pointer': this.store.tasks.getActiveSlug === 'user/relay/list'
        }"
        class="mr-3 inline-flex items-center justify-center rounded-md border border-transparent bg-white/20 px-4 py-2 text-m font-medium text-white shadow-sm hover:bg-white/40 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:w-auto">
            <span v-if="this.store.layout.editorExpanded">
              Cancel
            </span> 
            
            <span v-if="!this.store.layout.editorExpanded">
              Edit Relay List
            </span>
        </button>

        <button 
        :title="!changed ? 'nothing to save' : ''"
        ref="btnRef" 
        type="button" 
        v-on:click="changed ? persistChanges() : false" 
        v-if="this.store.layout.editorExpanded && store.tasks.getActiveSlug !== 'user/relay/list'"
        :class="{
          'cursor-not-allowed opacity-40': !changed,
          'cursor-pointer': changed
        }"
        class="mr-3 inline-flex items-center justify-center rounded-md border border-transparent bg-white/20 px-4 py-2 text-m font-medium text-white shadow-sm hover:bg-white/40  focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:w-auto">
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
import objHash from 'object-hash'

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
      changed: false,
      hashCache: null,
      hashOG: null,
      savedTo: [],
      savedSuccess: null,
      interval: null,
      // editor: false,
      // popoverShow: false
    }
  },
  mounted(){
    this.hashOG = objHash(structuredClone(this.store.user.getKind3))
    this.hashCache = structuredClone(this.hashOG)
    this.store.layout.editorOff()
    this.interval = setInterval( () => {
      if(this.savedTo.length)
        this.savedSuccess = this.savedTo.shift()
      else 
        this.savedSuccess = null
      
      const hashCurrent = objHash(this.store.user.getKind3),
            hashCache = this.hashCache,
            hashOG = this.hashOG
      
      if(hashCache === hashCurrent)
        return

      if(hashOG === hashCurrent )
        return this.changed = false

      console.log('input cache did not match', hashCache)

      console.log(
        'changed?', 
        this.changed,
        'ok..',
        hashCache, 
        objHash(this.store.user.getKind3), 
        hashCache == objHash(this.store.user.getKind3)
      )

      this.hashCache = objHash(structuredClone(this.store.user.getKind3))
      this.changed = true

    }, 500)
  },
  unmounted(){
    clearInterval(this.interval)
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
      
      const relaysWrite = Object.keys(this.store.user.kind3).filter( key => this.store.user.kind3[key].write)

      const pool = new RelayPool( relaysWrite )

      pool.on('open', relay=>{
        relay.send(['EVENT', signedEvent])
      })
      pool.on('ok', relay => {
        this.savedTo.push(relay.url)
      })

      this.hashOG = objHash(JSON.parse(event.content))
      this.hashCache = this.hashOG
      this.changed = false

      pool.close()
      this.toggleEditor()
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