import { defineStore } from 'pinia'

export const useTaskStore = defineStore('tasks', {
  state: () => ({ 
    //queue
    pending: new Array(),
    completed: new Array(),
    active: new Object(),

    //legacy
    processing: false,
    processedRelays: new Array(),
    currentTask: null
  }),
  getters: {
    //legacy 
    getProcessedRelays: (state) => Array.from(state.processedRelays),
    isProcessing: (state) => state.processing,
    isRelayProcessed: (state) => (relay) => state.processedRelays.includes(relay),

    //queue/lists
    getPending: (state) => state.pending,
    getActive: (state) => state.active,
    getCompleted: (state) => state.completed,
    //queue/states
    isActive: (state) => Object.keys( state.active ).length > 0,
    isIdle: (state) => Object.keys( state.active ).length == 0,
    arePending: (state) => state.pending.length > 0,
  },
  actions: {
    //queue
    addJob(job){
      this.pending.push(job)
      if( this.isIdle )
        this.startNextJob()
    },
    startNextJob(){
      if( this.isActive ) 
        this.completed.push(this.active)
      if( this.arePending ) {
        this.active = this.pending[0]
        this.pending.shift()
      }
      else {
        this.active = {}
      }
    },
    
    clearJobs(type){
      this[type] = new Array()
    },
    cancelJob( id ){
      const index = this.pending.findIndex( job => job.id === id )
      this.removeJob( index )
    },
    removeJob( index ){
      this.pending.splice( index, 1 )
    },
    //legacy
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