import { defineStore } from 'pinia'

export const useTaskStore = defineStore('tasks', {
  state: () => ({ 
    processing: false,
    processedRelays: new Array(),
    currentTask: null
  }),
  getters: {
    getProcessedRelays: (state) => Array.from(state.processedRelays),
    isProcessing: (state) => state.processing,
    isRelayProcessed: (state) => (relay) => state.processedRelays.includes(relay)
  },
  actions: {
    addProcessedRelay(relay){
      if(!this.processedRelays.includes(relay))
        this.processedRelays.push(relay)
    },
    finishProcessing() { 
      this.processing = false 
      this.processedRelays = new Array()
      this.currentTask = null
    },
    startProcessing() { 
      this.processing = true 
      this.currentTask = "relays/check" //need to figure this out.
    },
  },
})