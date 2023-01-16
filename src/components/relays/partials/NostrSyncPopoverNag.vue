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
        v-if="this.store.layout.editorExpanded"
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
  methods: {
    toggleEditor: function(){
      this.store.layout.toggleEditor()
    },  
    persistChanges: function(){
      const event = {
        created_at: Date.now(),
        tags: [],
        kind: [3]
      }

      
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
  }
})
</script>